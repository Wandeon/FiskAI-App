import { cn } from "@/lib/utils"

interface RecommendationCardProps {
  businessType: string
  title: string
  bestFor: string[]
  notSuitableFor?: string[]
  highlighted?: boolean
}

export function RecommendationCard({
  businessType,
  title,
  bestFor,
  notSuitableFor,
  highlighted = false,
}: RecommendationCardProps) {
  return (
    <div
      className={cn(
        "border rounded-lg p-5",
        highlighted ? "border-green-500 bg-green-50" : "border-gray-200"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-lg">{title}</h3>
        {highlighted && (
          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">
            Preporučeno za vas
          </span>
        )}
      </div>

      <div className="space-y-3">
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

      <a
        href={`/vodic/${businessType}`}
        className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800"
      >
        Saznaj više o {title} →
      </a>
    </div>
  )
}
