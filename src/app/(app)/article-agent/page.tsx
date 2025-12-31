// src/app/(dashboard)/article-agent/page.tsx

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
  SYNTHESIZING: "bg-info-bg text-info-text",
  PLANNING: "bg-info-bg text-info-text",
  DRAFTING: "bg-warning-bg text-warning-text",
  VERIFYING: "bg-chart-2/10 text-chart-1",
  NEEDS_REVIEW: "bg-warning-bg text-warning-text",
  APPROVED: "bg-success-bg text-success-text",
  PUBLISHED: "bg-success-bg text-success-text",
  REJECTED: "bg-danger-bg text-danger-text",
}

export default async function ArticleAgentPage() {
  await requireAuth()

  const jobs = await db.articleJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Article Agent</h1>
        <Link href="/article-agent/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Job
          </Button>
        </Link>
      </div>

      <div className="bg-[var(--surface)] rounded-lg border">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium">Topic</th>
              <th className="text-left p-4 font-medium">Type</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-left p-4 font-medium">Iteration</th>
              <th className="text-left p-4 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b hover:bg-muted/30">
                <td className="p-4">
                  <Link href={`/article-agent/${job.id}`} className="text-primary hover:underline">
                    {job.topic || "Untitled"}
                  </Link>
                </td>
                <td className="p-4 text-sm text-muted-foreground">{job.type}</td>
                <td className="p-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[job.status] || "bg-surface-2"}`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="p-4 text-sm">
                  {job.currentIteration} / {job.maxIterations}
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {job.createdAt.toLocaleDateString("hr-HR")}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No jobs yet. Create your first article job.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
