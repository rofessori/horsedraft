import { describe, expect, it } from "vitest";
import { planRace, standingsAt } from "../../src/core/race";
import { MOVE_CALL_SEC, MOVE_SPEED, leadChanges, raceCallAt, type RaceCallKind } from "../../src/core/raceCall";
import { speedAt } from "../../src/core/race";

const NAMES = ["Anna", "Ben", "Carla", "Daniel", "Elsa", "Finn", "Greta", "Hugo"];
const KINDS: RaceCallKind[] = ["off", "lead", "move", "stretch", "photo", "none"];

/** The on-screen race call: a short line of commentary derived purely from the plan and the clock. */
describe("raceCallAt", () => {
  it("says they are off right after the gun", () => {
    const plan = planRace(8, 120, 1);
    expect(raceCallAt(plan, NAMES, 0.5)).toEqual({ kind: "off", text: "And they're off!" });
    expect(raceCallAt(plan, NAMES, -1).kind).toBe("none");
  });

  it("announces a new leader for a few seconds after the lead changes", () => {
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 5; seed++) {
      const plan = planRace(8, 120, seed);
      const change = leadChanges(plan).find((c) => c.t > 0.15 * plan.durationSec && c.t < 0.6 * plan.durationSec);
      if (!change) continue;
      const call = raceCallAt(plan, NAMES, change.t + 0.5);
      expect(call).toEqual({ kind: "lead", text: `${NAMES[change.horse]} takes the lead!` });
      checked++;
    }
    expect(checked).toBe(5);
  });

  it("announces the final stretch as the field enters it", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const plan = planRace(8, 120, seed);
      const call = raceCallAt(plan, NAMES, 0.75 * plan.durationSec + 1);
      expect(["stretch", "lead"]).toContain(call.kind);
      if (call.kind === "stretch") expect(call.text).toMatch(/^Final stretch! .+ leads$/);
    }
  });

  it("calls a move by a non-leader running well above pace, and holds it for a few seconds", () => {
    let checked = 0;
    for (let seed = 1; seed <= 60 && checked < 5; seed++) {
      const plan = planRace(8, 120, seed * 3);
      const D = plan.durationSec;
      // candidate windows: mid-race, no lead change nearby, somebody outside the lead above MOVE_SPEED
      for (let t0 = 12; t0 < 0.7 * D && checked < 5; t0 += MOVE_CALL_SEC) {
        if (leadChanges(plan).some((c) => Math.abs(c.t - t0) < 4)) continue;
        const leader = standingsAt(plan, t0)[0];
        let mover = -1;
        let best = MOVE_SPEED;
        for (let h = 0; h < plan.horseCount; h++) {
          if (h === leader) continue;
          const v = speedAt(plan, h, t0);
          if (v > best) {
            best = v;
            mover = h;
          }
        }
        if (mover < 0) continue;
        const text = `${NAMES[mover]} is making a move!`;
        expect(raceCallAt(plan, NAMES, t0)).toEqual({ kind: "move", text });
        // same text for the whole window, however the speeds wobble inside it
        expect(raceCallAt(plan, NAMES, t0 + MOVE_CALL_SEC * 0.5)).toEqual({ kind: "move", text });
        expect(raceCallAt(plan, NAMES, t0 + MOVE_CALL_SEC * 0.99)).toEqual({ kind: "move", text });
        checked++;
      }
    }
    expect(checked).toBe(5);
  });

  it("never names the leader as the mover and never retitles a move inside its window", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const plan = planRace(8, 120, seed * 11);
      let windowStart = -1;
      let windowText = "";
      for (let t = 5; t < plan.durationSec; t += 0.25) {
        const call = raceCallAt(plan, NAMES, t);
        if (call.kind !== "move") continue;
        const mover = NAMES.indexOf(call.text.replace(" is making a move!", ""));
        expect(mover).not.toBe(standingsAt(plan, t)[0]);
        const w = Math.floor(t / MOVE_CALL_SEC);
        if (w === windowStart) expect(call.text).toBe(windowText);
        windowStart = w;
        windowText = call.text;
      }
    }
  });

  it("calls a photo finish only when the first two cross almost together", () => {
    const tight = planRace(3, 10, 5, { spreadSec: 0.1 });
    expect(raceCallAt(tight, NAMES, 10.05).kind).toBe("photo");
    const wide = planRace(3, 10, 5, { spreadSec: 4 });
    expect(raceCallAt(wide, NAMES, 10.05).kind).toBe("none");
  });

  it("is pure, deterministic and always one of the known kinds", () => {
    const plan = planRace(6, 60, 77);
    for (let t = -3; t <= plan.totalSec + 2; t += 0.5) {
      const a = raceCallAt(plan, NAMES, t);
      expect(KINDS).toContain(a.kind);
      expect(raceCallAt(plan, NAMES, t)).toEqual(a);
    }
  });
});

describe("leadChanges", () => {
  it("lists the moments the leader changed, in order, with the new leader", () => {
    const plan = planRace(8, 120, 9);
    const changes = leadChanges(plan);
    expect(changes.length).toBeGreaterThan(0);
    let prevT = 0;
    let prevLeader = standingsAt(plan, 0.25)[0];
    for (const c of changes) {
      expect(c.t).toBeGreaterThan(prevT);
      expect(c.horse).not.toBe(prevLeader);
      expect(standingsAt(plan, c.t)[0]).toBe(c.horse);
      prevT = c.t;
      prevLeader = c.horse;
    }
    expect(leadChanges(plan)).toBe(changes); // memoised per plan
  });
});
