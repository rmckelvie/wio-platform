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

/**
 * Server-side check: is this YouTube URL embeddable in an iframe?
 *
 * Uses YouTube's public oEmbed endpoint, which responds:
 *   - 200 + JSON: video exists and can be embedded
 *   - 401:        uploader has disabled embedding
 *   - 403:        video is private
 *   - 404:        video doesn't exist or has been deleted
 *
 * Returns:
 *   - true  when oEmbed returns 200
 *   - false on 401 / 403 / 404
 *   - null  for non-YouTube URLs, malformed URLs, or network errors —
 *           callers persist the null and decide whether to retry later.
 *
 * Safe to call from server actions / route handlers / RSC. Do not call
 * from the browser — oEmbed sets CORS headers that block fetch from
 * untrusted origins.
 */
export async function checkYouTubeEmbed(
  url: string | null | undefined,
): Promise<boolean | null> {
  const id = parseYouTubeId(url)
  if (!id) return null

  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${id}`,
  )}&format=json`

  try {
    const res = await fetch(oembed, {
      // No caching: we want the live answer when a coach saves an edit,
      // and the value is persisted anyway.
      cache: 'no-store',
    })
    if (res.status === 200) return true
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return false
    }
    // Anything else (5xx, rate limit, weird CDN response) — don't lock in
    // a false-positive. Leave null so a retry can recover.
    return null
  } catch {
    return null
  }
}
