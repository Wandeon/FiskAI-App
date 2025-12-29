import { ExternalLink, Calendar, UserCheck } from "lucide-react"
import type { Source } from "@/lib/knowledge-hub/types"

interface SourcesProps {
  sources?: Source[]
  lastUpdated?: string
  lastReviewed?: string
  reviewer?: string
}

export function Sources({ sources, lastUpdated, lastReviewed, reviewer }: SourcesProps) {
  const hasContent = sources?.length || lastUpdated || lastReviewed || reviewer

  if (!hasContent) return null

  return (
    <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-6">
      {/* Sources */}
      {sources && sources.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">
            Izvori
          </h3>
          <ul className="space-y-2">
            {sources.map((source, index) => (
              <li key={index}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap gap-4 text-sm text-white/70">
        {lastUpdated && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>
              Ažurirano:{" "}
              {new Date(lastUpdated).toLocaleDateString("hr-HR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        )}
        {reviewer && (
          <div className="flex items-center gap-1.5">
            <UserCheck className="h-4 w-4" />
            <span>Pregledao: {reviewer}</span>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="mt-4 text-xs text-white/50">
        Informativni sadržaj. Za specifične situacije konzultirajte stručnjaka.
      </p>
    </div>
  )
}
