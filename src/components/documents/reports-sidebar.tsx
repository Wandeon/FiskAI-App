"use client"

import { useState } from "react"
import Link from "next/link"
import {
  X,
  BarChart3,
  FileText,
  Clock,
  TrendingUp,
  Users,
  Download,
  BookOpen,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProcessingCard, ImportJobState } from "@/components/import/processing-card"

const REPORTS = [
  {
    href: "/reports/vat",
    title: "PDV obrazac",
    description: "Ulazni i izlazni PDV",
    icon: BarChart3,
  },
  {
    href: "/reports/profit-loss",
    title: "Dobit i gubitak",
    description: "Prihodi vs rashodi",
    icon: TrendingUp,
  },
  {
    href: "/reports/aging",
    title: "Starost potraživanja",
    description: "Dospjeli računi",
    icon: Clock,
  },
  {
    href: "/reports/expenses",
    title: "Troškovi po kategoriji",
    description: "Analiza rashoda",
    icon: BarChart3,
  },
  {
    href: "/reports/revenue",
    title: "Prihodi po kupcu",
    description: "Analiza prihoda",
    icon: Users,
  },
  { href: "/reports/kpr", title: "KPR / PO-SD", description: "Plaćeni računi", icon: BookOpen },
  {
    href: "/reports/export",
    title: "Izvoz podataka",
    description: "CSV za računovođu",
    icon: Download,
  },
]

interface ReportsSidebarProps {
  isOpen: boolean
  onClose: () => void
  mode: "reports" | "processing"
  processingJobs?: ImportJobState[]
  onViewJob?: (jobId: string) => void
  onRetryJob?: (jobId: string) => void
  onRemoveJob?: (jobId: string) => void
  onTypeChange?: (jobId: string, newType: import("@prisma/client").DocumentType) => void
}

export function ReportsSidebar({
  isOpen,
  onClose,
  mode,
  processingJobs = [],
  onViewJob,
  onRetryJob,
  onRemoveJob,
  onTypeChange,
}: ReportsSidebarProps) {
  const readyJobs = processingJobs.filter((j) => j.status === "READY_FOR_REVIEW")
  const firstReadyId = readyJobs[0]?.id

  return (
    <>
      {/* Backdrop */}
      {isOpen && <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <div
        className={`
          fixed right-0 top-0 h-full w-80 bg-surface border-l border-default shadow-xl z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
          lg:relative lg:transform-none lg:shadow-none lg:z-auto
          ${isOpen ? "lg:w-80" : "lg:w-0 lg:border-0 lg:overflow-hidden"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-foreground">
            {mode === "reports" ? "Izvještaji" : "Uvoz dokumenata"}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-2 rounded-lg lg:hidden">
            <X className="h-5 w-5 text-tertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto h-[calc(100%-60px)]">
          {mode === "reports" ? (
            <div className="space-y-2">
              {REPORTS.map((report) => {
                const Icon = report.icon
                return (
                  <Link
                    key={report.href}
                    href={report.href}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-1 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-surface-2 group-hover:bg-info-bg transition-colors">
                      <Icon className="h-4 w-4 text-secondary group-hover:text-link" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{report.title}</p>
                      <p className="text-xs text-tertiary truncate">{report.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted group-hover:text-secondary" />
                  </Link>
                )
              })}

              <div className="pt-4 mt-4 border-t">
                <Link
                  href="/reports"
                  className="flex items-center justify-center gap-2 p-3 rounded-lg bg-surface-1 hover:bg-surface-2 transition-colors text-sm font-medium text-foreground"
                >
                  <BarChart3 className="h-4 w-4" />
                  Svi izvještaji
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {processingJobs.length === 0 ? (
                <div className="text-center py-8 text-tertiary">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted" />
                  <p className="text-sm">Nema dokumenata u obradi</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-tertiary mb-3">
                    {processingJobs.length}{" "}
                    {processingJobs.length === 1 ? "dokument" : "dokumenata"} u redu
                  </p>
                  {processingJobs.map((job) => (
                    <ProcessingCard
                      key={job.id}
                      job={{
                        ...job,
                        queuePosition: readyJobs.findIndex((j) => j.id === job.id) + 1 || undefined,
                        totalInQueue: readyJobs.length || undefined,
                      }}
                      onView={onViewJob || (() => {})}
                      onRetry={onRetryJob || (() => {})}
                      onRemove={onRemoveJob || (() => {})}
                      onTypeChange={onTypeChange}
                      isCurrentForReview={job.id === firstReadyId}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
