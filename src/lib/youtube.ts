/**
 * Pull a YouTube video ID out of a pasted URL.
 *
 * Handles the formats coaches actually use:
 *   - https://www.youtube.com/watch?v=ID&t=10s
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/shorts/ID
 *   - https://www.youtube.com/embed/ID
 *   - https://www.youtube.com/live/ID
 *   - https://m.youtube.com/...
 *   - https://music.youtube.com/...
 *   - https://www.youtube-nocookie.com/embed/ID
 *
 * Returns `null` for non-YouTube URLs, malformed URLs, or IDs that
 * don't look right (so callers can fall back to a plain link).
 *
 * YouTube IDs are 11 chars of [A-Za-z0-9_-].
 */
export function parseYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase()

  let id: string | null = null

  if (host === 'youtu.be') {
    id = parsed.pathname.split('/').filter(Boolean)[0] ?? null
  } else if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    const v = parsed.searchParams.get('v')
    if (v) {
      id = v
    } else {
      const parts = parsed.pathname.split('/').filter(Boolean)
      const prefixes = new Set(['embed', 'shorts', 'v', 'live'])
      if (parts.length >= 2 && prefixes.has(parts[0])) {
        id = parts[1] ?? null
      }
    }
  }

  if (!id) return null
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}
