import { describe, expect, it } from "vitest";
import { cameraOffset, worldLaps, worldX } from "../../src/render/camera";

/**
 * Long races run on a track several screens long and the camera travels with the leaders, so
 * surges and lead changes are visible at real-race speed. Short races keep the fixed view.
 */
describe("worldLaps", () => {
  it("is one screen for short races and grows with the race length, capped", () => {
    expect(worldLaps(3)).toBe(1);
    expect(worldLaps(30)).toBe(1);
    // anything longer than one lap's worth of seconds travels, as the docs promise ("over ~30 s")
    expect(worldLaps(31)).toBe(2);
    expect(worldLaps(44)).toBe(2);
    expect(worldLaps(60)).toBe(2);
    expect(worldLaps(120)).toBe(4);
    expect(worldLaps(600)).toBe(5);
    for (let d = 3; d <= 600; d++) expect(worldLaps(d)).toBeGreaterThanOrEqual(worldLaps(d - 1 || 1));
  });
});

describe("worldX", () => {
  it("maps progress onto a track that is laps × the screen track, then a fixed overrun", () => {
    const W = 1000;
    expect(worldX(0, 4, W)).toBe(0);
    expect(worldX(0.5, 4, W)).toBe(2000);
    expect(worldX(1, 4, W)).toBe(4000);
    // past the line the overrun is in screen units, whatever the lap count
    expect(worldX(1.05, 4, W) - worldX(1, 4, W)).toBeCloseTo(50);
    expect(worldX(1.05, 1, W) - worldX(1, 1, W)).toBeCloseTo(50);
  });
});

describe("cameraOffset", () => {
  const W = 1000;
  it("stays at the start until the leader passes the follow point, then follows, then stops at the finish", () => {
    expect(cameraOffset(0, 4, W)).toBe(0);
    expect(cameraOffset(300, 4, W)).toBe(0);
    const follow = cameraOffset(2000, 4, W);
    expect(follow).toBeGreaterThan(0);
    expect(2000 - follow).toBeCloseTo(W * 0.65);
    expect(cameraOffset(4000, 4, W)).toBe(3 * W);
    expect(cameraOffset(4500, 4, W)).toBe(3 * W);
  });

  it("never moves for a one-lap race", () => {
    for (const x of [0, 500, 1000, 1100]) expect(cameraOffset(x, 1, W)).toBe(0);
  });

  it("is monotonic in the leader position", () => {
    let prev = 0;
    for (let x = 0; x <= 5000; x += 10) {
      const c = cameraOffset(x, 4, W);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });
});
