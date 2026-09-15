import { Rng } from "./rng";

/** Precomputed progress samples per second. 60 keeps lookups cheap and curves smooth at any frame rate. */
export const SAMPLE_RATE = 60;

/** How far past the finish line a horse keeps running, in track units (track length = 1). */
export const OVERRUN_UNITS = 0.11;
const OVERRUN_TAU_SEC = 0.9;

export interface HorseSpec {
  name: string;
  /** #rrggbb */
  color: string;
}

export interface RaceConfig {
  title: string;
  durationSec: number;
  horses: HorseSpec[];
  showNumbers: boolean;
}

export interface RacePlan {
  seed: number;
  horseCount: number;
  /** Seconds until the winner crosses the line. */
  durationSec: number;
  /** Horse indices, winner first. This *is* the random draw; the animation just reveals it. */
  finishOrder: number[];
  /** Indexed by horse: seconds when that horse crosses the line. */
  finishTimes: number[];
  /** Seconds when the last horse crosses. */
  totalSec: number;
  /** Indexed by horse: running style that shaped its curve (cosmetic, the order above is the draw). */
  roles: PaceRole[];
  /** Indexed by horse: progress samples in [0,1] at k / SAMPLE_RATE, first 0, last exactly 1. */
  curves: Float32Array[];
}

export interface RaceResult {
  place: number; // 1-based
  horse: number; // horse index
  timeSec: number;
}

export interface PlanOptions {
  /** Seconds between the winner and the last horse. Default: finishSpreadSec(). */
  spreadSec?: number;
}

/**
 * Running styles, like real horses have. They shape *how* a horse gets to its drawn finish time,
 * never *whether*: frontrunners break fast and fade, closers sit back and kick late, stalkers sit
 * just off the pace. The eventual winner is usually a stalker or a closer, so the early leader is
 * more often than not somebody else, and one horse is always sent to the front to set the pace.
 */
export type PaceRole = "frontrunner" | "stalker" | "closer";

const WINNER_ROLE_WEIGHTS: [PaceRole, number][] = [
  ["frontrunner", 0.25],
  ["stalker", 0.4],
  ["closer", 0.35],
];
const FIELD_ROLE_WEIGHTS: [PaceRole, number][] = [
  ["frontrunner", 0.1],
  ["stalker", 0.45],
  ["closer", 0.45],
];

/** How far behind the winner the last horse crosses, before per-race variation (~6 % of the race, plus a little per horse). */
export function finishSpreadSec(durationSec: number, horseCount: number): number {
  return Math.min(8, Math.max(1.2, durationSec * 0.06 + 0.12 * (horseCount - 1)));
}

/**
 * Draw the result up front (a fair shuffle), then build a smooth, strictly increasing
 * progress curve per horse that reaches 1 exactly at that horse's finish time.
 * Because every curve is normalised against its own total, lead changes mid-race are
 * free to happen without ever contradicting the drawn order.
 */
export function planRace(horseCount: number, durationSec: number, seed: number, options: PlanOptions = {}): RacePlan {
  if (!Number.isInteger(horseCount) || horseCount < 1) throw new Error("planRace: need at least one horse");
  if (!(durationSec > 0)) throw new Error("planRace: duration must be positive");

  const rng = new Rng(seed);
  const finishOrder = rng.shuffle(Array.from({ length: horseCount }, (_, i) => i));

  // Finish times: the drawn gaps are random but always add up to the spread (±10 %), with the
  // front of the field allowed to be tighter (photo finishes happen) than the back.
  const spread = (options.spreadSec ?? finishSpreadSec(durationSec, horseCount)) * rng.range(0.9, 1.1);
  const finishTimes = new Array<number>(horseCount).fill(durationSec);
  if (horseCount > 1) {
    const weights = Array.from({ length: horseCount - 1 }, (_, k) => rng.range(k === 0 ? 0.25 : 0.5, 1.6));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    let t = durationSec;
    for (let k = 1; k < horseCount; k++) {
      t += (spread * (weights[k - 1] as number)) / weightSum;
      finishTimes[finishOrder[k] as number] = t;
    }
  }

  const roles = new Array<PaceRole | undefined>(horseCount).fill(undefined);
  roles[finishOrder[0] as number] = pickWeighted(rng, WINNER_ROLE_WEIGHTS);
  if (horseCount >= 3) roles[rng.pick(finishOrder.slice(1))] = "frontrunner"; // the pace-setter
  const finalRoles = roles.map((r) => r ?? pickWeighted(rng, FIELD_ROLE_WEIGHTS));

  const curves: Float32Array[] = [];
  for (let h = 0; h < horseCount; h++) {
    curves.push(buildCurve(rng, finishTimes[h] as number, finalRoles[h] as PaceRole));
  }

  return {
    seed,
    horseCount,
    durationSec,
    finishOrder,
    finishTimes,
    totalSec: Math.max(...finishTimes),
    roles: finalRoles,
    curves,
  };
}

function pickWeighted<T>(rng: Rng, weighted: readonly [T, number][]): T {
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let x = rng.range(0, total);
  for (const [item, w] of weighted) {
    x -= w;
    if (x <= 0) return item;
  }
  return (weighted[weighted.length - 1] as [T, number])[0];
}

/** 0 below `a`, 1 above `b`, smooth in between. */
function smoothstep(a: number, b: number, x: number): number {
  const r = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return r * r * (3 - 2 * r);
}

/** Longest a horse takes to reach racing speed out of the gate. */
export const MAX_GATE_BREAK_SEC = 3;

/**
 * Speed profile of one horse over its race, then integrated and normalised to reach exactly 1
 * at its finish time. In order of appearance:
 *   gate break  – from standstill to racing speed over ~2–4 s (shorter in very short races);
 *                 fast and slow breakers exist
 *   drift       – three slow waves (1.5–5 cycles per race), so gaps open and close all race long
 *   moves       – one to three surges or lulls at random points
 *   style       – frontrunners carry extra early pace that fades from the half-way mark,
 *                 closers start easy, and everyone kicks in the final stretch (closers hardest)
 * The speed never drops below 12 % of pace once the horse is going, so nobody ever stops.
 */
function buildCurve(rng: Rng, finishTime: number, role: PaceRole): Float32Array {
  const T = finishTime;
  const breakSec = Math.min(MAX_GATE_BREAK_SEC, Math.max(0.5, T * 0.16)) * rng.range(0.8, 1.3);

  const waves = Array.from({ length: 3 }, () => ({
    amp: rng.range(0.4, 1),
    cycles: rng.range(1.5, 5),
    phase: rng.range(0, 2 * Math.PI),
  }));
  const ampSum = waves.reduce((s, w) => s + w.amp, 0);
  const moves = Array.from({ length: rng.int(1, 3) }, () => ({
    center: rng.range(0.15, 0.85),
    width: rng.range(0.05, 0.14),
    amp: rng.range(0.12, 0.35) * (rng.next() < 0.5 ? -1 : 1),
  }));

  let early: number;
  let fade: number;
  let kick: number;
  switch (role) {
    case "frontrunner":
      early = rng.range(0.08, 0.18);
      fade = -rng.range(0.05, 0.15);
      kick = rng.range(0.04, 0.12);
      break;
    case "closer":
      early = -rng.range(0.06, 0.14);
      fade = 0;
      kick = rng.range(0.2, 0.34);
      break;
    default:
      early = rng.range(-0.04, 0.04);
      fade = 0;
      kick = rng.range(0.12, 0.22);
  }

  const speedAt = (t: number): number => {
    const u = t / T;
    let v = 1;
    let s = 0;
    for (const w of waves) s += w.amp * Math.sin(2 * Math.PI * w.cycles * u + w.phase);
    v += 0.25 * (s / ampSum);
    for (const m of moves) {
      const d = (u - m.center) / m.width;
      v += m.amp * Math.exp(-d * d);
    }
    v += early * (1 - smoothstep(0.45, 0.75, u));
    v += fade * smoothstep(0.6, 0.95, u);
    v += kick * smoothstep(0.7, 0.86, u);
    v = Math.max(0.12, v);
    return v * smoothstep(0, breakSec, t);
  };

  const samples = Math.ceil(T * SAMPLE_RATE) + 1;
  const dt = 1 / SAMPLE_RATE;
  const curve = new Float32Array(samples);
  let acc = 0;
  let prev = speedAt(0);
  curve[0] = 0;
  for (let k = 1; k < samples; k++) {
    const time = Math.min(k * dt, T);
    const cur = speedAt(time);
    acc += 0.5 * (prev + cur) * (time - (k - 1) * dt);
    curve[k] = acc;
    prev = cur;
  }
  const total = acc;
  for (let k = 0; k < samples; k++) curve[k] = (curve[k] as number) / total;
  curve[samples - 1] = 1;
  return curve;
}

/** Progress along the track in [0, 1]; 1 means on the finish line. */
export function progressAt(plan: RacePlan, horse: number, t: number): number {
  const finish = plan.finishTimes[horse];
  const curve = plan.curves[horse];
  if (finish === undefined || curve === undefined) throw new Error(`progressAt: no horse ${horse}`);
  if (t <= 0) return 0;
  if (t >= finish) return 1;
  const x = t * SAMPLE_RATE;
  const k = Math.floor(x);
  const frac = x - k;
  const a = curve[Math.min(k, curve.length - 1)] as number;
  const b = curve[Math.min(k + 1, curve.length - 1)] as number;
  return Math.min(1, a + (b - a) * frac);
}

/** Like progressAt but keeps running (and slowing down) past the line, so the finish looks natural. */
export function trackPositionAt(plan: RacePlan, horse: number, t: number): number {
  const finish = plan.finishTimes[horse] as number;
  if (t <= finish) return progressAt(plan, horse, t);
  const over = t - finish;
  return 1 + OVERRUN_UNITS * (1 - Math.exp(-over / OVERRUN_TAU_SEC));
}

/**
 * Instantaneous speed relative to the horse's own average race speed (1.0 = average).
 * Used to drive the gallop cadence; drops towards 0 after the line.
 */
export function speedAt(plan: RacePlan, horse: number, t: number): number {
  const finish = plan.finishTimes[horse] as number;
  const dt = 1 / SAMPLE_RATE;
  const a = trackPositionAt(plan, horse, Math.max(0, t - dt / 2));
  const b = trackPositionAt(plan, horse, Math.max(0, t + dt / 2));
  const avg = 1 / finish;
  return (b - a) / dt / avg;
}

export function hasFinished(plan: RacePlan, horse: number, t: number): boolean {
  return t >= (plan.finishTimes[horse] as number);
}

export function isRaceOver(plan: RacePlan, t: number): boolean {
  return t >= plan.totalSec;
}

export function winnerOf(plan: RacePlan): number {
  return plan.finishOrder[0] as number;
}

export function results(plan: RacePlan): RaceResult[] {
  return plan.finishOrder.map((horse, i) => ({ place: i + 1, horse, timeSec: plan.finishTimes[horse] as number }));
}

/** Current standings at time t (leader first). Ties broken by drawn finish order. */
export function standingsAt(plan: RacePlan, t: number): number[] {
  const rank = new Map(plan.finishOrder.map((h, i) => [h, i]));
  return Array.from({ length: plan.horseCount }, (_, i) => i).sort((a, b) => {
    const d = trackPositionAt(plan, b, t) - trackPositionAt(plan, a, t);
    if (Math.abs(d) > 1e-9) return d;
    return (rank.get(a) as number) - (rank.get(b) as number);
  });
}
