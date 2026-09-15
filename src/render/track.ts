import { Rng } from "../core/rng";
import type { Stage, TrackLayout } from "./stage";
import { HUD_HEIGHT } from "./stage";
import { roundRect } from "./text";

const SKY_TOP = "#9fdcff";
const SKY_BOTTOM = "#dff5ff";
const HILL_FAR = "#8fd45c";
const HILL_NEAR = "#6dc23e";
const DIRT = "#c68a4a";
const DIRT_DARK = "#b27a3f";
const LANE_LINE = "rgba(255,255,255,0.28)";

interface Speck {
  x: number;
  y: number;
  r: number;
  dark: boolean;
}

let speckCache: { key: string; specks: Speck[] } | null = null;

function specksFor(stage: Stage, track: TrackLayout): Speck[] {
  const key = `${stage.width}:${track.top}:${track.laneHeight}:${track.lanes}`;
  if (speckCache && speckCache.key === key) return speckCache.specks;
  const rng = new Rng(1234);
  const specks: Speck[] = [];
  const bottom = track.top + track.laneHeight * track.lanes;
  for (let i = 0; i < 260; i++) {
    specks.push({
      x: rng.range(0, stage.width),
      y: rng.range(HUD_HEIGHT, bottom + 40),
      r: rng.range(1.2, 3.2),
      dark: rng.next() < 0.6,
    });
  }
  speckCache = { key, specks };
  return specks;
}

/** Sky, sun, hills, fence: everything above the dirt. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, stage: Stage, timeSec: number): void {
  const horizon = HUD_HEIGHT - 10;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 60);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, stage.width, horizon + 60);

  // sun with slowly rotating rays
  const sunX = 150;
  const sunY = 40;
  ctx.save();
  ctx.translate(sunX, sunY);
  ctx.rotate(timeSec * 0.08);
  ctx.fillStyle = "rgba(255, 245, 120, 0.35)";
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(260, -22);
    ctx.lineTo(260, 22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#fff35c";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 78, 0, Math.PI * 2);
  ctx.fill();

  // clouds
  drawCloud(ctx, ((timeSec * 6) % (stage.width + 400)) - 200, 62, 1);
  drawCloud(ctx, ((timeSec * 4 + 900) % (stage.width + 400)) - 200, 30, 0.7);

  // hills
  ctx.fillStyle = HILL_FAR;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 60);
  for (let x = 0; x <= stage.width; x += 40) {
    ctx.lineTo(x, horizon + 12 - 40 * Math.abs(Math.sin(x / 330 + 1)));
  }
  ctx.lineTo(stage.width, horizon + 60);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = HILL_NEAR;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 60);
  for (let x = 0; x <= stage.width; x += 40) {
    ctx.lineTo(x, horizon + 32 - 26 * Math.abs(Math.sin(x / 210 + 2.2)));
  }
  ctx.lineTo(stage.width, horizon + 60);
  ctx.closePath();
  ctx.fill();

  // white fence along the horizon
  const fenceY = horizon + 34;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  for (const dy of [0, 12]) {
    ctx.beginPath();
    ctx.moveTo(0, fenceY + dy);
    ctx.lineTo(stage.width, fenceY + dy);
    ctx.stroke();
  }
  for (let x = 30; x < stage.width; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, fenceY - 8);
    ctx.lineTo(x, fenceY + 24);
    ctx.stroke();
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (const [dx, dy, r] of [
    [0, 0, 26],
    [28, -10, 30],
    [58, 0, 24],
    [30, 12, 22],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Dirt, lanes, start and finish lines. */
export function drawTrack(ctx: CanvasRenderingContext2D, stage: Stage, track: TrackLayout): void {
  const dirtTop = HUD_HEIGHT + 20;
  ctx.fillStyle = DIRT;
  ctx.fillRect(0, dirtTop, stage.width, stage.height - dirtTop);

  for (const s of specksFor(stage, track)) {
    ctx.fillStyle = s.dark ? "rgba(90,50,20,0.18)" : "rgba(255,230,190,0.25)";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // lane separators
  ctx.strokeStyle = LANE_LINE;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 14]);
  for (let i = 1; i < track.lanes; i++) {
    const y = track.top + track.laneHeight * i;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(stage.width - 40, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const laneTop = track.top - 6;
  const laneBottom = track.top + track.laneHeight * track.lanes + 6;

  // start line
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(track.startX - 3, laneTop, 6, laneBottom - laneTop);

  // finish line: checkered band
  const bandW = 26;
  const cell = 13;
  for (let y = laneTop; y < laneBottom; y += cell) {
    for (let cx = 0; cx < 2; cx++) {
      const dark = (Math.floor((y - laneTop) / cell) + cx) % 2 === 0;
      ctx.fillStyle = dark ? "#222" : "#fff";
      ctx.fillRect(track.finishX - bandW / 2 + cx * cell, y, cell, Math.min(cell, laneBottom - y));
    }
  }

  // finish post + flag
  ctx.fillStyle = "#fff";
  ctx.fillRect(track.finishX - 4, laneTop - 46, 8, 46);
  ctx.fillStyle = "#e8352b";
  ctx.beginPath();
  ctx.moveTo(track.finishX + 4, laneTop - 46);
  ctx.lineTo(track.finishX + 74, laneTop - 32);
  ctx.lineTo(track.finishX + 4, laneTop - 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "700 14px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("FINISH", track.finishX + 12, laneTop - 32);

  // darker rail at the bottom
  ctx.fillStyle = DIRT_DARK;
  ctx.fillRect(0, stage.height - 14, stage.width, 14);
}

/** The wooden sign board that holds the race title and the clock. */
export function drawSignBoard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = "#f7f4ea";
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x, y, w, h, 18);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#3a2a1a";
  ctx.stroke();
}
