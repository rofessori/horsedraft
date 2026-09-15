/**
 * The scene is drawn in "logical" pixels on a stage that is always 1080 tall.
 * The width follows the window's aspect ratio (within limits) so a 16:9 OBS canvas,
 * a 16:10 MacBook screen, or a tall window all look right without letterboxing.
 */
export const STAGE_HEIGHT = 1080;
export const MIN_STAGE_WIDTH = 1280;
export const MAX_STAGE_WIDTH = 2800;

export interface Stage {
  /** logical width */
  width: number;
  /** logical height (always STAGE_HEIGHT) */
  height: number;
  /** logical -> css pixels */
  scale: number;
  /** css offset of the stage inside the canvas (letterboxing when the width is clamped) */
  offsetX: number;
  offsetY: number;
  dpr: number;
}

export function layoutStage(cssWidth: number, cssHeight: number, dpr: number): Stage {
  const aspect = cssWidth / Math.max(1, cssHeight);
  const width = Math.round(Math.min(MAX_STAGE_WIDTH, Math.max(MIN_STAGE_WIDTH, STAGE_HEIGHT * aspect)));
  const scale = Math.min(cssWidth / width, cssHeight / STAGE_HEIGHT);
  return {
    width,
    height: STAGE_HEIGHT,
    scale,
    offsetX: (cssWidth - width * scale) / 2,
    offsetY: (cssHeight - STAGE_HEIGHT * scale) / 2,
    dpr,
  };
}

export interface TrackLayout {
  lanes: number;
  /** y of the first lane's top edge */
  top: number;
  laneHeight: number;
  /** x where horses start (nose on the line) */
  startX: number;
  /** x of the finish line */
  finishX: number;
  horseScale: number;
}

export const HUD_HEIGHT = 150;
const TRACK_BOTTOM_MARGIN = 26;
const MAX_LANE_HEIGHT = 132;
// A horse is ~96 units tall (ground to ear tips); keep it inside its lane for normal fields
// and let it overlap neighbours a little only when lanes get very thin (20 horses).
const LANE_UNITS_PER_SCALE = 100;
const MIN_HORSE_SCALE = 0.55;
const MAX_HORSE_SCALE = 1.25;

export function layoutTrack(stage: Stage, lanes: number): TrackLayout {
  const n = Math.max(1, lanes);
  const areaTop = HUD_HEIGHT + 10;
  const areaBottom = stage.height - TRACK_BOTTOM_MARGIN;
  const laneHeight = Math.min(MAX_LANE_HEIGHT, (areaBottom - areaTop) / n);
  const top = areaTop + (areaBottom - areaTop - laneHeight * n) / 2;
  return {
    lanes: n,
    top,
    laneHeight,
    startX: 340,
    finishX: stage.width - 250,
    horseScale: Math.min(MAX_HORSE_SCALE, Math.max(MIN_HORSE_SCALE, laneHeight / LANE_UNITS_PER_SCALE)),
  };
}

/** Ground line (hoof level) for lane i. */
export function laneGroundY(track: TrackLayout, lane: number): number {
  return track.top + track.laneHeight * (lane + 0.86);
}

export function laneCenterY(track: TrackLayout, lane: number): number {
  return track.top + track.laneHeight * (lane + 0.5);
}
