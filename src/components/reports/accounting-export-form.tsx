"use client"

import { useMemo, useState } from "react"
import { FileSpreadsheet, Receipt, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const toInputDate = (date: Date) => date.toISOString().slice(0, 10)

export function AccountingExportForm() {
  const today = useMemo(() => toInputDate(new Date()), [])
  const startOfYear = useMemo(() => {
    const now = new Date()
    return toInputDate(new Date(now.getFullYear(), 0, 1))
  }, [])

  const [from, setFrom] = useState(startOfYear)
  const [to, setTo] = useState(today)

  const buildUrl = (path: string) => {
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    const qs = params.toString()
    return qs ? `${path}?${qs}` : path
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="from">Od datuma</Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">Do datuma</Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href={buildUrl("/api/exports/invoices")}
          download
          className="justify-center gap-2 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Izvoz računa (CSV)
        </a>
        <a
          href={buildUrl("/api/exports/expenses")}
          download
          className="justify-center gap-2 inline-flex items-center rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          <Receipt className="h-4 w-4" />
          Izvoz troškova (CSV)
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        <a
          href={buildUrl("/api/exports/season-pack")}
          download
          className="justify-center gap-2 inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <Archive className="h-4 w-4" />
          {"\"Tax season\" paket (ZIP)"}
        </a>
      </div>

      <p className="text-sm text-muted-foreground">
        CSV datoteke uključuju osnovne podatke, PDV, status plaćanja i (za troškove) link na skenirani račun.
      </p>
    </div>
  )
}
