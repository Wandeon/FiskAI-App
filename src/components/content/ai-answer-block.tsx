import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type AnswerType = "regulatory_answer" | "guide" | "glossary" | "faq"
export type Jurisdiction = "HR" | "EU"

export interface AIAnswerSource {
  id: string
  title: string
  url?: string
  citation?: string
}

export interface AIAnswerBlockProps {
  type: AnswerType
  jurisdiction?: Jurisdiction
  confidence?: number
  sourcesCount?: number
  asOfDate: string
  title: string
  children: ReactNode
  sources?: AIAnswerSource[]
  className?: string
}

export function AIAnswerBlock({
  type,
  jurisdiction = "HR",
  confidence,
  sourcesCount,
  asOfDate,
  title,
  children,
  sources,
  className,
}: AIAnswerBlockProps) {
  // Format date for display in Croatian locale
  const displayDate = new Date(asOfDate).toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <article
      data-ai-answer="true"
      data-answer-type={type}
      data-jurisdiction={jurisdiction}
      {...(confidence !== undefined && { "data-confidence": confidence.toString() })}
      {...(sourcesCount !== undefined && { "data-sources-count": sourcesCount.toString() })}
      data-asof-date={asOfDate}
      className={cn("ai-answer-block", className)}
    >
      <header className="ai-answer-header mb-6">
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <div className="ai-answer-meta flex items-center gap-4 text-sm text-white/70">
          <span className="jurisdiction px-2 py-1 bg-white/10 rounded">{jurisdiction}</span>
          <time dateTime={asOfDate}>Azurirano: {displayDate}</time>
        </div>
      </header>

      <main className="ai-answer-content prose prose-invert max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-cyan-400 prose-strong:text-white">
        {children}
      </main>

      {sources && sources.length > 0 && (
        <footer className="ai-answer-sources mt-8 pt-6 border-t border-white/10">
          <h2 className="text-lg font-semibold mb-4">Izvori</h2>
          <ol className="list-decimal list-inside space-y-2">
            {sources.map((source) => (
              <li key={source.id} id={`source-${source.id}`} className="text-sm">
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link hover:underline"
                  >
                    {source.title}
                  </a>
                ) : (
                  <span>{source.title}</span>
                )}
                {source.citation && (
                  <cite className="block text-white/50 ml-6 mt-1 not-italic">
                    {source.citation}
                  </cite>
                )}
              </li>
            ))}
          </ol>
        </footer>
      )}
    </article>
  )
}
