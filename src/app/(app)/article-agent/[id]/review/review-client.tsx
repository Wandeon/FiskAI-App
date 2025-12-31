// src/app/(dashboard)/article-agent/[id]/review/review-client.tsx

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { approveJob, rejectJob, lockParagraph, triggerRewrite } from "@/app/actions/article-agent"
import { CheckCircle, XCircle, Lock, RotateCcw, ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { ArticleJob, ArticleDraft, FactSheet, DraftParagraph, Claim } from "@prisma/client"

interface Props {
  job: ArticleJob
  draft: ArticleDraft & { paragraphs: DraftParagraph[] }
  factSheet: (FactSheet & { claims: Claim[] }) | null
}

export function ReviewClient({ job, draft, factSheet }: Props) {
  const router = useRouter()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    draft.paragraphs.find((p) => !p.isLocked && (p.confidence || 0) < 0.8)?.index ?? null
  )

  const selectedPara =
    selectedIndex !== null ? draft.paragraphs.find((p) => p.index === selectedIndex) : null

  const passCount = draft.paragraphs.filter((p) => p.isLocked || (p.confidence || 0) >= 0.8).length
  const failCount = draft.paragraphs.length - passCount

  const handleApprove = async () => {
    await approveJob(job.id)
    router.push("/article-agent")
  }

  const handleReject = async () => {
    await rejectJob(job.id)
    router.push("/article-agent")
  }

  const handleLock = async () => {
    if (selectedIndex !== null) {
      await lockParagraph(job.id, selectedIndex)
      router.refresh()
    }
  }

  const handleIterate = async () => {
    await triggerRewrite(job.id)
    router.refresh()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/article-agent/${job.id}`}>
            <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-primary" />
          </Link>
          <div>
            <h1 className="font-semibold">{job.topic || "Review"}</h1>
            <p className="text-sm text-muted-foreground">
              Iteracija {job.currentIteration} · {passCount} prošlo · {failCount} za pregled
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Paragraphs */}
        <div className="w-1/2 border-r overflow-y-auto p-6 space-y-4">
          {draft.paragraphs.map((para) => (
            <ParagraphCard
              key={para.id}
              paragraph={para}
              isSelected={selectedIndex === para.index}
              onClick={() => setSelectedIndex(para.index)}
            />
          ))}
        </div>

        {/* Right: Evidence */}
        <div className="w-1/2 overflow-y-auto p-6">
          {selectedPara ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Paragraf {selectedPara.index + 1}
                </h3>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedPara.content}</p>
              </div>

              {!selectedPara.isLocked && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleLock}>
                    <Lock className="w-4 h-4 mr-1" />
                    Zaključaj
                  </Button>
                </div>
              )}

              {factSheet && (
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    Dostupne tvrdnje ({factSheet.claims.length})
                  </h3>
                  <div className="space-y-2">
                    {factSheet.claims.slice(0, 10).map((claim) => (
                      <div key={claim.id} className="text-sm p-2 bg-muted/30 rounded border">
                        <p>{claim.statement}</p>
                        {claim.quote && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            &quot;{claim.quote}&quot;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Odaberi paragraf za pregled
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-6 py-4 flex items-center justify-between bg-background">
        <div className="text-sm text-muted-foreground">
          {failCount === 0 ? (
            <span className="text-success-text">✓ Svi paragrafi prolaze</span>
          ) : (
            <span className="text-warning-text">{failCount} paragraf(a) ispod praga</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleReject}>
            <XCircle className="w-4 h-4 mr-2" />
            Odbaci
          </Button>
          {job.currentIteration < job.maxIterations && failCount > 0 && (
            <Button variant="outline" onClick={handleIterate}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Nova iteracija
            </Button>
          )}
          <Button onClick={handleApprove}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Odobri
          </Button>
        </div>
      </div>
    </div>
  )
}

function ParagraphCard({
  paragraph,
  isSelected,
  onClick,
}: {
  paragraph: DraftParagraph
  isSelected: boolean
  onClick: () => void
}) {
  const confidence = paragraph.confidence || 0
  const isLocked = paragraph.isLocked

  const borderColor = isLocked
    ? "border-focus bg-info-bg/50"
    : confidence >= 0.8
      ? "border-success-border bg-success-bg/50"
      : confidence >= 0.5
        ? "border-warning bg-warning-bg/50"
        : "border-danger-border bg-danger-bg/50"

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${borderColor} ${
        isSelected ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
    >
      <p className="text-sm line-clamp-3">{paragraph.content}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className={isLocked ? "text-link" : ""}>
          {isLocked ? "Zaključano" : `${Math.round(confidence * 100)}%`}
        </span>
      </div>
    </button>
  )
}
