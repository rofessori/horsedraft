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
  /** Indexed by horse: progress samples in [0,1] at k / SAMPLE_RATE, first 0, last exactly 1. */
  curves: Float32Array[];
}

export interface RaceResult {
  place: number; // 1-based
  horse: number; // horse index
  timeSec: number;
}

export interface PlanOptions {
  /** Max seconds between the winner and the last horse (default 2.5). */
  spreadSec?: number;
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

  const spread = options.spreadSec ?? 2.5;
  const gap = horseCount > 1 ? Math.min(0.4, spread / (horseCount - 1)) : 0;
  const finishTimes = new Array<number>(horseCount).fill(durationSec);
  let t = durationSec;
  for (let k = 1; k < horseCount; k++) {
    t += gap * rng.range(0.55, 1.45);
    finishTimes[finishOrder[k] as number] = t;
  }

  const curves: Float32Array[] = [];
  for (let h = 0; h < horseCount; h++) {
    curves.push(buildCurve(rng, finishTimes[h] as number));
  }

  return {
    seed,
    horseCount,
    durationSec,
    finishOrder,
    finishTimes,
    totalSec: Math.max(...finishTimes),
    curves,
  };
}

/** Speed profile = slow sinusoidal drift + one or two random bursts, always > 0, then integrated and normalised. */
function buildCurve(rng: Rng, finishTime: number): Float32Array {
  const waves = Array.from({ length: 3 }, () => ({
    amp: rng.range(0.5, 1),
    omega: 2 * Math.PI * rng.range(0.08, 0.5),
    phase: rng.range(0, 2 * Math.PI),
  }));
  const ampSum = waves.reduce((s, w) => s + w.amp, 0);
  const bursts = Array.from({ length: rng.int(1, 2) }, () => ({
    center: rng.range(0.15, 0.9) * finishTime,
    width: rng.range(0.6, 2.0),
    amp: rng.range(0.2, 0.6) * (rng.next() < 0.5 ? -1 : 1),
  }));

  const speedAt = (t: number): number => {
    let s = 0;
    for (const w of waves) s += w.amp * Math.sin(w.omega * t + w.phase);
    let v = 1 + 0.5 * (s / ampSum);
    for (const b of bursts) {
      const d = (t - b.center) / b.width;
      v += b.amp * Math.exp(-d * d);
    }
    return Math.max(0.15, v);
  };

  const samples = Math.ceil(finishTime * SAMPLE_RATE) + 1;
  const dt = 1 / SAMPLE_RATE;
  const curve = new Float32Array(samples);
  let acc = 0;
  let prev = speedAt(0);
  curve[0] = 0;
  for (let k = 1; k < samples; k++) {
    const time = Math.min(k * dt, finishTime);
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
