"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CompactDropzone } from "./compact-dropzone"
import { ReportsSidebar } from "./reports-sidebar"
import { ImportJobState } from "@/components/import/processing-card"
import dynamic from "next/dynamic"
import { JobStatus, DocumentType } from "@prisma/client"

// Dynamic import confirmation modal to avoid SSR issues
const ConfirmationModal = dynamic(
  () => import("@/components/import/confirmation-modal").then((mod) => mod.ConfirmationModal),
  { ssr: false }
)

interface BankAccount {
  id: string
  name: string
  iban: string
}

interface DocumentsClientProps {
  bankAccounts: BankAccount[]
  initialJobs?: ImportJobState[]
  children: React.ReactNode
}

type ImportJobPayload = {
  transactions?: Array<Record<string, unknown>>
  items?: Array<Record<string, unknown>>
  warehouseId?: string
  movementDate?: string
  referenceNumber?: string
}

export function DocumentsClient({
  bankAccounts,
  initialJobs = [],
  children,
}: DocumentsClientProps) {
  const router = useRouter()
  const [jobs, setJobs] = useState<ImportJobState[]>(initialJobs)
  const [selectedAccountId, setSelectedAccountId] = useState<string>(bankAccounts[0]?.id || "")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modalJob, setModalJob] = useState<ImportJobState | null>(null)
  const [modalData, setModalData] = useState<ImportJobPayload | null>(null)

  // Determine if we're in processing mode (have active jobs)
  const hasActiveJobs = jobs.some(
    (j) => j.status === "PENDING" || j.status === "PROCESSING" || j.status === "READY_FOR_REVIEW"
  )

  // Auto-open sidebar when there are active jobs
  useEffect(() => {
    if (hasActiveJobs) {
      setSidebarOpen(true)
    } else {
      setSidebarOpen(false)
    }
  }, [hasActiveJobs])

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
      // Open sidebar for processing
      setSidebarOpen(true)

      for (const file of files) {
        const tempId = `temp-${Date.now()}-${Math.random()}`

        // Add to queue immediately
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
        } catch (error) {
          console.error("Upload failed", error)
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

  const handleViewJob = useCallback(
    async (jobId: string) => {
      const res = await fetch(`/api/import/jobs/${jobId}`)
      const data = await res.json()

      if (data.success) {
        const job = jobs.find((j) => j.id === jobId)
        if (job) {
          setModalJob({ ...job, ...data.job })
          setModalData(data.job.extractedData as ImportJobPayload)
        }
      }
    },
    [jobs]
  )

  const handleConfirm = useCallback(
    async (jobId: string, editedData: ImportJobPayload | null) => {
      const transactions = editedData?.transactions ?? []
      const res = await fetch(`/api/import/jobs/${jobId}/confirm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions,
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
        // Soft refresh to re-fetch RSC data without full page reload
        router.refresh()
      }
    },
    [selectedAccountId, router]
  )

  const handleReject = useCallback(async (jobId: string) => {
    await fetch(`/api/import/jobs/${jobId}/reject`, { method: "PUT" })
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "REJECTED" as JobStatus } : j))
    )
    setModalJob(null)
    setModalData(null)
  }, [])

  const handleRetryJob = useCallback(async (jobId: string) => {
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

  const handleRemoveJob = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }, [])

  const handleTypeChange = useCallback(async (jobId: string, newType: DocumentType) => {
    // Optimistically update the UI
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, documentType: newType, status: "PENDING" as JobStatus, progress: 0 }
          : j
      )
    )

    try {
      const res = await fetch(`/api/import/jobs/${jobId}/type`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: newType }),
      })
      const data = await res.json()

      if (!data.success) {
        // Revert on failure
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, error: data.error || "Failed to change type" } : j
          )
        )
      }
    } catch (e) {
      console.error("Failed to change document type:", e)
    }
  }, [])

  // Handle document type change from the confirmation modal
  const handleModalTypeChange = useCallback(
    async (newType: DocumentType) => {
      if (!modalJob) return

      // Close modal while reprocessing
      setModalJob(null)
      setModalData(null)

      // Trigger type change and reprocessing
      await handleTypeChange(modalJob.id, newType as DocumentType)
    },
    [modalJob, handleTypeChange]
  )

  const getFileType = (fileName: string): "PDF" | "IMAGE" => {
    const ext = fileName.split(".").pop()?.toLowerCase() || ""
    return ["jpg", "jpeg", "png", "heic", "webp"].includes(ext) ? "IMAGE" : "PDF"
  }

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Compact dropzone */}
        <CompactDropzone
          onFilesDropped={handleFilesDropped}
          bankAccounts={bankAccounts}
          selectedAccountId={selectedAccountId}
          onAccountChange={setSelectedAccountId}
        />

        {/* Rest of the page content (passed as children) */}
        {children}
      </div>

      {/* Processing Sidebar - only shows when there are active jobs */}
      <ReportsSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        mode="processing"
        processingJobs={jobs.filter((j) => j.status !== "CONFIRMED" && j.status !== "REJECTED")}
        onViewJob={handleViewJob}
        onRetryJob={handleRetryJob}
        onRemoveJob={handleRemoveJob}
        onTypeChange={handleTypeChange}
      />

      {/* Confirmation modal */}
      {modalJob && modalData && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => {
            setModalJob(null)
            setModalData(null)
          }}
          onConfirm={() => handleConfirm(modalJob.id, modalData)}
          onDiscard={() => handleReject(modalJob.id)}
          filename={modalJob.fileName}
          fileType={getFileType(modalJob.fileName)}
          fileUrl={`/api/import/jobs/${modalJob.id}/file`}
          documentType={modalJob.documentType === "BANK_STATEMENT" ? "BANK_STATEMENT" : "INVOICE"}
          onDocumentTypeChange={handleModalTypeChange}
          // Bank statement props
          transactions={modalData.transactions}
          openingBalance={modalData.openingBalance}
          closingBalance={modalData.closingBalance}
          mathValid={modalData.mathValid}
          onTransactionsChange={(txns) => setModalData({ ...modalData, transactions: txns })}
          selectedBankAccount={selectedAccountId}
          onBankAccountChange={setSelectedAccountId}
          bankAccounts={bankAccounts}
          // Invoice props - pass the whole modalData as invoice data if it's an invoice
          invoiceData={modalJob.documentType === "INVOICE" ? modalData : undefined}
          onInvoiceDataChange={(data) => setModalData(data)}
        />
      )}
    </div>
  )
}
