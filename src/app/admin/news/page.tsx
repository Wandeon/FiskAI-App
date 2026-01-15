import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema/news"
import { desc, sql } from "drizzle-orm"
import { NewsTableClient } from "./news-table-client"
import { hasNewsTables } from "@/lib/admin/runtime-capabilities"
import { NotConfigured } from "@/components/admin/not-configured"

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
  const posts = await drizzleDb
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      title: newsPosts.title,
      status: newsPosts.status,
      categoryId: newsPosts.categoryId,
      impactLevel: newsPosts.impactLevel,
      viewCount: newsPosts.viewCount,
      publishedAt: newsPosts.publishedAt,
      createdAt: newsPosts.createdAt,
    })
    .from(newsPosts)
    .orderBy(desc(newsPosts.createdAt))

  // Convert dates to ISO strings for serialization
  return posts.map((post) => ({
    ...post,
    publishedAt: post.publishedAt?.toISOString() || null,
    createdAt: post.createdAt?.toISOString() || new Date().toISOString(),
  }))
}

async function getCategories() {
  return await drizzleDb
    .select({
      id: newsCategories.id,
      nameHr: newsCategories.nameHr,
    })
    .from(newsCategories)
    .orderBy(newsCategories.nameHr)
}

export default async function AdminNewsPage() {
  // Check capability before querying - prevents crash if tables don't exist
  const capability = await hasNewsTables()

  if (!capability.available) {
    return (
      <NotConfigured
        feature="News"
        missingTables={capability.missingTables}
        actionHint={`Run migrations for News tables: ${capability.requiredTables?.join(", ") ?? "unknown"}`}
      />
    )
  }

  const [statusCounts, posts, categories] = await Promise.all([
    getStatusCounts(),
    getPosts(),
    getCategories(),
  ])
  const cronConfigured = Boolean(process.env.CRON_SECRET)
  // Ollama is configured via OLLAMA_ENDPOINT (API key optional for local instances)
  const aiConfigured = Boolean(process.env.OLLAMA_ENDPOINT || process.env.OLLAMA_API_KEY)
  const aiProvider = "ollama" // Ollama is the only supported provider

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
              <li>`CRON_SECRET` nije postavljen — rucno pokretanje cron jobova nece raditi.</li>
            )}
            {!aiConfigured && (
              <li>
                AI kljuc nije postavljen — fetch moze povuci izvore, ali ne moze klasificirati i
                napisati clanke.
              </li>
            )}
            {aiConfigured && aiProvider && <li>AI provider: {aiProvider}</li>}
          </ul>
        </div>
      )}

      {/* Pipeline Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatusCard label="Pending" count={statusCounts.pending} color="bg-surface" />
        <StatusCard label="Draft" count={statusCounts.draft} color="bg-warning" />
        <StatusCard label="Reviewing" count={statusCounts.reviewing} color="bg-interactive" />
        <StatusCard label="Published" count={statusCounts.published} color="bg-success" />
      </div>

      {/* Tonight's Queue Panel */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-card">
        <h3 className="mb-4 text-lg font-semibold">Vecerašnji zadaci</h3>
        <div className="space-y-3">
          <CronJob time="23:00" name="Fetch & Classify" job="fetch-classify" />
          <CronJob time="23:30" name="Review" job="review" />
          <CronJob time="00:00" name="Rewrite & Finalize" job="publish" />
        </div>
      </div>

      {/* Posts Table with Search/Filter */}
      <NewsTableClient initialPosts={posts} categories={categories} />
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
      </div>
    </div>
  )
}
