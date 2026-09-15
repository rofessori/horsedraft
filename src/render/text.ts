export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

export const FONT_STACK = '"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const DISPLAY_FONT_STACK = '"Arial Rounded MT Bold", "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

export function font(size: number, weight: number | string = 700, family: string = FONT_STACK): string {
  return `${weight} ${Math.round(size)}px ${family}`;
}

/** Shrinks the font until the text fits `maxWidth`. Returns the font size used. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, minSize: number, weight = 700): number {
  let s = size;
  ctx.font = font(s, weight);
  while (s > minSize && ctx.measureText(text).width > maxWidth) {
    s -= 1;
    ctx.font = font(s, weight);
  }
  return s;
}

export interface PillOptions {
  fill: string;
  text: string;
  textColor: string;
  fontSize: number;
  paddingX?: number;
  outline?: string;
  align?: "left" | "right" | "center";
  /** Shrink the font (down to 60%) and then ellipsise so the pill never exceeds this width. */
  maxWidth?: number;
}

/** A rounded label; (x, y) is the anchor edge (depending on align) at vertical centre. Returns width. */
export function drawPill(ctx: CanvasRenderingContext2D, x: number, y: number, opts: PillOptions): number {
  const padX = opts.paddingX ?? opts.fontSize * 0.6;
  let text = opts.text;
  let size = opts.fontSize;
  ctx.font = font(size, 700);
  if (opts.maxWidth !== undefined) {
    const inner = opts.maxWidth - padX * 2;
    size = fitFont(ctx, text, inner, size, Math.ceil(opts.fontSize * 0.6));
    ctx.font = font(size, 700);
    while (text.length > 1 && ctx.measureText(text + "…").width > inner) text = text.slice(0, -1);
    if (text !== opts.text) text += "…";
  }
  const w = ctx.measureText(text).width + padX * 2;
  const h = opts.fontSize * 1.5;
  let left = x;
  if (opts.align === "right") left = x - w;
  else if (opts.align === "center") left = x - w / 2;
  roundRect(ctx, left, y - h / 2, w, h, h / 2);
  ctx.fillStyle = opts.fill;
  ctx.fill();
  if (opts.outline) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = opts.outline;
    ctx.stroke();
  }
  ctx.fillStyle = opts.textColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + padX, y + size * 0.05);
  return w;
}

export function ordinal(place: number): string {
  const mod100 = place % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${place}th`;
  switch (place % 10) {
    case 1:
      return `${place}st`;
    case 2:
      return `${place}nd`;
    case 3:
      return `${place}rd`;
    default:
      return `${place}th`;
  }
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const tenths = Math.floor((s * 10) % 10);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${tenths}`;
}
