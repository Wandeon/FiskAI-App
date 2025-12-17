// src/app/(dashboard)/article-agent/[id]/page.tsx

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Eye, FileText } from "lucide-react"

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  await requireAuth()

  const job = await db.articleJob.findUnique({
    where: { id: params.id },
    include: {
      factSheet: {
        include: { claims: true, sourceChunks: true },
      },
      drafts: {
        orderBy: { iteration: "desc" },
        include: { paragraphs: true },
      },
    },
  })

  if (!job) {
    notFound()
  }

  const latestDraft = job.drafts[0]

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/article-agent"
          className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Natrag na listu
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{job.topic || "Untitled"}</h1>
          <p className="text-muted-foreground mt-1">
            {job.type} · Iteracija {job.currentIteration} / {job.maxIterations}
          </p>
        </div>
        <div className="flex gap-2">
          {job.factSheet && (
            <Link href={`/article-agent/${job.id}/factsheet`}>
              <Button variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Fact Sheet ({job.factSheet.claims.length} tvrdnji)
              </Button>
            </Link>
          )}
          {latestDraft && (
            <Link href={`/article-agent/${job.id}/review`}>
              <Button size="sm">
                <Eye className="w-4 h-4 mr-2" />
                Pregledaj
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="font-medium mb-4">Status</h2>
        <div className="flex items-center gap-4">
          <StatusStep
            label="Sinteza"
            active={job.status === "SYNTHESIZING"}
            done={!!job.factSheet}
          />
          <StatusStep
            label="Pisanje"
            active={job.status === "DRAFTING"}
            done={job.drafts.length > 0}
          />
          <StatusStep
            label="Verifikacija"
            active={job.status === "VERIFYING"}
            done={job.status === "APPROVED" || job.status === "NEEDS_REVIEW"}
          />
          <StatusStep
            label={job.status === "NEEDS_REVIEW" ? "Pregled" : "Gotovo"}
            active={job.status === "NEEDS_REVIEW" || job.status === "APPROVED"}
            done={job.status === "PUBLISHED"}
          />
        </div>
      </div>

      {/* Source URLs */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="font-medium mb-4">Izvori ({job.sourceUrls.length})</h2>
        <ul className="space-y-2">
          {job.sourceUrls.map((url, i) => (
            <li key={i}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline truncate block"
              >
                {url}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Draft Preview */}
      {latestDraft && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-medium mb-4">Nacrt (iteracija {latestDraft.iteration})</h2>
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm">{latestDraft.contentMdx}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-3 h-3 rounded-full ${
          done ? "bg-green-500" : active ? "bg-blue-500 animate-pulse" : "bg-gray-200"
        }`}
      />
      <span className={`text-sm ${active ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
    </div>
  )
}
