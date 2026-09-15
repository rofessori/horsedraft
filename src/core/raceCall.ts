import type { RacePlan } from "./race";
import { progressAt, speedAt, standingsAt } from "./race";

/**
 * A line of commentary for the sign board, derived purely from the plan and the race clock, so
 * it is deterministic per seed and can be unit-tested. Kinds, in priority order:
 *   off      first moments after the gun
 *   photo    the first two cross within PHOTO_FINISH_SEC of each other (after the winner crosses)
 *   lead     the leader changed within the last LEAD_CALL_SEC
 *   stretch  the field just entered the final stretch (last quarter), leader named
 *   move     somebody outside the lead is running well above pace; chosen once per MOVE_CALL_SEC
 *            window so the chip does not flicker between horses
 *   stretch  later in the stretch with nothing else to say: who leads
 *   none     nothing to say (before the gun, or after the winner crossed)
 */
export type RaceCallKind = "off" | "lead" | "move" | "stretch" | "photo" | "none";

export interface RaceCall {
  kind: RaceCallKind;
  text: string;
}

export interface LeadChange {
  /** seconds after the gun */
  t: number;
  /** the new leader (horse index) */
  horse: number;
}

const LEAD_STEP_SEC = 0.25;
const LEAD_CALL_SEC = 3;
/** Relative speed (1 = the horse's own average) above which a non-leader is "making a move". */
export const MOVE_SPEED = 1.3;
/** A move call is decided at the start of each window this long and held for the whole window. */
export const MOVE_CALL_SEC = 3;
const STRETCH_FRACTION = 0.75;
const STRETCH_CALL_SEC = 3;
const PHOTO_FINISH_SEC = 0.3;
const NONE: RaceCall = { kind: "none", text: "" };

const leadCache = new WeakMap<RacePlan, LeadChange[]>();

/** Every moment the leader changed, sampled at LEAD_STEP_SEC, memoised per plan. */
export function leadChanges(plan: RacePlan): LeadChange[] {
  const cached = leadCache.get(plan);
  if (cached) return cached;
  const out: LeadChange[] = [];
  let leader = standingsAt(plan, LEAD_STEP_SEC)[0] as number;
  for (let t = 2 * LEAD_STEP_SEC; t <= plan.durationSec; t += LEAD_STEP_SEC) {
    const now = standingsAt(plan, t)[0] as number;
    if (now !== leader) {
      out.push({ t, horse: now });
      leader = now;
    }
  }
  leadCache.set(plan, out);
  return out;
}

export function raceCallAt(plan: RacePlan, names: readonly string[], t: number): RaceCall {
  if (t < 0) return NONE;
  const name = (h: number): string => names[h] ?? `#${h + 1}`;
  const D = plan.durationSec;

  if (t >= D) {
    const second = plan.finishOrder[1];
    if (second !== undefined && (plan.finishTimes[second] as number) - D < PHOTO_FINISH_SEC) {
      return { kind: "photo", text: "Photo finish!" };
    }
    return NONE;
  }

  const offSec = Math.min(4, Math.max(1.5, D * 0.05));
  if (t < offSec) return { kind: "off", text: "And they're off!" };

  const standings = standingsAt(plan, t);
  const leader = standings[0] as number;
  const recent = leadChanges(plan).filter((c) => c.t <= t && t - c.t < LEAD_CALL_SEC);
  const last = recent[recent.length - 1];
  const inStretch = t >= STRETCH_FRACTION * D;
  if (last) {
    return { kind: "lead", text: inStretch ? `${name(last.horse)} takes the lead in the stretch!` : `${name(last.horse)} takes the lead!` };
  }
  if (inStretch && t < STRETCH_FRACTION * D + STRETCH_CALL_SEC) return { kind: "stretch", text: `Final stretch! ${name(leader)} leads` };

  // evaluated at the window start: a lead change since then would already have returned above
  const tw = Math.max(offSec, Math.floor(t / MOVE_CALL_SEC) * MOVE_CALL_SEC);
  const leaderAtWindow = standingsAt(plan, tw)[0] as number;
  let mover = -1;
  let moverSpeed = MOVE_SPEED;
  for (let h = 0; h < plan.horseCount; h++) {
    if (h === leaderAtWindow || progressAt(plan, h, tw) >= 1) continue;
    const v = speedAt(plan, h, tw);
    if (v > moverSpeed) {
      mover = h;
      moverSpeed = v;
    }
  }
  if (mover >= 0) return { kind: "move", text: `${name(mover)} is making a move!` };

  if (inStretch) return { kind: "stretch", text: `${name(leader)} leads` };
  return NONE;
}
