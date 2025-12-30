"use client"

import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import Link from "next/link"
import type { ImportJob, BankAccount } from "@prisma/client"

type JobWithAccount = ImportJob & {
  bankAccount: Pick<BankAccount, "name" | "iban">
}

type Props = {
  jobs: JobWithAccount[]
}

export function DocumentsTable({ jobs: initialJobs }: Props) {
  const jobs = initialJobs

  if (!jobs.length) {
    return <div className="p-6 text-sm text-secondary">Nema dokumenata.</div>
  }

  return (
    <div className="overflow-x-auto space-y-2">
      <p className="text-xs text-secondary">
        Bankovni uvozi su nepromjenjivi zbog revizijskog traga.
      </p>
      <table className="w-full text-sm">
        <thead className="bg-surface-1 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">
              Datoteka
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">
              Račun
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">
              Stranice
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">
              Uploadano
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase">
              Akcije
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className="px-4 py-3 font-mono text-xs text-foreground">{job.originalName}</td>
              <td className="px-4 py-3 text-xs text-foreground">
                {job.bankAccount.name}
                <div className="text-[11px] text-secondary">{job.bankAccount.iban}</div>
              </td>
              <td className="px-4 py-3 text-xs">
                <span
                  className={`px-2 py-1 rounded ${
                    job.status === "VERIFIED"
                      ? "bg-success-bg text-success-text"
                      : job.status === "NEEDS_REVIEW"
                        ? "bg-warning-bg text-warning-text"
                        : job.status === "FAILED"
                          ? "bg-danger-bg text-danger-text"
                          : "bg-info-bg text-info-text"
                  }`}
                >
                  {job.status}
                </span>
                {job.failureReason && (
                  <div className="text-[11px] text-danger-text mt-1">{job.failureReason}</div>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-foreground">
                {job.pagesProcessed ?? 0}
                {job.pagesFailed ? ` · failed ${job.pagesFailed}` : ""}
              </td>
              <td className="px-4 py-3 text-xs text-foreground">
                {new Date(job.createdAt).toLocaleString("hr-HR")}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link href={`/banking/documents/${job.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
