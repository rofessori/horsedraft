import { describe, expect, it } from "vitest";
import {
  SAMPLE_RATE,
  finishSpreadSec,
  hasFinished,
  isRaceOver,
  planRace,
  progressAt,
  results,
  speedAt,
  standingsAt,
  trackPositionAt,
  winnerOf,
} from "../../src/core/race";

describe("planRace", () => {
  it("is deterministic per seed", () => {
    const a = planRace(8, 20, 1234);
    const b = planRace(8, 20, 1234);
    expect(a.finishOrder).toEqual(b.finishOrder);
    expect(a.finishTimes).toEqual(b.finishTimes);
    expect(Array.from(a.curves[3] as Float32Array)).toEqual(Array.from(b.curves[3] as Float32Array));
    expect(planRace(8, 20, 1235).finishOrder).not.toEqual(a.finishOrder);
  });

  it("finish order is a permutation and the winner crosses exactly at the duration", () => {
    const plan = planRace(20, 30, 99);
    expect([...plan.finishOrder].sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(plan.finishTimes[winnerOf(plan)]).toBe(30);
    expect(plan.totalSec).toBeLessThanOrEqual(30 + finishSpreadSec(30, 20) * 1.1 + 1e-9);
    // strictly increasing finish times along the drawn order
    for (let k = 1; k < 20; k++) {
      const prev = plan.finishTimes[plan.finishOrder[k - 1] as number] as number;
      const cur = plan.finishTimes[plan.finishOrder[k] as number] as number;
      expect(cur).toBeGreaterThan(prev);
    }
  });

  it("progress is monotonic, starts at 0, reaches 1 only at the finish time", () => {
    const plan = planRace(12, 15, 2024);
    for (let h = 0; h < plan.horseCount; h++) {
      const finish = plan.finishTimes[h] as number;
      let prev = progressAt(plan, h, 0);
      expect(prev).toBe(0);
      for (let t = 0.01; t < finish; t += 0.01) {
        const p = progressAt(plan, h, t);
        expect(p).toBeGreaterThanOrEqual(prev);
        expect(p).toBeLessThan(1);
        prev = p;
      }
      expect(progressAt(plan, h, finish)).toBe(1);
      expect(progressAt(plan, h, finish + 5)).toBe(1);
    }
  });

  it("nobody crosses the line before the winner", () => {
    for (let seed = 0; seed < 50; seed++) {
      const plan = planRace(10, 8, seed);
      const w = winnerOf(plan);
      const tBefore = plan.durationSec - 1 / SAMPLE_RATE;
      for (let h = 0; h < plan.horseCount; h++) {
        if (h === w) continue;
        expect(progressAt(plan, h, tBefore)).toBeLessThan(1);
        expect(hasFinished(plan, h, plan.durationSec)).toBe(false);
      }
      expect(hasFinished(plan, w, plan.durationSec)).toBe(true);
    }
  });

  it("track position keeps going a little past the line, then settles", () => {
    const plan = planRace(3, 5, 7);
    const h = winnerOf(plan);
    const p1 = trackPositionAt(plan, h, 5.2);
    const p2 = trackPositionAt(plan, h, 6);
    const p3 = trackPositionAt(plan, h, 30);
    expect(p1).toBeGreaterThan(1);
    expect(p2).toBeGreaterThan(p1);
    expect(p3).toBeGreaterThan(p2);
    expect(p3).toBeLessThan(1.2);
    expect(speedAt(plan, h, 30)).toBeLessThan(0.01);
    expect(speedAt(plan, h, 2)).toBeGreaterThan(0.1);
  });

  it("results and standings agree at the end", () => {
    const plan = planRace(6, 10, 31337);
    const res = results(plan);
    expect(res.map((r) => r.place)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(res.map((r) => r.horse)).toEqual(plan.finishOrder);
    expect(isRaceOver(plan, plan.totalSec)).toBe(true);
    expect(isRaceOver(plan, plan.totalSec - 0.01)).toBe(false);
    // at the exact finish of the winner, the winner leads the standings
    expect(standingsAt(plan, plan.durationSec)[0]).toBe(winnerOf(plan));
  });

  it("is fair: every horse wins about equally often across seeds", () => {
    const n = 5;
    const runs = 3000;
    const wins = new Array<number>(n).fill(0);
    for (let seed = 1; seed <= runs; seed++) wins[winnerOf(planRace(n, 10, seed * 7919))]!++;
    for (const w of wins) {
      expect(w / runs).toBeGreaterThan(0.15);
      expect(w / runs).toBeLessThan(0.25);
    }
  });

  it("has lead changes (the race is not decided from the start)", () => {
    let changes = 0;
    for (let seed = 0; seed < 20; seed++) {
      const plan = planRace(8, 20, seed);
      let leader = standingsAt(plan, 0.5)[0];
      for (let t = 1; t < 20; t += 0.5) {
        const now = standingsAt(plan, t)[0];
        if (now !== leader) changes++;
        leader = now;
      }
    }
    expect(changes).toBeGreaterThan(20);
  });

  it("rejects bad input", () => {
    expect(() => planRace(0, 10, 1)).toThrow();
    expect(() => planRace(3, 0, 1)).toThrow();
    expect(planRace(1, 4, 1).finishOrder).toEqual([0]);
  });
});
