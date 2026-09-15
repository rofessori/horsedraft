import { describe, expect, it } from "vitest";
import { RaceFileError, parseRace, raceFileName, serializeRace } from "../../src/core/raceFile";
import type { RaceConfig } from "../../src/core/race";

const config: RaceConfig = {
  title: "Friday Raffle",
  durationSec: 25,
  showNumbers: true,
  horses: [
    { name: "Anna", color: "#e6194b" },
    { name: "Bob", color: "#4363d8" },
  ],
};

describe("race file", () => {
  it("round trips", () => {
    expect(parseRace(serializeRace(config))).toEqual(config);
  });

  it("rejects garbage and wrong formats", () => {
    expect(() => parseRace("not json")).toThrow(RaceFileError);
    expect(() => parseRace("{}")).toThrow(/HorseDraft/);
    expect(() => parseRace(JSON.stringify({ format: "horsedraft-race", version: 99, horses: [] }))).toThrow(/version/);
    expect(() =>
      parseRace(JSON.stringify({ format: "horsedraft-race", version: 1, horses: [{ name: "x", color: "blue" }] })),
    ).toThrow(/colour/);
  });

  it("normalises fields", () => {
    const parsed = parseRace(
      JSON.stringify({
        format: "horsedraft-race",
        version: 1,
        title: 42,
        durationSec: 100000,
        horses: [{ name: "  Zed ", color: "#ABCDEF" }],
      }),
    );
    expect(parsed.title).toBe("");
    expect(parsed.durationSec).toBe(600);
    expect(parsed.showNumbers).toBe(false);
    expect(parsed.horses).toEqual([{ name: "Zed", color: "#abcdef" }]);
  });

  it("makes a safe file name", () => {
    expect(raceFileName("Friday Raffle!")).toBe("friday-raffle.horserace.json");
    expect(raceFileName("")).toBe("race.horserace.json");
  });
});
