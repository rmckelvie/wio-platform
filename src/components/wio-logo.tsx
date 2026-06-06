import Image from "next/image";

interface LogoProps {
  variant?: "wordmark" | "mark";
  /** Width in pixels for the wordmark; height for the mark. Defaults sensible per variant. */
  size?: number;
  className?: string;
  priority?: boolean;
}

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
}: LogoProps) {
  if (variant === "mark") {
    const dim = size ?? 96;
    return (
      <Image
        src="/wio-mark.png"
        alt="WIO Fitness"
        width={dim}
        height={dim}
        priority={priority}
        className={className}
      />
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
