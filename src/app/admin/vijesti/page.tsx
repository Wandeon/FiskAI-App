import Link from "next/link"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts } from "@/lib/db/schema/news"
import { desc, sql } from "drizzle-orm"
import { Eye, Pencil, Trash2 } from "lucide-react"

export const dynamic = "force-dynamic"

interface StatusCounts {
  pending: number
  draft: number
  reviewing: number
  published: number
}

async function getStatusCounts(): Promise<StatusCounts> {
  const counts = await drizzleDb
    .select({
      status: newsPosts.status,
      count: sql<number>`count(*)::int`,
    })
    .from(newsPosts)
    .groupBy(newsPosts.status)

  const result: StatusCounts = {
    pending: 0,
    draft: 0,
    reviewing: 0,
    published: 0,
  }

  counts.forEach((row) => {
    if (row.status && row.status in result) {
      result[row.status as keyof StatusCounts] = row.count
    }
  })

  return result
}

async function getPosts() {
  return await drizzleDb.select().from(newsPosts).orderBy(desc(newsPosts.createdAt)).limit(100)
}

export default async function AdminNewsPage() {
  const [statusCounts, posts] = await Promise.all([getStatusCounts(), getPosts()])
  const cronConfigured = Boolean(process.env.CRON_SECRET)
  const aiConfigured = Boolean(
    process.env.OLLAMA_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
  )
  const aiProvider =
    (process.env.NEWS_AI_PROVIDER || process.env.AI_PROVIDER || "").toLowerCase() ||
    (process.env.OLLAMA_API_KEY
      ? "ollama"
      : process.env.DEEPSEEK_API_KEY
        ? "deepseek"
        : process.env.OPENAI_API_KEY
          ? "openai"
          : "")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Vijesti</h2>
          <p className="text-sm text-[var(--muted)]">Upravljanje novostima i AI pipeline-om</p>
        </div>
      </div>

      {(!cronConfigured || !aiConfigured) && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
          <div className="text-sm font-semibold">Napomena (konfiguracija)</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            {!cronConfigured && (
              <li>`CRON_SECRET` nije postavljen — ručno pokretanje cron jobova neće raditi.</li>
            )}
            {!aiConfigured && (
              <li>
                AI ključ nije postavljen — fetch može povući izvore, ali ne može klasificirati i
                napisati članke.
              </li>
            )}
            {aiConfigured && aiProvider && <li>AI provider: {aiProvider}</li>}
          </ul>
        </div>
      )}

      {/* Pipeline Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatusCard label="Pending" count={statusCounts.pending} color="bg-gray-500" />
        <StatusCard label="Draft" count={statusCounts.draft} color="bg-yellow-500" />
        <StatusCard label="Reviewing" count={statusCounts.reviewing} color="bg-blue-500" />
        <StatusCard label="Published" count={statusCounts.published} color="bg-green-500" />
      </div>

      {/* Tonight's Queue Panel */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-card">
        <h3 className="mb-4 text-lg font-semibold">Večerašnji zadaci</h3>
        <div className="space-y-3">
          <CronJob time="23:00" name="Fetch & Classify" job="fetch-classify" />
          <CronJob time="23:30" name="Review" job="review" />
          <CronJob time="00:00" name="Rewrite & Finalize" job="publish" />
        </div>
      </div>

      {/* Posts Table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
        <div className="border-b border-[var(--border)] bg-[var(--surface-secondary)] px-6 py-4">
          <h3 className="text-lg font-semibold">Svi postovi</h3>
        </div>
        <table className="w-full border-collapse">
          <thead className="bg-[var(--surface-secondary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Naslov</th>
              <th className="px-4 py-3">Kategorija</th>
              <th className="px-4 py-3">Utjecaj</th>
              <th className="px-4 py-3">Objavljeno</th>
              <th className="px-4 py-3 text-right">Akcije</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] text-sm">
            {posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  Nema vijesti
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className="hover:bg-[var(--surface-secondary)]/50">
                  <td className="px-4 py-3">
                    <StatusBadge status={post.status} />
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    <div className="max-w-md truncate">{post.title}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{post.categoryId || "—"}</td>
                  <td className="px-4 py-3">
                    <ImpactBadge level={post.impactLevel} />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString("hr-HR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/vijesti/${post.slug}`}
                        className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--surface-secondary)]"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/admin/vijesti/${post.id}`}
                        className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--surface-secondary)]"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        className="rounded-lg border border-[var(--border)] p-2 text-red-500 hover:bg-[var(--surface-secondary)]"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 rounded-full ${color}`} />
        <div>
          <div className="text-xs text-[var(--muted)]">{label}</div>
          <div className="text-2xl font-bold">{count}</div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-500/20 text-gray-700 dark:text-gray-300",
    draft: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
    reviewing: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    published: "bg-green-500/20 text-green-700 dark:text-green-300",
  }

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] || colors.pending}`}
    >
      {status}
    </span>
  )
}

function ImpactBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-[var(--muted)]">—</span>

  const colors: Record<string, string> = {
    high: "bg-red-500/20 text-red-700 dark:text-red-300",
    medium: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
    low: "bg-gray-500/20 text-gray-700 dark:text-gray-300",
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[level] || ""}`}>
      {level}
    </span>
  )
}

function CronJob({ time, name, job }: { time: string; name: string; job: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
      <div className="flex items-center gap-3">
        <div className="font-mono text-sm font-semibold text-[var(--foreground)]">{time}</div>
        <div className="text-sm text-[var(--muted)]">{name}</div>
      </div>
      <div className="flex gap-2">
        <form action="/api/admin/news/cron/trigger" method="POST">
          <input type="hidden" name="job" value={job} />
          <button
            type="submit"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
          >
            Run Now
          </button>
        </form>
        <button className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface-secondary)]">
          Skip
        </button>
      </div>
    </div>
  )
}
