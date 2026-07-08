/** Chart formatting + validated categorical palette (see dataviz validator). */

export function fmtK(cents: number): string {
  const d = cents / 100
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(2)}M`
  if (d >= 1_000) return `$${Math.round(d / 1_000)}K`
  return `$${Math.round(d)}`
}

export const C_BILLED = '#2753b3'
export const C_COLLECTED = '#0d9488'

export const STATUS_COLOR = {
  paid: '#12a06e',
  'in-process': '#d97706',
  denied: '#dc2626',
  resubmitted: '#0d9488',
} as const
