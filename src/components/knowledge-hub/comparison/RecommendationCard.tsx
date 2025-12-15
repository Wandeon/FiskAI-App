// src/components/knowledge-hub/comparison/RecommendationCard.tsx
// Temporary stub - full implementation in Task 1.8

interface RecommendationCardProps {
  businessType: string
  reason: string
  revenueRange?: string
}

export function RecommendationCard({
  businessType,
  reason,
  revenueRange,
}: RecommendationCardProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-4">
      <h3 className="font-semibold text-blue-900 mb-2">Preporuka: {businessType}</h3>
      <p className="text-blue-800">{reason}</p>
      {revenueRange && <p className="text-sm text-blue-600 mt-2">Za prihode: {revenueRange}</p>}
    </div>
  )
}
