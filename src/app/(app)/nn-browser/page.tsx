import Link from "next/link"
import { dbReg } from "@/lib/db"

async function getYearStats() {
  // ⚠️ AUDIT FIX: Use docMeta.nnYear for grouping, NOT fetchedAt
  // fetchedAt is when we scraped it, nnYear is the actual publication year
  const stats = await dbReg.$queryRaw<
    Array<{
      year: number
      issue_count: bigint
      item_count: bigint
    }>
  >`
    SELECT
      (pd."docMeta"->>'nnYear')::int as year,
      COUNT(DISTINCT (pd."docMeta"->>'nnIssue')::int) as issue_count,
      COUNT(*) as item_count
    FROM "ParsedDocument" pd
    WHERE pd."isLatest" = true
      AND pd.status = 'SUCCESS'
      AND (pd."docMeta"->>'nnYear') IS NOT NULL
    GROUP BY (pd."docMeta"->>'nnYear')::int
    ORDER BY year DESC
  `

  return stats.map((s) => ({
    year: s.year,
    issueCount: Number(s.issue_count),
    itemCount: Number(s.item_count),
  }))
}

export default async function NNBrowserIndex() {
  const yearStats = await getYearStats()

  return (
    <div>
      <h2 className="text-lg font-medium text-foreground mb-4">Browse by Year</h2>

      {yearStats.length === 0 ? (
        <p className="text-muted-foreground">No parsed documents found.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {yearStats.map(({ year, issueCount, itemCount }) => (
            <Link
              key={year}
              href={`/nn-browser/${year}`}
              className="block p-4 bg-surface rounded-lg border border-border hover:border-interactive hover:shadow-sm transition-all"
            >
              <div className="text-2xl font-bold text-foreground">{year}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {issueCount} issues · {itemCount} items
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
