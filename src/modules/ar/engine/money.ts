/** Currency helpers — all AR money is stored as integer cents to keep the
 *  Charges = Allowed + Adjustment and Allowed = Payment + Patient Responsibility
 *  identities exact (no floating-point drift). */

export const toCents = (dollars: number): number => Math.round(dollars * 100)
export const centsToNumber = (cents: number): number => cents / 100

/** $1,284.00 — two-decimal, thousands-separated. */
export function fmtUSD(cents: number): string {
  const neg = cents < 0
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const rem = abs % 100
  const whole = dollars.toLocaleString('en-US')
  return `${neg ? '-' : ''}$${whole}.${rem.toString().padStart(2, '0')}`
}

/** $902,341 — whole-dollar, thousands-separated (for headline totals). */
export function fmtUSDWhole(cents: number): string {
  const dollars = Math.round(cents / 100)
  return `$${dollars.toLocaleString('en-US')}`
}
