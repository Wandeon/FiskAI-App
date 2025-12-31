"use client"

import { useMemo, useState } from "react"
import { FileSpreadsheet, Receipt, Archive, FileText, BookOpen } from "lucide-react"
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
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">Do datuma</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href={buildUrl("/api/exports/invoices")}
          download
          className="justify-center gap-2 inline-flex items-center rounded-md bg-interactive px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-interactive-hover focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Izvoz računa (CSV)
        </a>
        <a
          href={buildUrl("/api/exports/expenses")}
          download
          className="justify-center gap-2 inline-flex items-center rounded-md bg-neutral px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-neutral-hover focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2"
        >
          <Receipt className="h-4 w-4" />
          Izvoz troškova (CSV)
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href={buildUrl("/api/reports/accountant-export?format=kpr")}
          download
          className="justify-center gap-2 inline-flex items-center rounded-md bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-success focus:ring-offset-2"
        >
          <BookOpen className="h-4 w-4" />
          KPR izvoz (CSV)
        </a>
        <a
          href={buildUrl("/api/reports/accountant-export?format=summary")}
          download
          className="justify-center gap-2 inline-flex items-center rounded-md bg-chart-2 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-chart-2/90 focus:outline-none focus:ring-2 focus:ring-chart-2 focus:ring-offset-2"
        >
          <FileText className="h-4 w-4" />
          Sažetak (CSV)
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        <a
          href={buildUrl("/api/exports/season-pack")}
          download
          className="justify-center gap-2 inline-flex items-center rounded-md border-2 border-primary bg-primary/5 px-4 py-3 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <Archive className="h-5 w-5" />
          <span className="text-base">Tax Season Paket (ZIP) - SVE ZAJEDNO</span>
        </a>
      </div>

      <p className="text-sm text-muted-foreground">
        CSV datoteke uključuju osnovne podatke, PDV, status plaćanja i (za troškove) link na
        skenirani račun. Tax Season paket sadrži sve datoteke (računi, troškovi, KPR, sažetak) u
        jednom ZIP-u.
      </p>
    </div>
  )
}
