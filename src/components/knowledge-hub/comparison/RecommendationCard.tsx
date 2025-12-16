import { cn } from "@/lib/utils"
import { ReactNode } from "react"

const typeLabels: Record<string, { title: string; slug: string }> = {
  pausalni: { title: "Paušalni obrt", slug: "pausalni-obrt" },
  "obrt-dohodak": { title: "Obrt na dohodak", slug: "obrt-dohodak" },
  jdoo: { title: "J.D.O.O.", slug: "doo" },
  doo: { title: "D.O.O.", slug: "doo" },
  freelancer: { title: "Freelancer", slug: "freelancer" },
}

interface RecommendationCardProps {
  type?: string
  businessType?: string
  title?: string
  bestFor?: string[]
  notSuitableFor?: string[]
  highlighted?: boolean
  children?: ReactNode
}

export function RecommendationCard({
  type,
  businessType,
  title,
  bestFor,
  notSuitableFor,
  highlighted = false,
  children,
}: RecommendationCardProps) {
  // If children are provided (MDX usage), render simplified card
  if (children) {
    const typeInfo = type ? typeLabels[type] : null
    const displayTitle = title || typeInfo?.title || type || "Opcija"
    const slug = businessType || typeInfo?.slug || type || ""

    return (
      <div
        className={cn(
          "border rounded-lg p-5 my-4",
          highlighted ? "border-green-500 bg-green-50" : "border-gray-200"
        )}
      >
        <div className="prose prose-sm max-w-none">{children}</div>
        {slug && (
          <a
            href={`/vodic/${slug}`}
            className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800"
          >
            Saznaj više o {displayTitle} →
          </a>
        )}
      </div>
    )
  }

  // Original prop-based approach
  const displayTitle = title || (type ? typeLabels[type]?.title : "") || "Opcija"
  const slug = businessType || (type ? typeLabels[type]?.slug : "") || ""

  return (
    <div
      className={cn(
        "border rounded-lg p-5",
        highlighted ? "border-green-500 bg-green-50" : "border-gray-200"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-lg">{displayTitle}</h3>
        {highlighted && (
          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">
            Preporučeno za vas
          </span>
        )}
      </div>

      <div className="space-y-3">
        {bestFor && bestFor.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-green-700 mb-1">Najbolje za:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {bestFor.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {notSuitableFor && notSuitableFor.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-red-700 mb-1">Nije idealno za:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {notSuitableFor.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {slug && (
        <a
          href={`/vodic/${slug}`}
          className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
          Saznaj više o {displayTitle} →
        </a>
      )}
    </div>
  )
}
