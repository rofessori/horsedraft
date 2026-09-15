import { expect, test, type Page } from "@playwright/test";
import { planRace, winnerOf } from "../../src/core/race";
import { hashString } from "../../src/core/rng";

const SHOTS = "test-results/shots";
const NAMES = ["Anna", "Ben", "Carla", "Daniel", "Elsa", "Finn", "Greta", "Hugo"];

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => typeof window.horsedraft !== "undefined");
}

test("setup screen renders with the default names", async ({ page }) => {
  await open(page, "");
  await expect(page.locator("#setup-panel")).toBeVisible();
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator(".horse-row")).toHaveCount(6);
  await page.screenshot({ path: `${SHOTS}/01-setup.png` });
});

test("a seeded race finishes with the outcome the core predicts", async ({ page }) => {
  const seed = 42;
  await open(page, `names=${NAMES.join(",")}&duration=3&seed=${seed}&autostart=1&countdown=0&title=Playwright%20Cup`);
  await expect(page.locator("#setup-panel")).toBeHidden();
  await expect(page.locator("#results")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#results-list li")).toHaveCount(NAMES.length);

  const expected = planRace(NAMES.length, 3, seed);
  const winnerName = NAMES[winnerOf(expected)];
  await expect(page.locator("#winner-line")).toHaveText(`🏆 ${winnerName} wins!`);
  const rows = await page.locator("#results-list li .name").allTextContents();
  expect(rows).toEqual(expected.finishOrder.map((h) => NAMES[h]));
  await page.screenshot({ path: `${SHOTS}/04-results.png` });

  // "Remove winner & race again" drops exactly the winner
  await page.locator("#remove-winner").click();
  await expect(page.locator("#results")).toBeHidden();
  await page.waitForFunction(() => window.horsedraft.phase() !== "setup");
  const remaining = await page.evaluate(() => window.horsedraft.app.names());
  expect(remaining).toEqual(NAMES.filter((n) => n !== winnerName));
});

test("word seeds work and are stable", async ({ page }) => {
  await open(page, `names=${NAMES.join(",")}&duration=3&seed=friday&autostart=1&countdown=0`);
  await expect(page.locator("#results")).toBeVisible({ timeout: 15_000 });
  const expected = planRace(NAMES.length, 3, hashString("friday"));
  await expect(page.locator("#winner-line")).toContainText(NAMES[winnerOf(expected)] as string);
});

test("frozen frames: countdown, mid-race, finish, and a full 20-horse field", async ({ page }) => {
  const twenty = Array.from({ length: 20 }, (_, i) => `Runner ${i + 1}`);
  await open(page, `names=${NAMES.join(",")}&duration=10&seed=7&autostart=1&countdown=3&title=Friday%20Raffle`);
  await page.evaluate(() => window.horsedraft.freeze(-1.4));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/02-countdown.png` });

  await page.evaluate(() => window.horsedraft.freeze(5.5));
  await page.waitForTimeout(400); // let gallop phases / dust advance a few frames
  await page.screenshot({ path: `${SHOTS}/03-midrace.png` });

  await page.evaluate(() => window.horsedraft.freeze(10.4));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/05-finish-banner.png` });

  await open(page, `names=${twenty.join(",")}&duration=10&seed=7&autostart=1&countdown=0&title=Twenty%20Horses`);
  await page.evaluate(() => window.horsedraft.freeze(6));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/06-twenty-horses.png` });

  // the default race length: horses leave the gate slowly, and mid-race the field is strung out
  await open(page, `names=${NAMES.join(",")}&seed=11&autostart=1&countdown=0&title=Saturday%20Stakes`);
  expect(await page.evaluate(() => window.horsedraft.app.setup.durationSec)).toBe(60);
  await page.evaluate(() => window.horsedraft.freeze(1.2));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/07-gate-break.png` });
  await page.evaluate(() => window.horsedraft.freeze(42));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/08-long-race-midway.png` });
});

test("start button is disabled with fewer than two names", async ({ page }) => {
  await open(page, "");
  await page.locator("#names").fill("Only one");
  await expect(page.locator("#start")).toBeDisabled();
  await expect(page.locator("#names-hint")).toContainText("at least 2");
  await page.locator("#names").fill("One\nTwo");
  await expect(page.locator("#start")).toBeEnabled();
});
