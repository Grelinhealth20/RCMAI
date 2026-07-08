import { FIRST_NAMES, LAST_NAMES } from '../data/namePool'
import { makeRng } from './rng'

/** Deterministically mint `count` unique "Last, First" patient names from the
 *  name pool. A single shuffled list guarantees no duplicates across both the
 *  main ledger and the AI-intelligence intake queue. */
export function buildUniqueNames(count: number, seed: number): string[] {
  const rng = makeRng(seed)
  const combos: string[] = []
  for (const last of LAST_NAMES) {
    for (const first of FIRST_NAMES) {
      combos.push(`${last}, ${first}`)
    }
  }
  return rng.shuffle(combos).slice(0, count)
}
