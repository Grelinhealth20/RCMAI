/** Converts an ISO "YYYY-MM-DD" date string to enterprise "MM/DD/YYYY" display format. */
export function formatDateDisplay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return `${month}/${day}/${year}`
}
