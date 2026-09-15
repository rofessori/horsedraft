import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { planRace, winnerOf } from "../../src/core/race";

const SHOTS = "test-results/shots";
const NAMES = ["Anna", "Ben", "Carla", "Daniel", "Elsa", "Finn", "Greta", "Hugo"];
// Default: `electron .` on the build output. Set HORSEDRAFT_APP_PATH to a packaged binary
// (release/mac-arm64/HorseDraft.app/Contents/MacOS/HorseDraft) to test the shipped bundle instead.
const PACKAGED = process.env.HORSEDRAFT_APP_PATH;

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // A throwaway profile so the test never touches the user's remembered setup, and an inactive
  // window so a developer typing elsewhere does not feed Space / R / Esc into the race.
  const userData = mkdtempSync(path.join(tmpdir(), "horsedraft-e2e-"));
  app = await electron.launch({
    ...(PACKAGED ? { executablePath: PACKAGED, args: [] } : { args: ["."] }),
    cwd: process.cwd(),
    env: { ...process.env, HORSEDRAFT_USER_DATA: userData, HORSEDRAFT_INACTIVE: "1" },
    timeout: 30_000,
  });
  page = await app.firstWindow();
  await page.waitForFunction(() => typeof window.horsedraft !== "undefined", undefined, { timeout: 30_000 });
});

test.afterAll(async () => {
  await app?.close();
});

test("the desktop app boots into the setup screen from the built files", async () => {
  expect(page.url()).toMatch(/^file:.*\/dist\/index\.html$/);
  await expect(page.locator("#setup-panel")).toBeVisible();
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator(".horse-row")).toHaveCount(6);
  const win = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return { title: w?.getTitle(), visible: w?.isVisible(), focused: w?.isFocused() };
  });
  expect(win).toEqual({ title: "HorseDraft", visible: true, focused: false });
  await page.screenshot({ path: `${SHOTS}/app-01-setup.png` });
});

test("a seeded race in the desktop app finishes with the outcome the core predicts", async () => {
  const seed = 42;
  await page.evaluate(
    ({ names }) => window.horsedraft.app.updateSetup({ namesText: names.join("\n"), colors: [], durationSec: 3, title: "Desktop Cup" }),
    { names: NAMES },
  );
  await page.evaluate((s) => window.horsedraft.start(s, 0), seed);
  await expect(page.locator("#setup-panel")).toBeHidden();
  await expect(page.locator("#results")).toBeVisible({ timeout: 20_000 });

  const expected = planRace(NAMES.length, 3, seed);
  await expect(page.locator("#winner-line")).toHaveText(`🏆 ${NAMES[winnerOf(expected)]} wins!`);
  const rows = await page.locator("#results-list li .name").allTextContents();
  expect(rows).toEqual(expected.finishOrder.map((h) => NAMES[h]));
  await page.screenshot({ path: `${SHOTS}/app-02-results.png` });
});
