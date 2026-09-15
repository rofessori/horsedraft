/**
 * Long races run on a track several screens long: the horses' progress (0..1) is spread over
 * `laps` screen-widths and the camera travels with the leader, so a surge or a lead change moves a
 * horse across the screen at something like real-race speed. Short races keep one lap, i.e. the
 * fixed view where the whole track is on screen. Pure functions; unit-tested.
 */
export const MAX_LAPS = 5;
/** Seconds of racing per screen-width of track. */
export const SEC_PER_LAP = 30;
/** Where the leader sits on screen while the camera follows: this fraction of the screen track. */
export const FOLLOW_FRACTION = 0.65;

export function worldLaps(durationSec: number): number {
  if (durationSec <= SEC_PER_LAP) return 1;
  return Math.min(MAX_LAPS, Math.max(2, Math.round(durationSec / SEC_PER_LAP)));
}

/** World x (in stage px, 0 at the start line) for a track position; past 1 the overrun is in screen units. */
export function worldX(position: number, laps: number, screenTrack: number): number {
  if (position <= 1) return position * laps * screenTrack;
  return laps * screenTrack + (position - 1) * screenTrack;
}

/** How far the world is shifted left: 0 at the start, following the leader, stopping when the finish line is on screen. */
export function cameraOffset(leaderWorldX: number, laps: number, screenTrack: number): number {
  const max = (laps - 1) * screenTrack;
  return Math.min(max, Math.max(0, leaderWorldX - FOLLOW_FRACTION * screenTrack));
}
