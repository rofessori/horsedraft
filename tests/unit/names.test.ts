import { describe, expect, it } from "vitest";
import { countDuplicates, numberedNames, parseNames, parseNamesLoose } from "../../src/core/names";
import { MAX_HORSES, MAX_NAME_LENGTH } from "../../src/core/limits";

describe("parseNames", () => {
  it("trims, drops blanks, keeps order", () => {
    const { names, overflow } = parseNames("  Anna \n\n Bob\r\n\t\nCarl  ");
    expect(names).toEqual(["Anna", "Bob", "Carl"]);
    expect(overflow).toEqual([]);
  });

  it("caps at MAX_HORSES and reports overflow", () => {
    const text = Array.from({ length: MAX_HORSES + 3 }, (_, i) => `N${i}`).join("\n");
    const { names, overflow } = parseNames(text);
    expect(names).toHaveLength(MAX_HORSES);
    expect(overflow).toEqual([`N${MAX_HORSES}`, `N${MAX_HORSES + 1}`, `N${MAX_HORSES + 2}`]);
  });

  it("clips overly long names", () => {
    const { names } = parseNames("x".repeat(MAX_NAME_LENGTH + 10));
    expect(names[0]).toHaveLength(MAX_NAME_LENGTH);
  });

  it("keeps duplicates (double chance) and can count them", () => {
    const { names } = parseNames("Anna\nanna\nBob");
    expect(names).toEqual(["Anna", "anna", "Bob"]);
    expect(countDuplicates(names)).toBe(1);
  });

  it("loose parser accepts commas", () => {
    expect(parseNamesLoose("a, b,c").names).toEqual(["a", "b", "c"]);
  });

  it("numberedNames", () => {
    expect(numberedNames(3)).toEqual(["1", "2", "3"]);
  });
});
