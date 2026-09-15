/**
 * Small deterministic PRNG (mulberry32). Deterministic seeds make races reproducible,
 * which is what makes the simulation testable and lets a screenshot test pin a frame.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick: empty list");
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Fisher–Yates shuffle, returns a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }
}

/** FNV-1a hash so a human-friendly string can be used as a seed (e.g. `?seed=friday`). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Fresh unpredictable seed for a real race. Uses WebCrypto when available. */
export function randomSeed(): number {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return (buf[0] as number) >>> 0;
  }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/** Accepts a number or a string; strings that look like integers are used as-is. */
export function coerceSeed(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return value >>> 0;
  if (/^\d+$/.test(value)) return Number(value) >>> 0;
  return hashString(value);
}
