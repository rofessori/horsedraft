import { MAX_HORSES, MIN_HORSES, clampDuration } from "../core/limits";
import { parseNames } from "../core/names";
import { assignRandomColors, randomColor } from "../core/palette";
import type { HorseSpec, RaceConfig, RacePlan, RaceResult } from "../core/race";
import { isRaceOver, planRace, results, winnerOf } from "../core/race";
import { Rng, randomSeed } from "../core/rng";
import { createAnim, renderScene, type HorseAnim, type Phase, type SceneState } from "../render/scene";
import { layoutStage, type Stage } from "../render/stage";
import { saveSetup, type SetupState } from "./storage";

export const COUNTDOWN_SEC = 3;
/** Delay between the last horse crossing and the results dialog. */
const RESULTS_DELAY_SEC = 0.9;

export interface RaceOutcome {
  config: RaceConfig;
  plan: RacePlan;
  results: RaceResult[];
}

export interface AppEvents {
  phase: (phase: Phase) => void;
  setup: (setup: SetupState) => void;
  finished: (outcome: RaceOutcome) => void;
}

/**
 * Owns the state machine (setup → countdown → racing → finished), the render loop and the setup
 * state. DOM panels talk to it through methods and subscribe to events; nothing in here touches
 * the panels directly, which keeps it small enough to reason about (and to drive from tests).
 */
export class App {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private stage: Stage;

  setup: SetupState;
  phase: Phase = "setup";
  plan: RacePlan | undefined;
  countdownSec = COUNTDOWN_SEC;

  private raceStartMs = 0;
  private frozenRaceTime: number | undefined;
  private lastFrameMs = 0;
  private anims: HorseAnim[] = [];
  private resultsShown = false;
  private readonly startedAt = performance.now();
  private readonly rng = new Rng(randomSeed());
  private readonly listeners: { [K in keyof AppEvents]: AppEvents[K][] } = { phase: [], setup: [], finished: [] };

  constructor(canvas: HTMLCanvasElement, setup: SetupState) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
    this.setup = setup;
    this.stage = layoutStage(1, 1, 1);
    this.ensureColors();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    requestAnimationFrame((t) => this.frame(t));
  }

  on<K extends keyof AppEvents>(event: K, fn: AppEvents[K]): void {
    this.listeners[event].push(fn);
  }

  private emit<K extends keyof AppEvents>(event: K, ...args: Parameters<AppEvents[K]>): void {
    for (const fn of this.listeners[event]) (fn as (...a: unknown[]) => void)(...args);
  }

  // ---------- setup ----------

  /** Names currently entered (already capped at MAX_HORSES). */
  names(): string[] {
    return parseNames(this.setup.namesText).names;
  }

  horses(): HorseSpec[] {
    this.ensureColors();
    return this.names().map((name, i) => ({ name, color: this.setup.colors[i] as string }));
  }

  config(): RaceConfig {
    return {
      title: this.setup.title,
      durationSec: this.setup.durationSec,
      showNumbers: this.setup.showNumbers,
      horses: this.horses(),
    };
  }

  canStart(): boolean {
    const n = this.names().length;
    return n >= MIN_HORSES && n <= MAX_HORSES;
  }

  updateSetup(patch: Partial<SetupState>): void {
    this.setup = { ...this.setup, ...patch };
    this.ensureColors();
    saveSetup(this.setup);
    this.emit("setup", this.setup);
  }

  applyConfig(config: RaceConfig): void {
    this.updateSetup({
      title: config.title,
      namesText: config.horses.map((h) => h.name).join("\n"),
      colors: config.horses.map((h) => h.color),
      durationSec: clampDuration(config.durationSec),
      showNumbers: config.showNumbers,
    });
  }

  setColor(index: number, color: string): void {
    const colors = this.setup.colors.slice();
    colors[index] = color;
    this.updateSetup({ colors });
  }

  randomizeColor(index: number): void {
    this.setColor(index, randomColor(this.rng, this.setup.colors));
  }

  randomizeAllColors(): void {
    this.updateSetup({ colors: assignRandomColors(this.names().length, this.rng) });
  }

  shuffleNames(): void {
    const horses = this.rng.shuffle(this.horses());
    this.updateSetup({ namesText: horses.map((h) => h.name).join("\n"), colors: horses.map((h) => h.color) });
  }

  /** Make sure every name has a colour; new names get a colour nobody else has. */
  private ensureColors(): void {
    const n = this.names().length;
    const colors = this.setup.colors.slice(0, Math.max(n, this.setup.colors.length));
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (!colors[i]) {
        colors[i] = randomColor(this.rng, colors.filter((c): c is string => !!c));
        changed = true;
      }
    }
    if (changed) this.setup = { ...this.setup, colors };
  }

  // ---------- race ----------

  /** Start a race. `seed` pins the outcome (tests / replays); `countdownSec` 0 skips the 3-2-1. */
  start(seed: number = randomSeed(), countdownSec: number = COUNTDOWN_SEC): RacePlan {
    if (!this.canStart()) throw new Error(`Need between ${MIN_HORSES} and ${MAX_HORSES} names`);
    const horses = this.horses();
    this.plan = planRace(horses.length, this.setup.durationSec, seed);
    this.countdownSec = Math.max(0, countdownSec);
    this.anims = horses.map(() => createAnim());
    this.resultsShown = false;
    this.frozenRaceTime = undefined;
    this.raceStartMs = performance.now() + this.countdownSec * 1000;
    this.setPhase(this.countdownSec > 0 ? "countdown" : "racing");
    return this.plan;
  }

  /** Back to the setup screen, abandoning any race in progress. */
  stop(): void {
    this.plan = undefined;
    this.frozenRaceTime = undefined;
    this.anims = [];
    this.setPhase("setup");
  }

  /** Same horses, fresh draw. */
  raceAgain(): void {
    this.start();
  }

  /** Drop the winner (for "everyone wins once" raffles) and race the rest. */
  removeWinnerAndRaceAgain(): boolean {
    if (!this.plan) return false;
    const winner = winnerOf(this.plan);
    const horses = this.horses().filter((_, i) => i !== winner);
    this.updateSetup({ namesText: horses.map((h) => h.name).join("\n"), colors: horses.map((h) => h.color) });
    if (!this.canStart()) {
      this.stop();
      return false;
    }
    this.start();
    return true;
  }

  outcome(): RaceOutcome | undefined {
    if (!this.plan) return undefined;
    return { config: this.config(), plan: this.plan, results: results(this.plan) };
  }

  /** Race clock in seconds (negative during the countdown). */
  raceTime(): number {
    if (this.frozenRaceTime !== undefined) return this.frozenRaceTime;
    return (performance.now() - this.raceStartMs) / 1000;
  }

  /** Test hook: freeze the race clock at `t` seconds so a frame can be captured deterministically. */
  freeze(t: number | undefined): void {
    this.frozenRaceTime = t;
    for (const a of this.anims) a.dust = []; // puffs from before the jump would float mid-track
  }

  private setPhase(phase: Phase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    document.body.dataset.phase = phase;
    this.emit("phase", phase);
  }

  // ---------- render loop ----------

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.stage = layoutStage(Math.max(1, rect.width), Math.max(1, rect.height), dpr);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
  }

  private frame(nowMs: number): void {
    const dt = this.lastFrameMs ? Math.min(0.1, (nowMs - this.lastFrameMs) / 1000) : 0;
    this.lastFrameMs = nowMs;
    this.advance();
    this.draw(dt, nowMs);
    requestAnimationFrame((t) => this.frame(t));
  }

  private advance(): void {
    if (!this.plan) return;
    const t = this.raceTime();
    if (this.phase === "countdown" && t >= 0) this.setPhase("racing");
    if (this.phase === "racing" && isRaceOver(this.plan, t)) this.setPhase("finished");
    if (this.phase === "finished" && !this.resultsShown && t >= this.plan.totalSec + RESULTS_DELAY_SEC) {
      this.resultsShown = true;
      const outcome = this.outcome();
      if (outcome) this.emit("finished", outcome);
    }
  }

  private draw(dt: number, nowMs: number): void {
    const { ctx, stage } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#8a5a2b";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const s = stage.scale * stage.dpr;
    ctx.setTransform(s, 0, 0, s, stage.offsetX * stage.dpr, stage.offsetY * stage.dpr);

    const horses = this.horses();
    if (this.anims.length !== horses.length) this.anims = horses.map((_, i) => this.anims[i] ?? createAnim());

    const state: SceneState = {
      phase: this.phase,
      title: this.setup.title,
      horses,
      showNumbers: this.setup.showNumbers,
      // a running race keeps its own length even if the setup changes underneath it (H + a preset)
      durationSec: this.plan?.durationSec ?? this.setup.durationSec,
      plan: this.plan,
      raceTime: this.plan ? this.raceTime() : 0,
      countdownSec: this.countdownSec,
      ambientTime: (nowMs - this.startedAt) / 1000,
    };
    renderScene(ctx, stage, state, this.anims, dt);
  }
}
