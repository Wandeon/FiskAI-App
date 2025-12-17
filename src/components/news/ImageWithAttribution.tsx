import Image from "next/image"
import { cn } from "@/lib/utils"

interface ImageWithAttributionProps {
  src?: string | null
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

export function ImageWithAttribution({
  src,
  source,
  alt,
  className,
  categorySlug,
}: ImageWithAttributionProps) {
  const imageSrc = src || categoryPlaceholders[categorySlug || ""] || categoryPlaceholders.default
  const hasRealImage = !!src

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        src={imageSrc}
        alt={alt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
      {hasRealImage && source && (
        <div className="absolute bottom-0 right-0 bg-black/70 px-2 py-1 text-xs text-white/90">
          📷 Foto: {source}
        </div>
      )}
    </div>
  )
}
