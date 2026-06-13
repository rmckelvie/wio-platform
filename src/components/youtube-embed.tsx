'use client'

import { useState } from 'react'

import { cn } from '@/lib/utils'

interface Props {
  videoId: string
  title?: string
  className?: string
}

/**
 * Click-to-play YouTube embed.
 *
 * On mount we render just the thumbnail (a single ~20 KB jpg from
 * i.ytimg.com) plus a play-button overlay. Only after the user taps do
 * we mount the real iframe pointing at youtube-nocookie.com with
 * autoplay=1 — that's what loads the ~500 KB player payload, and only
 * for videos the user actually wants to watch.
 *
 * Sized via the wrapper's width; aspect-ratio keeps the height honest
 * so the rest of the page doesn't shift when the iframe swaps in.
 */
export function YouTubeEmbed({
  videoId,
  title = 'Exercise demo',
  className,
}: Props) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div
        className={cn(
          'aspect-video overflow-hidden rounded-lg border border-border bg-black',
          className,
        )}
      >
        <iframe
          // youtube-nocookie defers tracking until the user actively
          // engages with the player, which is the right default for a
          // workout app embed.
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${title}`}
      className={cn(
        'group/yt relative aspect-video overflow-hidden rounded-lg border border-border bg-black focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    >
      {/* Plain <img> here, not next/image: this is a single small
          third-party thumbnail per exercise, lazy-loaded, and adding
          next.config remotePatterns just for ytimg.com isn't worth it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover/yt:opacity-100"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70 ring-2 ring-white/40 transition-transform group-hover/yt:scale-110">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="ml-0.5 h-6 w-6 fill-white"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  )
}
