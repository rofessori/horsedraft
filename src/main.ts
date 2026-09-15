import { clampDuration } from "./core/limits";
import { parseNamesLoose } from "./core/names";
import { coerceSeed } from "./core/rng";
import { App, COUNTDOWN_SEC, type RaceOutcome } from "./ui/app";
import { $, typingInField } from "./ui/dom";
import { mountResultsPanel } from "./ui/resultsPanel";
import { mountSetupPanel } from "./ui/setupPanel";
import { loadSetup } from "./ui/storage";

/**
 * URL parameters (handy for OBS scenes, automation and tests):
 *   ?names=Anna,Bob,Carl   ?title=Friday   ?duration=20   ?numbers=0|1
 *   ?seed=42 (or any word)  ?autostart=1   ?countdown=0
 *   ?clean=1  hides the small toolbar too (nothing but the track on screen)
 */
function boot(): void {
  const params = new URLSearchParams(location.search);
  const setup = loadSetup();
  const names = params.get("names");
  if (names) setup.namesText = parseNamesLoose(names).names.join("\n");
  if (params.has("title")) setup.title = params.get("title") ?? "";
  if (params.has("duration")) setup.durationSec = clampDuration(Number(params.get("duration")));
  if (params.has("numbers")) setup.showNumbers = params.get("numbers") !== "0";
  if (names) setup.colors = [];

  const app = new App($<HTMLCanvasElement>("stage"), setup);
  const panel = mountSetupPanel(app);
  mountResultsPanel(app);
  document.body.dataset.phase = app.phase;
  if (params.get("clean") === "1") document.body.classList.add("clean");

  $("toggle-setup").addEventListener("click", () => panel.toggle());
  $("fullscreen").addEventListener("click", () => toggleFullscreen());

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (app.phase !== "setup") app.stop();
      return;
    }
    if (typingInField()) return;
    if (e.key === " " || e.key === "Enter") {
      if (app.phase === "setup" && app.canStart()) {
        e.preventDefault();
        app.start();
      }
    } else if (e.key.toLowerCase() === "h") panel.toggle();
    else if (e.key.toLowerCase() === "f") toggleFullscreen();
    else if (e.key.toLowerCase() === "r" && app.phase === "finished") app.raceAgain();
  });

  const seed = coerceSeed(params.get("seed"));
  const countdown = params.has("countdown") ? Number(params.get("countdown")) : COUNTDOWN_SEC;
  if (params.get("autostart") === "1" && app.canStart()) app.start(seed, countdown);

  // Automation / test hooks. Everything here is also reachable through the UI.
  window.horsedraft = {
    app,
    start: (s?: number, c?: number) => app.start(s ?? seed, c ?? countdown),
    freeze: (t) => app.freeze(t),
    outcome: () => app.outcome(),
    phase: () => app.phase,
  };
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
}

declare global {
  interface Window {
    horsedraft: {
      app: App;
      start: (seed?: number, countdownSec?: number) => unknown;
      freeze: (t: number | undefined) => void;
      outcome: () => RaceOutcome | undefined;
      phase: () => string;
    };
  }
}

boot();
