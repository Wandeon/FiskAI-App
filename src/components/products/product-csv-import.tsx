"use client"

import { useState, useTransition } from "react"
import { UploadCloud, CheckCircle2, AlertCircle, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/toast"
import { sanitizeCsvValue } from "@/lib/csv-sanitize"

type ParsedRow = {
  name: string
  sku?: string
  unit?: string
  price?: number
  vatRate?: number
}

interface ProductCsvImportProps {
  onParsed?: (rows: ParsedRow[]) => void
}

export function ProductCsvImport({ onParsed }: ProductCsvImportProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [rowCount, setRowCount] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, startTransition] = useTransition()

  const parseCsv = async (file: File) => {
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) {
      setError("Prazna datoteka")
      return
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const required = ["name"]
    if (!required.every((r) => headers.includes(r))) {
      setError("CSV mora imati stupac 'name'")
      return
    }

    const rows: ParsedRow[] = lines.slice(1).map((line) => {
      // Sanitize CSV values to prevent formula injection attacks (fixes #858)
      const cols = line.split(",").map((c) => sanitizeCsvValue(c.trim()))
      const get = (key: string) => cols[headers.indexOf(key)] || ""
      return {
        name: get("name"),
        sku: get("sku") || undefined,
        unit: get("unit") || undefined,
        price: get("price") ? Number(get("price")) : undefined,
        vatRate: get("vatRate") ? Number(get("vatRate")) : undefined,
      }
    })
    setRowCount(rows.length)
    setError(null)
    onParsed?.(rows)
    toast.success("CSV učitan", `${rows.length} stavki spremno za uvoz`)
    return rows
  }

  const handleFile = async (file?: File) => {
    if (!file) return
    setFileName(file.name)
    setRowCount(0)
    try {
      const rows = await parseCsv(file)
      if (!rows) return
      await importRows(rows)
    } catch (err) {
      console.error(err)
      setError("Greška pri čitanju CSV-a")
      toast.error("Greška", "Nije moguće pročitati CSV")
    }
  }

  const importRows = async (rows: ParsedRow[]) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/products/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error || "Neuspješan uvoz")
        }
        toast.success("Uspješno", `${json.created} proizvoda kreirano`)
      } catch (err) {
        console.error(err)
        toast.error("Greška", "Uvoz nije uspio")
      }
    })
  }

  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)]/60 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-brand-50 p-2 text-brand-600">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">Uvoz proizvoda (CSV)</p>
          <p className="text-xs text-[var(--muted)]">
            Stupci: name, sku, unit, price, vatRate. Podaci se još ne spremaju na server (pregled
            lokalno).
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:border-brand-200">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <FileText className="h-4 w-4" />
              {isSubmitting ? "U tijeku..." : "Odaberi CSV"}
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const example =
                  "name,sku,unit,price,vatRate\nUsluga konsaltinga,CONS-001,h,80,25\nLicenca softvera,LIC-2025,kom,250,25"
                const blob = new Blob([example], { type: "text/csv;charset=utf-8;" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = "primjer-proizvodi.csv"
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Preuzmi primjer
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs">
            {error ? (
              <span className="inline-flex items-center gap-1 text-danger">
                <AlertCircle className="h-4 w-4" />
                {error}
              </span>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  rowCount > 0 ? "text-success-text" : "text-[var(--muted)]"
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                {rowCount > 0
                  ? `${rowCount} redaka učitano`
                  : fileName
                    ? fileName
                    : "Nije odabran CSV"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
