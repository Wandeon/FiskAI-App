import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { hr } from "date-fns/locale"

interface NewsCardProps {
  title: string
  summary: string
  categories: string[]
  publishedAt: Date
  sourceUrl: string
  relevanceScore?: number
}

const categoryLabels: Record<string, string> = {
  tax: "Porezi",
  vat: "PDV",
  payroll: "Plaće",
  compliance: "Usklađenost",
  reporting: "Izvještavanje",
  legislation: "Zakonodavstvo",
  business: "Poslovanje",
  finance: "Financije",
}

export function NewsCard({
  title,
  summary,
  categories,
  publishedAt,
  sourceUrl,
  relevanceScore,
}: NewsCardProps) {
  return (
    <article className="rounded-xl border border-white/10 bg-surface/5 p-6 transition-colors hover:bg-surface/10">
      <div className="mb-3 flex flex-wrap gap-2">
        {categories.slice(0, 3).map((cat) => (
          <span
            key={cat}
            className="rounded-full bg-interactive/20 px-2 py-0.5 text-xs font-medium text-blue-300"
          >
            {categoryLabels[cat] || cat}
          </span>
        ))}
        {relevanceScore && relevanceScore >= 70 && (
          <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-green-300">
            Važno
          </span>
        )}
      </div>

      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mb-4 text-sm text-white/70">{summary}</p>

      <div className="flex items-center justify-between text-xs text-white/50">
        <time dateTime={publishedAt.toISOString()}>
          {formatDistanceToNow(publishedAt, { addSuffix: true, locale: hr })}
        </time>
        <Link
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link hover:text-blue-300"
        >
          Izvor →
        </Link>
      </div>
    </article>
  )
}
