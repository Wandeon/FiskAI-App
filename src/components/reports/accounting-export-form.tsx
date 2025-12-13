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
        <Button asChild className="justify-center gap-2">
          <a href={buildUrl("/api/exports/invoices")} download>
            <FileSpreadsheet className="h-4 w-4" />
            Izvoz računa (CSV)
          </a>
        </Button>
        <Button asChild variant="secondary" className="justify-center gap-2">
          <a href={buildUrl("/api/exports/expenses")} download>
            <Receipt className="h-4 w-4" />
            Izvoz troškova (CSV)
          </a>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        <Button asChild variant="outline" className="justify-center gap-2">
          <a href={buildUrl("/api/exports/season-pack")} download>
            <Archive className="h-4 w-4" />
            “Tax season” paket (ZIP)
          </a>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        CSV datoteke uključuju osnovne podatke, PDV, status plaćanja i (za troškove) link na skenirani račun.
      </p>
    </div>
  )
}
