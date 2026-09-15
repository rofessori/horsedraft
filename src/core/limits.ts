/**
 * Product limits. Raising MAX_HORSES is supported by the engine and renderer
 * (lanes shrink to fit); the number here is a product decision, not a technical one.
 */
export const MIN_HORSES = 2;
export const MAX_HORSES = 20;

/**
 * Race length, in seconds until the winner crosses. It is only pacing: the draw is the same
 * whatever you pick. A real race over a mile and a quarter lasts about two minutes, hence the
 * default; races longer than ~30 s run on a track several screens long with a travelling camera.
 */
export const MIN_DURATION_SEC = 3;
export const MAX_DURATION_SEC = 600;
export const DEFAULT_DURATION_SEC = 120;
export const DURATION_PRESETS_SEC = [60, 90, 120, 180, 240, 300] as const;

export const MAX_NAME_LENGTH = 40;
export const MAX_TITLE_LENGTH = 60;

export function clampDuration(sec: number): number {
  if (!Number.isFinite(sec)) return DEFAULT_DURATION_SEC;
  return Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, Math.round(sec)));
}
