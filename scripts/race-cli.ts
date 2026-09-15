/**
 * Run a race without a browser. Useful for checking the simulation, reproducing a seed,
 * or letting an agent "watch" a race as text.
 *
 *   npm run race -- --names "Anna,Bob,Carl" --duration 10 --seed 42
 *   npm run race -- --file friday.horserace.json --timeline
 *   npm run race -- --count 20 --json
 */
import { readFileSync } from "node:fs";
import { MAX_HORSES } from "../src/core/limits";
import { numberedNames, parseNamesLoose } from "../src/core/names";
import { planRace, results, standingsAt, trackPositionAt } from "../src/core/race";
import { parseRace } from "../src/core/raceFile";
import { coerceSeed, randomSeed } from "../src/core/rng";

interface Args {
  names?: string;
  file?: string;
  count?: string;
  duration?: string;
  seed?: string;
  json?: boolean;
  timeline?: boolean;
  help?: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (!a.startsWith("--")) continue;
    const key = a.slice(2) as keyof Args;
    if (key === "json" || key === "timeline" || key === "help") out[key] = true;
    else {
      const value = argv[++i];
      if (value !== undefined) out[key] = value;
    }
  }
  return out;
}

// `npm run race | head` closes the pipe early; that is not an error worth a stack trace.
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(0);
  throw err;
});

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("*/")[0]);
  process.exit(0);
}

let names: string[];
let duration = Number(args.duration ?? 10);
let title = "";
if (args.file) {
  const cfg = parseRace(readFileSync(args.file, "utf8"));
  names = cfg.horses.map((h) => h.name);
  duration = args.duration ? Number(args.duration) : cfg.durationSec;
  title = cfg.title;
} else if (args.names) {
  names = parseNamesLoose(args.names).names;
} else {
  names = numberedNames(Math.min(MAX_HORSES, Number(args.count ?? 6)));
}

const seed = coerceSeed(args.seed) ?? randomSeed();
const plan = planRace(names.length, duration, seed);
const res = results(plan);

if (args.json) {
  console.log(
    JSON.stringify(
      {
        title,
        seed,
        durationSec: duration,
        results: res.map((r) => ({ place: r.place, name: names[r.horse], timeSec: Number(r.timeSec.toFixed(3)) })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log(`${title || "HorseDraft race"} · ${names.length} horses · ${duration}s · seed ${seed}\n`);
if (args.timeline) {
  const width = 40;
  for (let t = 0; t <= plan.totalSec + 1e-9; t += Math.max(0.5, plan.totalSec / 12)) {
    console.log(`t=${t.toFixed(1).padStart(5)}s  leader: ${names[standingsAt(plan, t)[0] as number]}`);
    for (let h = 0; h < names.length; h++) {
      const p = Math.min(1, trackPositionAt(plan, h, t));
      const bar = "#".repeat(Math.round(p * width)).padEnd(width, ".");
      console.log(`  ${String(names[h]).padEnd(14).slice(0, 14)} |${bar}|`);
    }
    console.log();
  }
}
for (const r of res) {
  console.log(`${String(r.place).padStart(3)}. ${String(names[r.horse]).padEnd(24)} ${r.timeSec.toFixed(2)}s`);
}
