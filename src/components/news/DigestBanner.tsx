import Link from "next/link"
import { format } from "date-fns"
import { hr } from "date-fns/locale"
import { Newspaper } from "lucide-react"

interface DigestBannerProps {
  date: Date
  itemCount: number
  slug: string
}

export function DigestBanner({ date, itemCount, slug }: DigestBannerProps) {
  const formattedDate = format(date, "d. MMMM yyyy.", { locale: hr })

  return (
    <Link
      href={`/vijesti/${slug}`}
      className="group mb-12 block overflow-hidden rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-purple-500/10 transition-all hover:border-blue-500/50 hover:from-blue-500/20 hover:to-purple-500/20"
    >
      <div className="flex items-center gap-6 p-6">
        {/* Icon */}
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20">
          <Newspaper className="h-8 w-8 text-blue-400" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-medium text-blue-400">Dnevni pregled</span>
            <span className="text-sm text-white/50">•</span>
            <time dateTime={date.toISOString()} className="text-sm text-white/70">
              {formattedDate}
            </time>
          </div>
          <h3 className="text-xl font-semibold text-white group-hover:text-blue-400">
            {itemCount} {itemCount === 1 ? "vijest" : itemCount < 5 ? "vijesti" : "vijesti"} u
            dnevnom pregledu
          </h3>
          <p className="mt-1 text-sm text-white/60">
            Brzo pregledajte sve važne informacije iz današnjeg dana
          </p>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors group-hover:bg-blue-500 group-hover:text-white">
            →
          </div>
        </div>
      </div>
    </Link>
  )
}
