"use client"

import { useState, useCallback, useEffect } from "react"
import { SmartDropzone } from "@/components/import/smart-dropzone"
import { ProcessingQueue } from "@/components/import/processing-queue"
import { ConfirmationModal } from "@/components/import/confirmation-modal"
import { ImportJobState } from "@/components/import/processing-card"
import { DocumentType, JobStatus } from "@prisma/client"

interface BankAccount {
  id: string
  name: string
  iban: string
}

interface ImportClientProps {
  bankAccounts: BankAccount[]
  initialJobs: ImportJobState[]
}

export function ImportClient({ bankAccounts, initialJobs }: ImportClientProps) {
  const [jobs, setJobs] = useState<ImportJobState[]>(initialJobs)
  const [selectedAccountId, setSelectedAccountId] = useState<string>(bankAccounts[0]?.id || "")
  const [modalJob, setModalJob] = useState<ImportJobState | null>(null)
  const [modalData, setModalData] = useState<any>(null)

  // Poll for job status updates
  useEffect(() => {
    const pendingIds = jobs
      .filter((j) => j.status === "PENDING" || j.status === "PROCESSING")
      .map((j) => j.id)

    if (pendingIds.length === 0) return

    const interval = setInterval(async () => {
      for (const id of pendingIds) {
        try {
          const res = await fetch(`/api/import/jobs/${id}`)
          const data = await res.json()
          if (data.success && data.job) {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === id
                  ? {
                      ...j,
                      status: data.job.status,
                      documentType: data.job.documentType,
                      progress:
                        data.job.status === "READY_FOR_REVIEW"
                          ? 100
                          : data.job.status === "PROCESSING"
                            ? 50
                            : j.progress,
                      error: data.job.failureReason,
                    }
                  : j
              )
            )
          }
        } catch (e) {
          console.error("Poll failed", e)
        }
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [jobs])

  const handleFilesDropped = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const tempId = `temp-${Date.now()}-${Math.random()}`

        // Add to queue immediately with uploading state
        setJobs((prev) => [
          ...prev,
          {
            id: tempId,
            fileName: file.name,
            status: "PENDING" as JobStatus,
            documentType: null,
            progress: 0,
            error: null,
          },
        ])

        // Upload file
        const formData = new FormData()
        formData.append("file", file)
        if (selectedAccountId) {
          formData.append("bankAccountId", selectedAccountId)
        }

        try {
          const res = await fetch("/api/import/upload", {
            method: "POST",
            body: formData,
          })
          const data = await res.json()

          if (data.success) {
            // Replace temp job with real job
            setJobs((prev) =>
              prev.map((j) =>
                j.id === tempId
                  ? {
                      ...j,
                      id: data.jobId,
                      status: "PROCESSING" as JobStatus,
                      documentType: data.documentType,
                      progress: 25,
                    }
                  : j
              )
            )
          } else {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === tempId
                  ? {
                      ...j,
                      status: "FAILED" as JobStatus,
                      error: data.error,
                    }
                  : j
              )
            )
          }
        } catch (e) {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === tempId
                ? {
                    ...j,
                    status: "FAILED" as JobStatus,
                    error: "Upload failed",
                  }
                : j
            )
          )
        }
      }
    },
    [selectedAccountId]
  )

  const handleView = useCallback(
    async (jobId: string) => {
      const res = await fetch(`/api/import/jobs/${jobId}`)
      const data = await res.json()

      if (data.success) {
        const job = jobs.find((j) => j.id === jobId)
        if (job) {
          setModalJob({ ...job, ...data.job })
          setModalData(data.job.extractedData)
        }
      }
    },
    [jobs]
  )

  const handleConfirm = useCallback(
    async (jobId: string, editedData: any) => {
      const res = await fetch(`/api/import/jobs/${jobId}/confirm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: editedData.transactions,
          bankAccountId: selectedAccountId,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: "CONFIRMED" as JobStatus,
                  transactionCount: data.transactionCount,
                }
              : j
          )
        )
        setModalJob(null)
        setModalData(null)
      }
    },
    [selectedAccountId]
  )

  const handleReject = useCallback(async (jobId: string) => {
    await fetch(`/api/import/jobs/${jobId}/reject`, { method: "PUT" })
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "REJECTED" as JobStatus } : j))
    )
    setModalJob(null)
    setModalData(null)
  }, [])

  const handleRetry = useCallback(async (jobId: string) => {
    // Reset job to pending and trigger reprocess
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, status: "PENDING" as JobStatus, error: null, progress: 0 } : j
      )
    )

    await fetch("/api/import/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    })
  }, [])

  const handleRemove = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }, [])

  const getFileType = (fileName: string): "pdf" | "image" => {
    const ext = fileName.split(".").pop()?.toLowerCase() || ""
    return ["jpg", "jpeg", "png", "heic", "webp"].includes(ext) ? "image" : "pdf"
  }

  return (
    <>
      {/* Bank account selector */}
      <div className="flex items-center gap-4 p-4 bg-surface rounded-xl text-white">
        <div>
          <p className="text-sm text-secondary">Bankovni račun za izvode:</p>
        </div>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="rounded-md border border-subtle bg-surface-elevated px-3 py-2 text-sm"
        >
          {bankAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.iban})
            </option>
          ))}
        </select>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SmartDropzone onFilesDropped={handleFilesDropped} />
        <ProcessingQueue
          jobs={jobs}
          onView={handleView}
          onRetry={handleRetry}
          onRemove={handleRemove}
        />
      </div>

      {/* Confirmation modal */}
      {modalJob && modalData && (
        <ConfirmationModal
          isOpen={true}
          jobId={modalJob.id}
          fileName={modalJob.fileName}
          fileUrl={`/api/import/jobs/${modalJob.id}/file`}
          fileType={getFileType(modalJob.fileName)}
          documentType={modalJob.documentType || DocumentType.BANK_STATEMENT}
          extractedData={modalData}
          bankAccounts={bankAccounts}
          selectedAccountId={selectedAccountId}
          onAccountChange={setSelectedAccountId}
          onConfirm={handleConfirm}
          onReject={handleReject}
          onClose={() => {
            setModalJob(null)
            setModalData(null)
          }}
        />
      )}
    </>
  )
}
