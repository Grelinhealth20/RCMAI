/**
 * Deterministic pseudo-random number generator (mulberry32).
 *
 * The AR claims book is *generated*, not hand-authored — but it must be stable
 * across reloads (consistent KPIs, no duplicate rows) and reproducible. A fixed
 * seed feeds this PRNG so every render produces the identical, internally
 * consistent 800-claim ledger without any static/mock row literals.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  next: () => number
  int: (min: number, max: number) => number
  float: (min: number, max: number) => number
  pick: <T>(arr: readonly T[]) => T
  chance: (p: number) => boolean
  /** Deterministic Fisher–Yates shuffle (returns a new array). */
  shuffle: <T>(arr: readonly T[]) => T[]
}

export function makeRng(seed: number): Rng {
  const r = mulberry32(seed)
  const int = (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min
  return {
    next: r,
    int,
    float: (min: number, max: number) => r() * (max - min) + min,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)],
    chance: (p: number) => r() < p,
    shuffle: <T>(arr: readonly T[]): T[] => {
      const out = [...arr]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
  }
}
