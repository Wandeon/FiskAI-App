import Link from "next/link"
import { format } from "date-fns"
import { hr } from "date-fns/locale"
import { Newspaper, ArrowRight } from "lucide-react"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { GradientButton } from "@/components/ui/patterns/GradientButton"
import { HoverScale } from "@/components/ui/motion/HoverScale"

interface DigestBannerProps {
  date: Date
  itemCount: number
  slug: string
}

export function DigestBanner({ date, itemCount, slug }: DigestBannerProps) {
  const formattedDate = format(date, "d. MMMM yyyy.", { locale: hr })

  return (
    <HoverScale scale={1.02}>
      <Link href={`/vijesti/${slug}`} className="group mb-12 block">
        <GlassCard className="border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 transition-all hover:border-cyan-500/50 hover:from-cyan-500/20 hover:to-purple-500/20">
          <div className="flex items-center gap-6 p-6">
            {/* Icon */}
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-chart-7/20">
              <Newspaper className="h-8 w-8 text-accent" />
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium text-accent">Dnevni pregled</span>
                <span className="text-sm text-white/50">•</span>
                <time dateTime={date.toISOString()} className="text-sm text-white/70">
                  {formattedDate}
                </time>
              </div>
              <h3 className="text-xl font-semibold text-white transition-colors group-hover:text-accent">
                {itemCount} {itemCount === 1 ? "vijest" : itemCount < 5 ? "vijesti" : "vijesti"} u
                dnevnom pregledu
              </h3>
              <p className="mt-1 text-sm text-white/60">
                Brzo pregledajte sve važne informacije iz današnjeg dana
              </p>
            </div>

            {/* Arrow Button */}
            <div className="flex-shrink-0">
              <GradientButton
                size="sm"
                className="h-10 w-10 rounded-full p-0"
                aria-label="Idi na dnevni pregled"
              >
                <ArrowRight className="h-5 w-5" />
              </GradientButton>
            </div>
          </div>
        </GlassCard>
      </Link>
    </HoverScale>
  )
}
