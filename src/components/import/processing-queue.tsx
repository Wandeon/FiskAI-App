"use client"

import { ProcessingCard, ImportJobState } from "./processing-card"

interface ProcessingQueueProps {
  jobs: ImportJobState[]
  onView: (jobId: string) => void
  onRetry: (jobId: string) => void
  onRemove: (jobId: string) => void
}

export function ProcessingQueue({ jobs, onView, onRetry, onRemove }: ProcessingQueueProps) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-default p-6 text-center">
        <p className="text-sm text-tertiary">Nema dokumenata u redu čekanja</p>
        <p className="text-xs text-muted mt-1">Povucite datoteke u dropzonu za početak</p>
      </div>
    )
  }

  // Calculate queue positions for ready-for-review items
  const readyJobs = jobs.filter((j) => j.status === "READY_FOR_REVIEW")
  const firstReadyId = readyJobs[0]?.id

  const jobsWithPosition = jobs.map((job) => {
    if (job.status === "READY_FOR_REVIEW") {
      const position = readyJobs.findIndex((j) => j.id === job.id) + 1
      return {
        ...job,
        queuePosition: position,
        totalInQueue: readyJobs.length,
      }
    }
    return job
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Red čekanja</h3>
        <span className="text-xs text-tertiary">
          {jobs.length} {jobs.length === 1 ? "datoteka" : "datoteka"}
        </span>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {jobsWithPosition.map((job) => (
          <ProcessingCard
            key={job.id}
            job={job}
            onView={onView}
            onRetry={onRetry}
            onRemove={onRemove}
            isCurrentForReview={job.id === firstReadyId}
          />
        ))}
      </div>
    </div>
  )
}
