"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { ImportJob, Statement, StatementPage, Transaction } from "@prisma/client"
import { Loader2, CheckCircle2, AlertTriangle, Eye } from "lucide-react"

type StatementWithRelations =
  | (Statement & {
      pages: StatementPage[]
      transactions: Transaction[]
    })
  | null

type Props = {
  job: ImportJob & { bankAccount: { name: string; iban: string } | null }
  statement: StatementWithRelations
}

function getFileType(fileName: string): "pdf" | "image" | "other" {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  if (ext === "pdf") return "pdf"
  if (["jpg", "jpeg", "png", "heic", "webp"].includes(ext)) return "image"
  return "other"
}

export function DocumentDetail({ job, statement }: Props) {
  const fileType = getFileType(job.originalName)
  const transactions = statement?.transactions || []
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function markVerified() {
    setSaving(true)
    setMessage(null)
    try {
      await fetch(`/api/banking/import/jobs/${job.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VERIFIED" }),
      })
      setMessage("Označeno kao verificirano.")
    } catch (error) {
      setMessage("Označavanje nije uspjelo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-surface-1 border-r h-[80vh]">
        <div className="flex items-center gap-2 px-4 py-2 text-sm text-secondary border-b bg-[var(--surface)]">
          <Eye className="h-4 w-4" />
          Izvorni dokument
        </div>
        {fileType === "pdf" ? (
          <object
            data={`/api/banking/import/jobs/${job.id}/file`}
            type="application/pdf"
            className="w-full h-[75vh]"
          >
            <p className="p-4 text-sm text-secondary">PDF pregled nije dostupan.</p>
          </object>
        ) : fileType === "image" ? (
          <div className="w-full h-[75vh] flex items-center justify-center bg-surface-1 overflow-auto p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/banking/import/jobs/${job.id}/file`}
              alt={job.originalName}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-full h-[75vh] flex items-center justify-center bg-surface-1">
            <p className="text-sm text-secondary">Pregled ovog formata nije dostupan.</p>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {job.status === "VERIFIED" ? (
            <CheckCircle2 className="h-5 w-5 text-success-text" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-warning-icon" />
          )}
          <div>
            <p className="font-semibold text-sm">Prepoznate transakcije</p>
            <p className="text-xs text-secondary">
              Usporedite s PDF-om. Uvozi su nepromjenjivi radi revizijskog traga.
            </p>
          </div>
        </div>

        <div className="border rounded-lg max-h-[70vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-1 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Datum</th>
                <th className="px-3 py-2 text-left">Opis</th>
                <th className="px-3 py-2 text-left">Ref</th>
                <th className="px-3 py-2 text-right">Iznos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2">{new Date(t.date).toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2 whitespace-pre-wrap">{t.description ?? "-"}</td>
                  <td className="px-3 py-2">{t.reference ?? "-"}</td>
                  <td className="px-3 py-2 text-right">{Number(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={markVerified} variant="secondary" size="sm" disabled={saving}>
            Označi kao verificirano
          </Button>
          {message && <span className="text-xs text-secondary">{message}</span>}
        </div>
      </div>
    </div>
  )
}
