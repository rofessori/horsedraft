/**
 * "Watch" a whole race as a film strip: freezes the race clock at evenly spaced moments, captures
 * each frame from the production build in headless Chromium, and stitches them into one PNG.
 * Made for reviewing pacing without sitting through a two-minute race (agents included).
 *
 *   npm run strip                                   # default names, default length, seed 11
 *   npm run strip -- --names "Anna,Bob,Carl" --duration 90 --seed 42 --frames 12 --out docs/race-strip.png
 *
 * Needs `npm run build` first (loads dist/index.html from disk) and Playwright's Chromium.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { DEFAULT_DURATION_SEC } from "../src/core/limits";
import { parseNamesLoose } from "../src/core/names";

interface Args {
  names?: string;
  duration?: string;
  seed?: string;
  frames?: string;
  out?: string;
  help?: boolean;
}

const KNOWN_FLAGS: (keyof Args)[] = ["names", "duration", "seed", "frames", "out", "help"];

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (!a.startsWith("--")) continue;
    const key = a.slice(2) as keyof Args;
    if (!KNOWN_FLAGS.includes(key)) throw new Error(`unknown flag --${key} (known: ${KNOWN_FLAGS.map((k) => `--${k}`).join(" ")})`);
    if (key === "help") out.help = true;
    else {
      const value = argv[++i];
      if (value !== undefined) out[key] = value;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("*/")[0]);
  process.exit(0);
}

const names = parseNamesLoose(args.names ?? "Anna,Ben,Carla,Daniel,Elsa,Finn,Greta,Hugo").names;
const duration = Number(args.duration ?? DEFAULT_DURATION_SEC);
const seed = args.seed ?? "11";
const frameCount = Math.max(2, Number(args.frames ?? 12));
const outFile = args.out ?? "test-results/strip/race-strip.png";
// individual frames and the index always go to test-results, even when --out points into docs/
const workDir = "test-results/strip";
const frameDir = path.join(workDir, "frames");
mkdirSync(frameDir, { recursive: true });
mkdirSync(path.dirname(outFile), { recursive: true });

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
// dist/index.html loads an ES module; plain Chromium blocks those over file:// unless told otherwise
const browser = await chromium.launch({ args: ["--allow-file-access-from-files"], ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const url = pathToFileURL(path.resolve("dist/index.html")).href;
const query = `names=${encodeURIComponent(names.join(","))}&duration=${duration}&seed=${encodeURIComponent(seed)}&autostart=1&countdown=0&clean=1&title=${encodeURIComponent("Film strip")}`;
await page.goto(`${url}?${query}`);
await page.waitForFunction(() => typeof window.horsedraft !== "undefined");
const totalSec = await page.evaluate(() => window.horsedraft.outcome()?.plan.totalSec);
if (totalSec === undefined) {
  await browser.close();
  throw new Error("the race did not start (fewer than two names?)");
}

const times: number[] = [];
for (let k = 0; k < frameCount; k++) times.push((k / (frameCount - 1)) * (totalSec + 0.3));
const frames: string[] = [];
for (const [k, t] of times.entries()) {
  await page.evaluate((s) => window.horsedraft.freeze(s), t);
  await page.waitForTimeout(120);
  const file = path.join(frameDir, `${String(k + 1).padStart(2, "0")}-${t.toFixed(1)}s.png`);
  await page.screenshot({ path: file });
  frames.push(file);
}

// stitch: a two-column contact sheet rendered by the browser itself (no image library needed)
const cols = 2;
const html = `<!doctype html><body style="margin:0;background:#2a1f16;display:grid;grid-template-columns:repeat(${cols},800px);gap:6px;padding:6px;width:max-content">
${frames.map((f, k) => `<figure style="margin:0;position:relative"><img src="data:image/png;base64,${readFileSync(f).toString("base64")}" style="display:block;width:800px;height:450px">
<figcaption style="position:absolute;left:8px;top:8px;background:rgba(0,0,0,.6);color:#fff;font:700 18px Arial;padding:4px 8px;border-radius:6px">t = ${(times[k] as number).toFixed(1)} s</figcaption></figure>`).join("\n")}
</body>`;
const sheet = await browser.newPage({ viewport: { width: 800 * cols + 6 * (cols + 1), height: 450 * Math.ceil(frames.length / cols) + 6 * (Math.ceil(frames.length / cols) + 1) } });
await sheet.setContent(html);
await sheet.screenshot({ path: outFile, fullPage: true });
await browser.close();

writeFileSync(path.join(workDir, "strip.json"), JSON.stringify({ names, duration, seed, totalSec, times, frames }, null, 2));
console.log(`race strip: ${frames.length} frames of a ${duration}s race (seed ${seed}) -> ${outFile}`);
