"use client"

import { useId } from "react"

/**
 * The Creator AI mark, drawn rather than shipped as a raster.
 *
 * The old PNGs were AI-generated art: dark-logo.png was 912kB and both
 * "colored logo" files were ~2MB with an opaque grey background baked in, so
 * they could not sit on a light surface at all. This is the same double
 * chevron as geometry, under a kilobyte, transparent, crisp at every size, and
 * it costs the image optimizer nothing.
 *
 * Gradient ids come from useId: several logos render on one page (navbar,
 * footer, page body) and an id is document-global, so a fixed one would emit
 * duplicates and every reference would resolve to whichever painted first.
 */
export default function BrandLogo({
  size = 32,
  className = "",
  title = "Creator AI",
}: {
  size?: number
  className?: string
  title?: string
}) {
  const uid = useId().replace(/:/g, "")
  const front = `logo-front-${uid}`
  const back = `logo-back-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={back} x1="16" y1="19" x2="52" y2="81" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={front} x1="36" y1="19" x2="86" y2="81" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="0.55" stopColor="#a855f7" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
      </defs>

      {/* leading chevron */}
      <path d="M16 19 L28 19 L52 50 L28 81 L16 81 L39 50 Z" fill={`url(#${back})`} />
      {/* trailing chevron, with the tail that closes the mark */}
      <path
        d="M36 19 L50 19 L72 50 L59 67 L86 67 L78 81 L36 81 L57 50 Z"
        fill={`url(#${front})`}
      />
    </svg>
  )
}
