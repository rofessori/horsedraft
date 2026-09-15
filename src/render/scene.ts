import { contrastText, shade } from "../core/palette";
import type { HorseSpec, RacePlan } from "../core/race";
import { hasFinished, speedAt, trackPositionAt, winnerOf } from "../core/race";
import { raceCallAt } from "../core/raceCall";
import { cameraOffset, worldLaps, worldX } from "./camera";
import { drawHorse } from "./horse";
import { HUD_HEIGHT, laneCenterY, laneGroundY, layoutTrack, type Stage } from "./stage";
import { DISPLAY_FONT_STACK, drawPill, fitFont, font, formatClock, ordinal, roundRect } from "./text";
import { drawBackdrop, drawSignBoard, drawTrack } from "./track";

export type Phase = "setup" | "countdown" | "racing" | "finished";

export interface SceneState {
  phase: Phase;
  title: string;
  horses: HorseSpec[];
  showNumbers: boolean;
  durationSec: number;
  /** Present during countdown/racing/finished. */
  plan?: RacePlan | undefined;
  /** Race clock in seconds (0 at the gun). Negative during the countdown. */
  raceTime: number;
  /** Seconds the countdown lasts (for the big numbers). */
  countdownSec: number;
  /** Wall-clock seconds since the app started; drives ambient animation. */
  ambientTime: number;
}

/** Per-horse animation state that persists between frames (gallop phase, dust). */
export interface HorseAnim {
  phase: number;
  dust: Dust[];
}

/** A puff of dust; `x` is a world coordinate (stage px from the start line) so it stays on the ground while the camera moves. */
interface Dust {
  x: number;
  y: number;
  r: number;
  age: number;
  vx: number;
}

export function createAnim(): HorseAnim {
  return { phase: 0, dust: [] };
}

/** Gallop cadence at racing speed (a real gallop is ~2.2 strides per second). Tied to time, not to
 *  distance on screen, so a three-minute race still looks like galloping rather than slow motion. */
const STRIDES_PER_SEC = 2.2;
const PLACE_COLORS = ["#ffd23f", "#d9d9d9", "#d98c4a"];
/** Horses this far outside the stage (name pill included) are not drawn. */
const CULL_LEFT = 400;
const CULL_RIGHT = 200;
const CALL_FONT_SIZE = 21;
const CALL_MAX_WIDTH_FRACTION = 0.6;

export function renderScene(
  ctx: CanvasRenderingContext2D,
  stage: Stage,
  state: SceneState,
  anims: HorseAnim[],
  dtSec: number,
): void {
  const track = layoutTrack(stage, state.horses.length);
  const { plan } = state;
  const racing = state.phase === "racing" || state.phase === "finished";

  // world geometry: long races run over several screen-widths and the camera follows the leader
  const laps = worldLaps(state.durationSec);
  const screenTrack = track.finishX - track.startX;
  const positions = state.horses.map((_, i) => (plan && racing ? trackPositionAt(plan, i, state.raceTime) : 0));
  const leaderWorld = Math.max(0, ...positions.map((p) => worldX(p, laps, screenTrack)));
  const camera = plan && racing ? cameraOffset(leaderWorld, laps, screenTrack) : 0;
  const toScreen = (world: number): number => track.startX + world - camera;

  drawBackdrop(ctx, stage, state.ambientTime, camera);
  drawTrack(ctx, stage, track, camera, laps);

  // horses, bottom lane first so name pills of lower lanes never cover a horse above
  for (let i = state.horses.length - 1; i >= 0; i--) {
    const horse = state.horses[i] as HorseSpec;
    const anim = anims[i] ?? createAnim();
    anims[i] = anim;

    const pos = positions[i] as number;
    const speed = plan && racing ? speedAt(plan, i, state.raceTime) : 0;
    anim.phase += Math.min(1.6, speed) * STRIDES_PER_SEC * (2 * Math.PI) * dtSec;

    const world = worldX(pos, laps, screenTrack);
    const x = toScreen(world);
    const ground = laneGroundY(track, i);
    const cy = laneCenterY(track, i);

    // dust behind fast horses
    if (speed > 0.9 && dtSec > 0 && anim.dust.length < 14) {
      anim.dust.push({ x: world - 30 * track.horseScale, y: ground - 2, r: 4 + Math.random() * 5, age: 0, vx: -40 });
    }
    for (const d of anim.dust) {
      d.age += dtSec;
      d.x += d.vx * dtSec;
      d.r += 12 * dtSec;
      ctx.beginPath();
      ctx.arc(toScreen(d.x), d.y - d.age * 20, d.r * track.horseScale, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230,200,160,${Math.max(0, 0.5 - d.age * 0.9)})`;
      ctx.fill();
    }
    anim.dust = anim.dust.filter((d) => d.age < 0.6);

    // a horse that has dropped out of the picture (behind the camera) costs nothing to skip
    if (x < -CULL_LEFT || x > stage.width + CULL_RIGHT) continue;

    // name pill trails the horse, clear of the tail (tail tip is ~58 units behind the body centre)
    const pillSize = Math.max(13, Math.min(30, track.laneHeight * 0.42));
    const pillRight = x - 64 * track.horseScale;
    const pillWidth = drawPill(ctx, pillRight, cy, {
      fill: horse.color,
      text: horse.name,
      textColor: contrastText(horse.color),
      fontSize: pillSize,
      outline: shade(horse.color, 0.5),
      align: "right",
      maxWidth: 250,
    });

    drawHorse(ctx, {
      x,
      y: ground,
      scale: track.horseScale,
      color: horse.color,
      phase: anim.phase,
      speed,
      number: state.showNumbers ? i + 1 : undefined,
      time: state.ambientTime + i * 0.7,
    });

    // place badge once across the line; sits left of the name so it never leaves the stage
    if (plan && racing && hasFinished(plan, i, state.raceTime)) {
      const place = plan.finishOrder.indexOf(i) + 1;
      const badgeFill = PLACE_COLORS[place - 1] ?? "#ffffff";
      drawPill(ctx, pillRight - pillWidth - 10, cy, {
        fill: badgeFill,
        text: ordinal(place),
        textColor: "#222",
        fontSize: pillSize,
        outline: "#2a1f16",
        align: "right",
      });
    }
  }

  drawHud(ctx, stage, state);

  if (state.phase === "countdown") drawCountdown(ctx, stage, state);
  if (plan && racing && state.raceTime >= plan.durationSec) drawWinnerBanner(ctx, stage, state, plan);
}

function drawHud(ctx: CanvasRenderingContext2D, stage: Stage, state: SceneState): void {
  const boardW = Math.min(1100, stage.width - 320);
  const boardX = (stage.width - boardW) / 2;
  const boardY = 18;
  const boardH = HUD_HEIGHT - 44;
  drawSignBoard(ctx, boardX, boardY, boardW, boardH);

  const title = state.title.trim() || "HorseDraft";
  const size = fitFont(ctx, title, boardW * 0.55, 46, 20, 800);
  ctx.font = font(size, 800, DISPLAY_FONT_STACK);
  ctx.fillStyle = "#2a1f16";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(title, boardX + 30, boardY + boardH / 2);

  // race clock: runs from the gun and stops on the winner's time, like the one at the track
  let clock: string;
  let clockColor = "#2a1f16";
  if (state.phase === "setup" || state.phase === "countdown") clock = formatClock(0);
  else if (state.raceTime < state.durationSec) clock = formatClock(state.raceTime);
  else {
    clock = formatClock(state.durationSec);
    clockColor = "#c8261a";
  }
  ctx.font = font(54, 800, DISPLAY_FONT_STACK);
  ctx.textAlign = "right";
  ctx.fillStyle = clockColor;
  ctx.fillText(clock, boardX + boardW - 30, boardY + boardH / 2 + 2);

  // horse count / seed, small
  ctx.font = font(15, 600);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(42,31,22,0.55)";
  const seedText = state.plan ? `${state.horses.length} horses · seed ${state.plan.seed}` : `${state.horses.length} horses`;
  ctx.fillText(seedText, boardX + boardW - 30, boardY + boardH + 16);

  // the race call: one line of commentary on a chip hanging under the board
  if (state.plan && (state.phase === "racing" || state.phase === "finished")) {
    const call = raceCallAt(state.plan, state.horses.map((h) => h.name), state.raceTime);
    if (call.text) {
      drawPill(ctx, boardX + 24, boardY + boardH + 18, {
        fill: "#f7f4ea",
        text: call.text,
        textColor: "#2a1f16",
        fontSize: CALL_FONT_SIZE,
        outline: "#3a2a1a",
        align: "left",
        maxWidth: boardW * CALL_MAX_WIDTH_FRACTION,
      });
    }
  }
}

function drawCountdown(ctx: CanvasRenderingContext2D, stage: Stage, state: SceneState): void {
  const remaining = -state.raceTime; // e.g. 2.4
  const n = Math.ceil(remaining);
  const frac = remaining - Math.floor(remaining); // 1 -> 0 inside the second
  const label = n <= 0 ? "GO!" : String(n);
  const pop = 1 + 0.25 * frac;
  ctx.save();
  ctx.translate(stage.width / 2, stage.height / 2 + 40);
  ctx.scale(pop, pop);
  ctx.font = font(220, 900, DISPLAY_FONT_STACK);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 16;
  ctx.strokeStyle = "rgba(42,31,22,0.9)";
  ctx.strokeText(label, 0, 0);
  ctx.fillStyle = label === "GO!" ? "#5ad03a" : "#fff35c";
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function drawWinnerBanner(ctx: CanvasRenderingContext2D, stage: Stage, state: SceneState, plan: RacePlan): void {
  const winner = state.horses[winnerOf(plan)];
  if (!winner) return;
  const since = state.raceTime - plan.durationSec;
  const alpha = Math.min(1, since * 3);
  const slide = (1 - Math.min(1, since * 2.5)) * -60;
  const text = `🏆  ${winner.name} wins!`;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font(48, 900, DISPLAY_FONT_STACK);
  const w = Math.min(stage.width - 200, ctx.measureText(text).width + 80);
  const h = 88;
  const x = (stage.width - w) / 2;
  const y = HUD_HEIGHT + 24 + slide;
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, x, y, w, h, 24);
  ctx.fillStyle = winner.color;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#2a1f16";
  ctx.stroke();
  const size = fitFont(ctx, text, w - 60, 48, 22, 900);
  ctx.font = font(size, 900, DISPLAY_FONT_STACK);
  ctx.fillStyle = contrastText(winner.color);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, stage.width / 2, y + h / 2 + 2);
  ctx.restore();
}
