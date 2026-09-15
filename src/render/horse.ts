import { contrastText, shade } from "../core/palette";
import { DISPLAY_FONT_STACK, font } from "./text";

export interface HorsePose {
  /** hoof-level ground position of the horse's body centre */
  x: number;
  y: number;
  scale: number;
  color: string;
  /** gallop phase in radians; advances with distance travelled */
  phase: number;
  /** 0 = standing, ~1 = average race speed, >1 sprinting */
  speed: number;
  /** race number to print on the saddle cloth; omitted = blank cloth */
  number?: number | undefined;
  /** seconds, used for idle breathing / tail swish */
  time: number;
}

const OUTLINE = "#2a1f16";
const OUTLINE_WIDTH = 2.6;

interface Leg {
  baseX: number;
  offset: number;
  near: boolean;
  hind: boolean;
}

// Drawing order matters: far legs first, then body, then near legs? No: in this cartoon style all legs sit
// behind the body so their tops are hidden. Far legs are drawn darker for depth.
const LEGS: Leg[] = [
  { baseX: -20, offset: 0.55, near: false, hind: true },
  { baseX: 20, offset: Math.PI * 0.95 + 0.55, near: false, hind: false },
  { baseX: -14, offset: 0, near: true, hind: true },
  { baseX: 26, offset: Math.PI * 0.95, near: true, hind: false },
];

const UPPER = 17;
const LOWER = 17;

/**
 * Draws a horse facing right. Origin (0,0) is the ground under the body centre.
 * All coordinates are in "horse units" (about 90 wide, 95 tall at scale 1).
 */
export function drawHorse(ctx: CanvasRenderingContext2D, pose: HorsePose): void {
  const coat = pose.color;
  const dark = shade(coat, 0.55);
  const farCoat = shade(coat, 0.78);
  const running = pose.speed > 0.05;
  const ph = pose.phase;
  const idleBob = running ? 0 : Math.sin(pose.time * 2.2) * 0.8;
  const bob = running ? Math.sin(ph + Math.PI / 2) * 3.2 * Math.min(1.4, pose.speed) : idleBob;
  const pitch = running ? Math.sin(ph) * 0.05 * Math.min(1.4, pose.speed) : 0;

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.scale(pose.scale, pose.scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // legs (behind the body)
  for (const leg of LEGS) {
    const legPhase = ph + leg.offset;
    let upper: number;
    let lower: number;
    if (running) {
      const swing = Math.sin(legPhase);
      const lift = Math.max(0, Math.cos(legPhase));
      upper = 0.75 * swing * (leg.hind ? 1 : 0.9);
      lower = (leg.hind ? -0.55 : -1.15) * lift;
      if (leg.hind) upper += 0.15; // hind legs trail a little
    } else {
      upper = leg.hind ? 0.12 : -0.08;
      lower = leg.hind ? -0.1 : 0.02;
    }
    drawLeg(ctx, leg.baseX, -32 + bob, upper, lower, leg.near ? coat : farCoat, dark);
  }

  // tail
  const tailWave = running ? Math.sin(ph * 1.0 + 0.8) * 8 : Math.sin(pose.time * 1.6) * 4;
  ctx.beginPath();
  ctx.moveTo(-30, -44 + bob);
  ctx.quadraticCurveTo(-52, -46 + bob + tailWave * 0.5, -56, -22 + bob + tailWave);
  ctx.lineWidth = 9 + OUTLINE_WIDTH * 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 9;
  ctx.strokeStyle = dark;
  ctx.stroke();

  // body
  ctx.save();
  ctx.translate(0, -40 + bob);
  ctx.rotate(-pitch);
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 17, 0, 0, Math.PI * 2);
  ctx.fillStyle = coat;
  ctx.fill();
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // belly highlight
  ctx.beginPath();
  ctx.ellipse(-4, 7, 20, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fill();
  ctx.restore();

  // neck
  const headLift = running ? Math.sin(ph + 1.2) * 2.5 : 0;
  const neck = [
    [16, -52 + bob],
    [30, -78 + bob + headLift],
    [44, -76 + bob + headLift],
    [30, -40 + bob],
  ] as const;
  ctx.beginPath();
  ctx.moveTo(neck[0][0], neck[0][1]);
  for (const [nx, ny] of neck.slice(1)) ctx.lineTo(nx, ny);
  ctx.closePath();
  ctx.fillStyle = coat;
  ctx.fill();
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // mane: tufts along the neck's top edge
  ctx.fillStyle = dark;
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const mx = 16 + (30 - 16) * t + 2;
    const my = -52 + bob + (-78 + headLift - -52) * t;
    ctx.beginPath();
    ctx.moveTo(mx - 6, my + 3);
    ctx.quadraticCurveTo(mx - 10, my - 8, mx - 1, my - 9);
    ctx.quadraticCurveTo(mx + 3, my - 3, mx + 4, my + 5);
    ctx.closePath();
    ctx.fill();
  }

  // head
  const hx = 46;
  const hy = -80 + bob + headLift;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(0.35);
  ctx.beginPath();
  ctx.ellipse(6, 4, 17, 9.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = coat;
  ctx.fill();
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // muzzle
  ctx.beginPath();
  ctx.arc(20, 6, 7, 0, Math.PI * 2);
  ctx.fillStyle = shade(coat, 1.35);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(23, 4, 1.4, 0, Math.PI * 2);
  ctx.fill();
  // ears
  for (const ex of [-6, 1]) {
    ctx.beginPath();
    ctx.moveTo(ex, -4);
    ctx.lineTo(ex + 3, -16);
    ctx.lineTo(ex + 8, -5);
    ctx.closePath();
    ctx.fillStyle = coat;
    ctx.fill();
    ctx.stroke();
  }
  // eye
  ctx.beginPath();
  ctx.arc(9, 0, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(10, 0, 1.6, 0, Math.PI * 2);
  ctx.fillStyle = OUTLINE;
  ctx.fill();
  ctx.restore();

  // saddle cloth with number
  ctx.save();
  ctx.translate(0, -40 + bob);
  ctx.rotate(-pitch);
  ctx.beginPath();
  ctx.moveTo(-14, -14);
  ctx.lineTo(12, -14);
  ctx.lineTo(14, 6);
  ctx.lineTo(-12, 8);
  ctx.closePath();
  ctx.fillStyle = "#fbfbf7";
  ctx.fill();
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  if (pose.number !== undefined) {
    ctx.fillStyle = contrastText("#fbfbf7");
    ctx.font = font(15, 800, DISPLAY_FONT_STACK);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(pose.number), 0, -3);
  }
  ctx.restore();

  ctx.restore();
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  upperAngle: number,
  lowerAngle: number,
  coat: string,
  hoof: string,
): void {
  const kneeX = baseX + Math.sin(upperAngle) * UPPER;
  const kneeY = baseY + Math.cos(upperAngle) * UPPER;
  const a2 = upperAngle + lowerAngle;
  const hoofX = kneeX + Math.sin(a2) * LOWER;
  const hoofY = kneeY + Math.cos(a2) * LOWER;

  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(kneeX, kneeY);
  ctx.lineTo(hoofX, hoofY);
  ctx.lineWidth = 8 + OUTLINE_WIDTH * 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.strokeStyle = coat;
  ctx.stroke();

  // hoof
  ctx.save();
  ctx.translate(hoofX, hoofY);
  ctx.rotate(a2);
  ctx.beginPath();
  ctx.ellipse(0, 2, 5.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = hoof;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.restore();
}
