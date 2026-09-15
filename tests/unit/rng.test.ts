import { describe, expect, it } from "vitest";
import { Rng, coerceSeed, hashString } from "../../src/core/rng";

describe("Rng", () => {
  it("is deterministic for a seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("produces values in [0,1)", () => {
    const r = new Rng(7);
    for (let i = 0; i < 10_000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int covers the whole inclusive range", () => {
    const r = new Rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(r.int(1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("shuffle is a permutation and does not mutate input", () => {
    const r = new Rng(9);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = r.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort()).toEqual(input);
  });

  it("hashString / coerceSeed", () => {
    expect(hashString("friday")).toBe(hashString("friday"));
    expect(hashString("friday")).not.toBe(hashString("monday"));
    expect(coerceSeed("123")).toBe(123);
    expect(coerceSeed("friday")).toBe(hashString("friday"));
    expect(coerceSeed("")).toBeUndefined();
    expect(coerceSeed(null)).toBeUndefined();
  });
});
