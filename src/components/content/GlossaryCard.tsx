import Link from "next/link"
import { BookOpen, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface GlossaryCardProps {
  term: string
  definition: string
  relatedTerms?: string[]
  className?: string
}

export function GlossaryCard({ term, definition, relatedTerms, className }: GlossaryCardProps) {
  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/5 p-6", className)}>
      <div className="mb-3 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-accent" />
        <h2 className="text-2xl font-bold text-white">{term}</h2>
      </div>
      <p className="mb-4 text-lg text-white/90">{definition}</p>

      {relatedTerms && relatedTerms.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <h3 className="mb-2 text-sm font-semibold text-white/70">Povezani pojmovi</h3>
          <div className="flex flex-wrap gap-2">
            {relatedTerms.map((relatedTerm) => (
              <Link
                key={relatedTerm}
                href={`/rjecnik/${relatedTerm.toLowerCase().replace(/\s+/g, "-")}`}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm text-white/90 hover:bg-white/20"
              >
                {relatedTerm}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
