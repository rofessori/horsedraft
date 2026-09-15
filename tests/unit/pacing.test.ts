import { describe, expect, it } from "vitest";
import { planRace, progressAt, speedAt, standingsAt, winnerOf } from "../../src/core/race";

/**
 * The race should read like a real one: horses break slowly from the gate, the early leader is
 * usually not the winner, gaps open and close, everyone kicks in the final stretch, and the field
 * spreads out at the line in proportion to how long the race is.
 */
describe("realistic pacing", () => {
  it("horses stand still at the gun and take a moment to reach racing speed", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const plan = planRace(8, 60, seed);
      for (let h = 0; h < plan.horseCount; h++) {
        expect(speedAt(plan, h, 0)).toBeLessThan(0.2);
        expect(speedAt(plan, h, 0.5)).toBeLessThan(0.75);
        expect(speedAt(plan, h, 4)).toBeGreaterThan(0.6);
        // slower than a constant-pace horse over the first 5 % of the race
        expect(progressAt(plan, h, 3)).toBeLessThan(0.05 * 0.85);
      }
    }
  });

  it("the gate break still scales down for very short races", () => {
    const plan = planRace(4, 3, 5);
    for (let h = 0; h < plan.horseCount; h++) {
      expect(speedAt(plan, h, 0)).toBeLessThan(0.2);
      expect(speedAt(plan, h, 1)).toBeGreaterThan(0.6);
    }
  });

  it("the early leader is usually not the eventual winner (the race is not decided at the start)", () => {
    const runs = 300;
    let earlyLeaderWins = 0;
    let midLeaderWins = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const plan = planRace(8, 60, seed * 31);
      const w = winnerOf(plan);
      if (standingsAt(plan, 15)[0] === w) earlyLeaderWins++;
      if (standingsAt(plan, 30)[0] === w) midLeaderWins++;
    }
    expect(earlyLeaderWins / runs).toBeLessThan(0.4);
    expect(midLeaderWins / runs).toBeLessThan(0.55);
    // ...but not never: wire-to-wire wins do happen
    expect(earlyLeaderWins / runs).toBeGreaterThan(0.08);
  });

  it("gaps between horses keep opening and closing through the race", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const plan = planRace(8, 60, seed);
      let pairs = 0;
      let totalFlips = 0;
      let pairsThatReverse = 0;
      for (let a = 0; a < plan.horseCount; a++) {
        for (let b = a + 1; b < plan.horseCount; b++) {
          let flips = 0;
          let trend = 0;
          let prevGap = progressAt(plan, a, 5) - progressAt(plan, b, 5);
          for (let t = 6; t <= 55; t += 1) {
            const gap = progressAt(plan, a, t) - progressAt(plan, b, t);
            const d = gap - prevGap;
            if (Math.abs(d) > 0.0004) {
              const dir = Math.sign(d);
              if (trend !== 0 && dir !== trend) flips++;
              trend = dir;
            }
            prevGap = gap;
          }
          pairs++;
          totalFlips += flips;
          if (flips >= 1) pairsThatReverse++;
        }
      }
      // on average a gap changes direction a few times, and nearly every gap reverses at least once
      expect(totalFlips / pairs).toBeGreaterThanOrEqual(2);
      expect(pairsThatReverse / pairs).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("the field kicks in the final stretch: most horses run faster there than mid-race", () => {
    let faster = 0;
    let total = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const plan = planRace(8, 60, seed * 17);
      for (let h = 0; h < plan.horseCount; h++) {
        const T = plan.finishTimes[h] as number;
        const mean = (from: number, to: number): number => {
          let s = 0;
          let n = 0;
          for (let t = from; t < to; t += 0.25) {
            s += speedAt(plan, h, t);
            n++;
          }
          return s / n;
        };
        if (mean(0.8 * T, 0.98 * T) > mean(0.3 * T, 0.7 * T) * 1.04) faster++;
        total++;
      }
    }
    expect(faster / total).toBeGreaterThan(0.7);
  });

  it("the finish spread grows with the race length but stays watchable", () => {
    const spread = (n: number, dur: number, seed: number): number => planRace(n, dur, seed).totalSec - dur;
    for (let seed = 1; seed <= 20; seed++) {
      expect(spread(8, 20, seed)).toBeGreaterThan(1.0);
      expect(spread(8, 20, seed)).toBeLessThan(3.0);
      expect(spread(8, 120, seed)).toBeGreaterThan(3.0);
      expect(spread(8, 120, seed)).toBeLessThan(9.0);
      expect(spread(20, 60, seed)).toBeLessThan(9.0);
      expect(spread(2, 60, seed)).toBeGreaterThan(0.2);
    }
  });

  it("every horse runs through the line and keeps going for a while", () => {
    const plan = planRace(10, 60, 4242);
    for (let h = 0; h < plan.horseCount; h++) {
      const T = plan.finishTimes[h] as number;
      expect(progressAt(plan, h, T)).toBe(1);
      expect(speedAt(plan, h, T - 0.5)).toBeGreaterThan(0.5);
    }
  });

  it("speed varies substantially: every horse has fast spells and slow spells", () => {
    let ok = 0;
    let total = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const plan = planRace(8, 120, seed * 13);
      for (let h = 0; h < plan.horseCount; h++) {
        const T = plan.finishTimes[h] as number;
        let max = 0;
        let min = Infinity;
        for (let t = 6; t < T - 0.5; t += 0.5) {
          const v = speedAt(plan, h, t);
          max = Math.max(max, v);
          min = Math.min(min, v);
        }
        if (max >= 1.2 && min <= 0.85) ok++;
        total++;
      }
    }
    expect(ok / total).toBeGreaterThan(0.9);
  });

  it("the lead changes hands several times in a long race", () => {
    const runs = 30;
    let changes = 0;
    let racesWithThreeLeaders = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const plan = planRace(8, 120, seed * 7);
      const leaders = new Set<number>();
      let prev = standingsAt(plan, 1)[0];
      for (let t = 2; t <= 118; t += 1) {
        const now = standingsAt(plan, t)[0] as number;
        if (now !== prev) changes++;
        prev = now;
        leaders.add(now);
      }
      if (leaders.size >= 3) racesWithThreeLeaders++;
    }
    expect(changes / runs).toBeGreaterThanOrEqual(3);
    expect(racesWithThreeLeaders / runs).toBeGreaterThanOrEqual(0.6);
  });
});
