import Image from "next/image";

import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "wordmark" | "mark";
  /** Width in pixels for the wordmark; height for the mark. Defaults sensible per variant. */
  size?: number;
  className?: string;
  priority?: boolean;
  /**
   * Mark-variant only: crop the empty vertical space baked into the
   * source asset (it's a 1:1 square with ~30% black padding top and
   * bottom). Defaults to true — the rendered logo stays the same size
   * but the surrounding container only occupies the height the artwork
   * actually needs, which saves significant header height on mobile.
   * Pass `crop={false}` for cases where you want the full square frame.
   */
  crop?: boolean;
}

// Mark artwork sits in the middle ~46% of the square. Anything tighter
// risks clipping the descending triangles; this leaves a small breathing
// margin on each side.
const MARK_CROP_RATIO = 0.46;

/**
 * WIO brand logo. Two variants:
 *  - "wordmark" → wide horizontal WIO (use for headers, hero, auth pages)
 *  - "mark" → square WIO FITNESS (use for tight spaces, social avatars)
 *
 * Assets live in /public:
 *  - public/wio-wordmark.png
 *  - public/wio-mark.png
 */
export function WioLogo({
  variant = "wordmark",
  size,
  className,
  priority,
  crop = true,
}: LogoProps) {
  if (variant === "mark") {
    const dim = size ?? 96;
    const img = (
      <Image
        src="/wio-mark.png"
        alt="WIO Fitness"
        width={dim}
        height={dim}
        priority={priority}
        className={crop ? undefined : className}
        style={
          crop
            ? { marginTop: Math.round(-dim * (1 - MARK_CROP_RATIO) / 2) }
            : undefined
        }
      />
    );

    if (!crop) return img;

    // Wrapper clips the transparent/black bands above and below the
    // artwork. The image itself still renders at `dim`×`dim`, so the
    // visible logo isn't scaled down — just the box around it shrinks.
    return (
      <div
        className={cn("overflow-hidden", className)}
        style={{ width: dim, height: Math.round(dim * MARK_CROP_RATIO) }}
      >
        {img}
      </div>
    );
  }

  const w = size ?? 280;
  // wordmark image is roughly 4:3 (750x600 original). Compute height from aspect.
  const h = Math.round(w * 0.8);
  return (
    <Image
      src="/wio-wordmark.png"
      alt="WIO — Work It Out"
      width={w}
      height={h}
      priority={priority}
      className={className}
    />
  );
}
