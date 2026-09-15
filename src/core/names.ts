import { MAX_HORSES, MAX_NAME_LENGTH } from "./limits";

export interface ParsedNames {
  names: string[];
  /** Names beyond the limit that were dropped. */
  overflow: string[];
}

/**
 * Turn the textarea contents ("one name per line") into a clean list.
 * - trims whitespace, drops blank lines
 * - clips very long names
 * - keeps duplicates on purpose: two "Anna"s means Anna has two horses, i.e. double chance,
 *   which is a legitimate thing to want from a raffle. The UI shows a hint instead.
 */
export function parseNames(text: string, max: number = MAX_HORSES): ParsedNames {
  const all = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (line.length > MAX_NAME_LENGTH ? line.slice(0, MAX_NAME_LENGTH) : line));
  return { names: all.slice(0, max), overflow: all.slice(max) };
}

/** Comma- or newline-separated input (used by the CLI). */
export function parseNamesLoose(text: string, max: number = MAX_HORSES): ParsedNames {
  return parseNames(text.replace(/,/g, "\n"), max);
}

export function countDuplicates(names: readonly string[]): number {
  const seen = new Set<string>();
  let dupes = 0;
  for (const n of names) {
    const key = n.toLocaleLowerCase();
    if (seen.has(key)) dupes++;
    else seen.add(key);
  }
  return dupes;
}

/** "Horse 1".."Horse N" – used when the user wants numbers instead of names. */
export function numberedNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(i + 1));
}
