'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2, Eye } from 'lucide-react'
import Link from 'next/link'
import type { ImportJob, BankAccount } from '@prisma/client'

type JobWithAccount = ImportJob & {
  bankAccount: Pick<BankAccount, 'name' | 'iban'>
}

type Props = {
  jobs: JobWithAccount[]
}

export function DocumentsTable({ jobs: initialJobs }: Props) {
  const [jobs, setJobs] = useState<JobWithAccount[]>(initialJobs)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/banking/import/jobs/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        alert(json.error || 'Brisanje nije uspjelo')
      } else {
        setJobs((prev) => prev.filter((j) => j.id !== id))
      }
    } finally {
      setDeleting(null)
    }
  }

  if (!jobs.length) {
    return <div className="p-6 text-sm text-gray-500">Nema dokumenata.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datoteka</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Račun</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stranice</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploadano</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Akcije</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className="px-4 py-3 font-mono text-xs text-gray-700">{job.originalName}</td>
              <td className="px-4 py-3 text-xs text-gray-700">
                {job.bankAccount.name}
                <div className="text-[11px] text-gray-500">{job.bankAccount.iban}</div>
              </td>
              <td className="px-4 py-3 text-xs">
                <span
                  className={`px-2 py-1 rounded ${
                    job.status === 'VERIFIED'
                      ? 'bg-green-100 text-green-700'
                      : job.status === 'NEEDS_REVIEW'
                        ? 'bg-amber-100 text-amber-700'
                        : job.status === 'FAILED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {job.status}
                </span>
                {job.failureReason && (
                  <div className="text-[11px] text-red-600 mt-1">{job.failureReason}</div>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-gray-700">
                {job.pagesProcessed ?? 0}
                {job.pagesFailed ? ` · failed ${job.pagesFailed}` : ''}
              </td>
              <td className="px-4 py-3 text-xs text-gray-700">
                {new Date(job.createdAt).toLocaleString('hr-HR')}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link href={`/banking/documents/${job.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(job.id)}
                    disabled={deleting === job.id}
                  >
                    {deleting === job.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-red-600" />
                    )}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
