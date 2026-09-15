import { Rng } from "./rng";

/** Distinct, cartoon-friendly coat colours. Order matters: the first N are used when nothing is shuffled. */
export const PALETTE: readonly string[] = [
  "#e6194b", // red
  "#4363d8", // blue
  "#3cb44b", // green
  "#ffe119", // yellow
  "#f58231", // orange
  "#911eb4", // purple
  "#42d4f4", // cyan
  "#f032e6", // magenta
  "#bfef45", // lime
  "#fabed4", // pink
  "#469990", // teal
  "#dcbeff", // lavender
  "#9a6324", // brown
  "#fffac8", // cream
  "#800000", // maroon
  "#aaffc3", // mint
  "#808000", // olive
  "#ffd8b1", // apricot
  "#000075", // navy
  "#a9a9a9", // grey
  "#ffffff", // white
  "#5c4033", // dark chocolate
  "#ff7f50", // coral
  "#2e8b57", // sea green
];

const HEX_RE = /^#([0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

export function normalizeHex(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    const [, r, g, b] = v;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (!isHexColor(v)) throw new Error(`Not a colour: ${value}`);
  return v.toLowerCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = normalizeHex(hex).slice(1);
  return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** factor < 1 darkens, > 1 lightens (towards white). */
export function shade(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  if (factor <= 1) return rgbToHex(r * factor, g * factor, b * factor);
  const t = Math.min(1, factor - 1);
  return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

/** Relative luminance 0..1 (sRGB, WCAG). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Black or white, whichever reads better on the given colour. */
export function contrastText(hex: string): "#000000" | "#ffffff" {
  return luminance(hex) > 0.4 ? "#000000" : "#ffffff";
}

export function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/**
 * N distinct colours: a shuffled palette first, then evenly spaced hues if N exceeds it.
 * Colours are never repeated within one race so every horse is identifiable.
 */
export function assignRandomColors(count: number, rng: Rng): string[] {
  const base = rng.shuffle(PALETTE);
  const out = base.slice(0, count);
  let hue = rng.range(0, 360);
  while (out.length < count) {
    hue = (hue + 137.508) % 360; // golden angle keeps neighbours apart
    out.push(hslToHex(hue, 0.75, 0.55));
  }
  return out;
}

/** A single random colour that is not already in `taken` (best effort). */
export function randomColor(rng: Rng, taken: readonly string[] = []): string {
  const free = PALETTE.filter((c) => !taken.includes(c));
  if (free.length > 0) return rng.pick(free);
  return hslToHex(rng.range(0, 360), 0.75, 0.55);
}
