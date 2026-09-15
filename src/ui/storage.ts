import { DEFAULT_DURATION_SEC, clampDuration } from "../core/limits";
import { isHexColor } from "../core/palette";

export interface SetupState {
  title: string;
  /** raw textarea contents, one name per line */
  namesText: string;
  /** colour per line index; may be longer than the current name list */
  colors: string[];
  durationSec: number;
  showNumbers: boolean;
}

const KEY = "horsedraft.setup.v1";

export const DEFAULT_NAMES = ["Anna", "Ben", "Carla", "Daniel", "Elsa", "Finn"];

export function defaultSetup(): SetupState {
  return {
    title: "",
    namesText: DEFAULT_NAMES.join("\n"),
    colors: [],
    durationSec: DEFAULT_DURATION_SEC,
    showNumbers: true,
  };
}

export function loadSetup(storage: Storage | undefined = safeLocalStorage()): SetupState {
  const base = defaultSetup();
  if (!storage) return base;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return base;
    const d = JSON.parse(raw) as Partial<SetupState>;
    return {
      title: typeof d.title === "string" ? d.title : base.title,
      namesText: typeof d.namesText === "string" ? d.namesText : base.namesText,
      colors: Array.isArray(d.colors) ? d.colors.filter(isHexColor) : [],
      durationSec: clampDuration(typeof d.durationSec === "number" ? d.durationSec : NaN),
      showNumbers: typeof d.showNumbers === "boolean" ? d.showNumbers : base.showNumbers,
    };
  } catch {
    return base;
  }
}

export function saveSetup(state: SetupState, storage: Storage | undefined = safeLocalStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    // private mode / quota: ignore, the app works without persistence
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
