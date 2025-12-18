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
  const [transactions, setTransactions] = useState(statement?.transactions || [])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/banking/import/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: transactions.map((t) => ({
            id: t.id,
            date: t.date,
            amount: Number(t.amount),
            description: t.description,
            reference: t.reference,
            payeeName: t.payeeName,
            iban: t.iban,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setMessage(json.error || "Spremanje nije uspjelo")
      } else {
        setMessage("Spremljeno. Označite kao verificirano ako je točno.")
      }
    } catch (e) {
      setMessage("Spremanje nije uspjelo")
    } finally {
      setSaving(false)
    }
  }

  async function markVerified() {
    await save()
    await fetch(`/api/banking/import/jobs/${job.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "VERIFIED" }),
    })
    setMessage("Označeno kao verificirano.")
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-slate-50 border-r h-[80vh]">
        <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border-b bg-[var(--surface)]">
          <Eye className="h-4 w-4" />
          Izvorni dokument
        </div>
        {fileType === "pdf" ? (
          <object
            data={`/api/banking/import/jobs/${job.id}/file`}
            type="application/pdf"
            className="w-full h-[75vh]"
          >
            <p className="p-4 text-sm text-gray-500">PDF pregled nije dostupan.</p>
          </object>
        ) : fileType === "image" ? (
          <div className="w-full h-[75vh] flex items-center justify-center bg-gray-100 overflow-auto p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/banking/import/jobs/${job.id}/file`}
              alt={job.originalName}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-full h-[75vh] flex items-center justify-center bg-gray-100">
            <p className="text-sm text-gray-500">Pregled ovog formata nije dostupan.</p>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          {job.status === "VERIFIED" ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          )}
          <div>
            <p className="font-semibold text-sm">Prepoznate transakcije</p>
            <p className="text-xs text-gray-500">
              Usporedite s PDF-om i korigirajte iznose, datume ili reference.
            </p>
          </div>
        </div>

        <div className="border rounded-lg max-h-[70vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Datum</th>
                <th className="px-3 py-2 text-left">Opis</th>
                <th className="px-3 py-2 text-left">Ref</th>
                <th className="px-3 py-2 text-right">Iznos</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((t, idx) => (
                <tr key={t.id}>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      className="w-full border rounded px-2 py-1 text-xs"
                      value={new Date(t.date).toISOString().slice(0, 10)}
                      onChange={(e) =>
                        setTransactions((prev) => {
                          const copy = [...prev]
                          copy[idx] = { ...copy[idx], date: new Date(e.target.value) as any }
                          return copy
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      className="w-full border rounded px-2 py-1 text-xs min-h-[60px]"
                      value={t.description ?? ""}
                      onChange={(e) =>
                        setTransactions((prev) => {
                          const copy = [...prev]
                          copy[idx] = { ...copy[idx], description: e.target.value }
                          return copy
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1 text-xs"
                      value={t.reference ?? ""}
                      onChange={(e) =>
                        setTransactions((prev) => {
                          const copy = [...prev]
                          copy[idx] = { ...copy[idx], reference: e.target.value }
                          return copy
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-full border rounded px-2 py-1 text-xs text-right"
                      value={Number(t.amount)}
                      onChange={(e) =>
                        setTransactions((prev) => {
                          const copy = [...prev]
                          copy[idx] = { ...copy[idx], amount: Number(e.target.value) as any }
                          return copy
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Spremi promjene"}
          </Button>
          <Button onClick={markVerified} variant="secondary" size="sm" disabled={saving}>
            Označi kao verificirano
          </Button>
          {message && <span className="text-xs text-gray-600">{message}</span>}
        </div>
      </div>
    </div>
  )
}
