/**
 * Add `days` to an ISO-8601 date string (YYYY-MM-DD), returning the same format.
 * Uses UTC to avoid timezone drift across DST boundaries.
 */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Format an ISO-8601 date as "01 Jun 2026" in en-GB locale. */
export function formatDate(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Compute release_date for a given week_index given the assignment start_date. */
export function releaseDateForWeek(startDate: string, weekIndex: number): string {
  return addDays(startDate, (weekIndex - 1) * 7)
}
