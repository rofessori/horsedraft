import { MAX_TITLE_LENGTH, MAX_NAME_LENGTH, clampDuration } from "./limits";
import { isHexColor, normalizeHex } from "./palette";
import type { RaceConfig } from "./race";

export const RACE_FILE_FORMAT = "horsedraft-race";
export const RACE_FILE_VERSION = 1;
export const RACE_FILE_EXTENSION = ".horserace.json";

export class RaceFileError extends Error {
  override name = "RaceFileError";
}

export function serializeRace(config: RaceConfig): string {
  const doc = {
    format: RACE_FILE_FORMAT,
    version: RACE_FILE_VERSION,
    title: config.title,
    durationSec: config.durationSec,
    showNumbers: config.showNumbers,
    horses: config.horses.map((h) => ({ name: h.name, color: h.color })),
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

export function parseRace(text: string): RaceConfig {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new RaceFileError("Not a JSON file");
  }
  if (typeof doc !== "object" || doc === null) throw new RaceFileError("Not a race file");
  const d = doc as Record<string, unknown>;
  if (d.format !== RACE_FILE_FORMAT) throw new RaceFileError("Not a HorseDraft race file");
  if (d.version !== RACE_FILE_VERSION) throw new RaceFileError(`Unsupported race file version ${String(d.version)}`);
  if (!Array.isArray(d.horses)) throw new RaceFileError("Race file has no horses");

  const horses = d.horses.map((h, i) => {
    if (typeof h !== "object" || h === null) throw new RaceFileError(`Horse ${i + 1} is malformed`);
    const { name, color } = h as Record<string, unknown>;
    if (typeof name !== "string" || name.trim() === "") throw new RaceFileError(`Horse ${i + 1} has no name`);
    if (!isHexColor(color)) throw new RaceFileError(`Horse ${i + 1} has an invalid colour`);
    return { name: name.trim().slice(0, MAX_NAME_LENGTH), color: normalizeHex(color) };
  });

  return {
    title: typeof d.title === "string" ? d.title.slice(0, MAX_TITLE_LENGTH) : "",
    durationSec: clampDuration(typeof d.durationSec === "number" ? d.durationSec : NaN),
    showNumbers: d.showNumbers === true,
    horses,
  };
}

/** Safe file name for a race title, e.g. "Friday Raffle" -> "friday-raffle.horserace.json". */
export function raceFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "race"}${RACE_FILE_EXTENSION}`;
}
