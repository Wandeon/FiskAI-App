"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface ImageWithAttributionProps {
  /** Local cached image path (preferred - fixes hotlinking issue #299) */
  localSrc?: string | null
  /** Original external URL (fallback, kept for reference) */
  src?: string | null
  /** Image source attribution */
  source?: string | null
  alt: string
  className?: string
  categorySlug?: string | null
}

// Category-specific placeholder images
const categoryPlaceholders: Record<string, string> = {
  porezi: "/images/placeholders/porezi.svg",
  pdv: "/images/placeholders/pdv.svg",
  "porez-na-dobit": "/images/placeholders/porez-na-dobit.svg",
  "porez-na-dohodak": "/images/placeholders/porez-na-dohodak.svg",
  doprinosi: "/images/placeholders/doprinosi.svg",
  propisi: "/images/placeholders/propisi.svg",
  zakoni: "/images/placeholders/zakoni.svg",
  pravilnici: "/images/placeholders/pravilnici.svg",
  rokovi: "/images/placeholders/rokovi.svg",
  poslovanje: "/images/placeholders/poslovanje.svg",
  financije: "/images/placeholders/financije.svg",
  racunovodstvo: "/images/placeholders/racunovodstvo.svg",
  upravljanje: "/images/placeholders/upravljanje.svg",
  default: "/images/placeholders/default.svg",
}

/**
 * Image component with attribution overlay.
 *
 * Priority order:
 * 1. Local cached image (localSrc) - preferred, no hotlinking
 * 2. External URL (src) - fallback only
 * 3. Category placeholder - when no image available
 * 4. Default placeholder - final fallback
 *
 * @see Issue #299 - Image Attribution Hotlinking Risk
 */
export function ImageWithAttribution({
  localSrc,
  src,
  source,
  alt,
  className,
  categorySlug,
}: ImageWithAttributionProps) {
  const [imageError, setImageError] = useState(false)

  // Determine image source with priority: local > external > placeholder
  const getImageSrc = (): string => {
    // If we had an error, fall back to placeholder
    if (imageError) {
      return categoryPlaceholders[categorySlug || ""] || categoryPlaceholders.default
    }

    // Prefer local cached image (no hotlinking)
    if (localSrc) {
      return localSrc
    }

    // External URL as fallback (may have hotlinking issues)
    if (src) {
      return src
    }

    // Category-specific or default placeholder
    return categoryPlaceholders[categorySlug || ""] || categoryPlaceholders.default
  }

  const imageSrc = getImageSrc()
  const hasRealImage = !!(localSrc || src) && !imageError
  const isLocalImage = !!localSrc && !imageError

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={imageSrc}
        alt={alt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        onError={() => setImageError(true)}
        // Only use unoptimized for external URLs (local images can be optimized)
        unoptimized={!isLocalImage && !!src}
      />
      {hasRealImage && source && (
        <div className="absolute bottom-0 right-0 bg-black/70 px-2 py-1 text-xs text-white/90">
          Foto: {source}
        </div>
      )}
    </div>
  )
}
