/** Deterministic date math anchored to a fixed "today" so the generated ledger
 *  (dates of service, submission, denial, appeal deadlines) is stable and
 *  reproducible rather than shifting with the wall clock. */

/** Operational "today" for the AR book. */
export const AR_TODAY = new Date(2026, 6, 7) // 2026-07-07

const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS)
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

/** mm/dd/yyyy. */
export function fmtDate(d: Date): string {
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  return `${mm}/${dd}/${d.getFullYear()}`
}

/** "Jul 7, 2026". */
export function fmtDateLong(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
