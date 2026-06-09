/**
 * Parse the "prescribed sets" free-text value into a hard cap, when possible.
 *
 *   "3"      → 3
 *   "  4 "   → 4
 *   "3-5"    → 5   (high end of the range — most permissive interpretation)
 *   "3–5"    → 5   (en-dash variant)
 *   "max"    → null (no cap — let the client log as many as they want)
 *   "AMRAP"  → null
 *   ""       → null
 *   null     → null
 */
export function parseMaxSets(prescribed: string | null | undefined): number | null {
  if (!prescribed) return null
  const trimmed = prescribed.trim()
  if (!trimmed) return null

  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10)
  }

  const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(trimmed)
  if (range) {
    return Number.parseInt(range[2], 10)
  }

  return null
}
