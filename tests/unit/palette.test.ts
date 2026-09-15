import { describe, expect, it } from "vitest";
import { Rng } from "../../src/core/rng";
import {
  PALETTE,
  assignRandomColors,
  contrastText,
  hexToRgb,
  isHexColor,
  normalizeHex,
  randomColor,
  rgbToHex,
  shade,
} from "../../src/core/palette";

describe("palette", () => {
  it("palette entries are valid, unique hex colours", () => {
    for (const c of PALETTE) expect(isHexColor(c)).toBe(true);
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
  });

  it("hex round trip and short form", () => {
    expect(hexToRgb("#ff8000")).toEqual({ r: 255, g: 128, b: 0 });
    expect(rgbToHex(255, 128, 0)).toBe("#ff8000");
    expect(normalizeHex("#F80")).toBe("#ff8800");
    expect(() => normalizeHex("red")).toThrow();
  });

  it("shade darkens and lightens", () => {
    expect(shade("#808080", 0.5)).toBe("#404040");
    expect(shade("#808080", 1.5)).toBe("#c0c0c0");
  });

  it("contrastText picks readable text", () => {
    expect(contrastText("#ffffff")).toBe("#000000");
    expect(contrastText("#000075")).toBe("#ffffff");
  });

  it("assignRandomColors gives N distinct colours even beyond the palette", () => {
    const n = PALETTE.length + 10;
    const colors = assignRandomColors(n, new Rng(1));
    expect(colors).toHaveLength(n);
    expect(new Set(colors).size).toBe(n);
    for (const c of colors) expect(isHexColor(c)).toBe(true);
  });

  it("randomColor avoids taken colours when possible", () => {
    const taken = PALETTE.slice(0, PALETTE.length - 1);
    const c = randomColor(new Rng(5), taken);
    expect(c).toBe(PALETTE[PALETTE.length - 1]);
  });
});
