"use client"

import { FileText, CheckCircle2, AlertCircle, Loader2, X, Eye, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

// Local types for import job (containment: removed @prisma/client import)
type DocumentType = "BANK_STATEMENT" | "INVOICE" | "EXPENSE" | "PRIMKA" | "IZDATNICA"
type JobStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY_FOR_REVIEW"
  | "CONFIRMED"
  | "REJECTED"
  | "VERIFIED"
  | "NEEDS_REVIEW"
  | "FAILED"

export interface ImportJobState {
  id: string
  fileName: string
  status: JobStatus
  documentType: DocumentType | null
  progress: number // 0-100
  error: string | null
  transactionCount?: number
  queuePosition?: number
  totalInQueue?: number
}

interface ProcessingCardProps {
  job: ImportJobState
  onView: (jobId: string) => void
  onRetry: (jobId: string) => void
  onRemove: (jobId: string) => void
  onTypeChange?: (jobId: string, newType: DocumentType) => void
  isCurrentForReview?: boolean
}

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; icon: typeof Loader2 }> = {
  PENDING: { label: "U redu čekanja...", color: "text-tertiary", icon: Loader2 },
  PROCESSING: { label: "Obrada...", color: "text-link", icon: Loader2 },
  READY_FOR_REVIEW: { label: "Spreman za pregled", color: "text-warning-text", icon: Eye },
  CONFIRMED: { label: "Potvrđeno", color: "text-success-text", icon: CheckCircle2 },
  REJECTED: { label: "Odbijeno", color: "text-muted", icon: X },
  VERIFIED: { label: "Verificirano", color: "text-success-text", icon: CheckCircle2 },
  NEEDS_REVIEW: { label: "Potreban pregled", color: "text-warning-text", icon: AlertCircle },
  FAILED: { label: "Greška", color: "text-danger-text", icon: AlertCircle },
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  BANK_STATEMENT: "Bankovni izvod",
  INVOICE: "Račun",
  EXPENSE: "Trošak",
  PRIMKA: "Primka",
  IZDATNICA: "Izdatnica",
}

export function ProcessingCard({
  job,
  onView,
  onRetry,
  onRemove,
  onTypeChange,
  isCurrentForReview,
}: ProcessingCardProps) {
  const config = STATUS_CONFIG[job.status]
  const StatusIcon = config.icon
  const isProcessing = job.status === "PENDING" || job.status === "PROCESSING"
  const canView = job.status === "READY_FOR_REVIEW"
  const canRetry = job.status === "FAILED"
  const isDone = job.status === "CONFIRMED" || job.status === "REJECTED"
  const canChangeType = job.status === "READY_FOR_REVIEW" || job.status === "FAILED"

  return (
    <div
      className={`
      rounded-lg border p-4 transition-all
      ${isCurrentForReview ? "border-focus bg-info-bg ring-2 ring-blue-200" : "border-default bg-surface"}
      ${isDone ? "opacity-60" : ""}
    `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            <FileText className="h-5 w-5 text-muted" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm text-foreground truncate" title={job.fileName}>
              {job.fileName}
            </p>
            {job.documentType && !canChangeType && (
              <p className="text-xs text-tertiary mt-0.5">{DOC_TYPE_LABELS[job.documentType]}</p>
            )}
            {canChangeType && onTypeChange && (
              <select
                value={job.documentType || "INVOICE"}
                onChange={(e) => onTypeChange(job.id, e.target.value as DocumentType)}
                className="mt-1 text-xs border border-default rounded px-2 py-1 bg-surface focus:ring-2 focus:ring-border-focus"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="BANK_STATEMENT">Bankovni izvod</option>
                <option value="INVOICE">Račun</option>
                <option value="EXPENSE">Trošak</option>
                <option value="PRIMKA">Primka</option>
                <option value="IZDATNICA">Izdatnica</option>
              </select>
            )}
          </div>
        </div>

        {!isDone && (
          <button
            onClick={() => onRemove(job.id)}
            className="flex-shrink-0 p-1 hover:bg-surface-2 rounded"
            title="Ukloni"
          >
            <X className="h-4 w-4 text-muted" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {isProcessing && (
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-interactive transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${config.color} ${isProcessing ? "animate-spin" : ""}`} />
          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
        </div>

        {job.queuePosition && job.totalInQueue && job.totalInQueue > 1 && canView && (
          <span className="text-xs text-muted">
            {job.queuePosition} od {job.totalInQueue}
          </span>
        )}
      </div>

      {/* Error message */}
      {job.error && <p className="mt-2 text-xs text-danger-text line-clamp-2">{job.error}</p>}

      {/* Transaction count for confirmed */}
      {job.status === "CONFIRMED" && job.transactionCount !== undefined && (
        <p className="mt-2 text-xs text-success-text">{job.transactionCount} transakcija uvezeno</p>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        {canView && (
          <Button size="sm" onClick={() => onView(job.id)} className="flex-1">
            <Eye className="h-4 w-4 mr-1" />
            Pregledaj
          </Button>
        )}
        {canRetry && (
          <Button size="sm" variant="outline" onClick={() => onRetry(job.id)} className="flex-1">
            <RotateCcw className="h-4 w-4 mr-1" />
            Pokušaj ponovo
          </Button>
        )}
      </div>
    </div>
  )
}
