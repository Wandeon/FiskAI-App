"use client"

import { useState, useTransition } from "react"
import { UploadCloud, CheckCircle2, AlertCircle, FileText } from "lucide-react"
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/toast"

type ParsedRow = {
  type: "CUSTOMER" | "SUPPLIER" | "BOTH"
  name: string
  oib?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  postalCode?: string
  country?: string
  paymentTermsDays?: number
}

interface ContactCsvImportProps {
  onParsed?: (rows: ParsedRow[]) => void
  onImportComplete?: () => void
}

export function ContactCsvImport({ onParsed, onImportComplete }: ContactCsvImportProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [rowCount, setRowCount] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, startTransition] = useTransition()

  const parseCsv = async (file: File): Promise<ParsedRow[] | undefined> => {
    return new Promise((resolve) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
        complete: (results) => {
          if (results.errors.length > 0) {
            const firstError = results.errors[0]
            setError(`Greska pri parsiranju CSV-a: ${firstError.message}`)
            resolve(undefined)
            return
          }

          if (results.data.length === 0) {
            setError("Prazna datoteka")
            resolve(undefined)
            return
          }

          const headers = results.meta.fields?.map((f) => f.toLowerCase()) || []
          const required = ["name", "type"]
          if (!required.every((r) => headers.includes(r))) {
            setError("CSV mora imati stupce 'name' i 'type'")
            resolve(undefined)
            return
          }

          const rows: ParsedRow[] = results.data.map((record) => {
            const get = (key: string) => (record[key] || "").trim()
            const typeValue = get("type").toUpperCase()
            const validType =
              typeValue === "CUSTOMER" || typeValue === "SUPPLIER" || typeValue === "BOTH"
                ? typeValue
                : "CUSTOMER"
            return {
              type: validType as "CUSTOMER" | "SUPPLIER" | "BOTH",
              name: get("name"),
              oib: get("oib") || undefined,
              email: get("email") || undefined,
              phone: get("phone") || undefined,
              address: get("address") || undefined,
              city: get("city") || undefined,
              postalCode: get("postalcode") || get("postal_code") || undefined,
              country: get("country") || undefined,
              paymentTermsDays: get("paymenttermsdays")
                ? Number(get("paymenttermsdays"))
                : undefined,
            }
          })
          setRowCount(rows.length)
          setError(null)
          onParsed?.(rows)
          toast.success("CSV ucitan", `${rows.length} kontakata spremno za uvoz`)
          resolve(rows)
        },
        error: (error) => {
          setError(`Greska pri citanju CSV-a: ${error.message}`)
          resolve(undefined)
        },
      })
    })
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
      setError("Greska pri citanju CSV-a")
      toast.error("Greska", "Nije moguce procitati CSV")
    }
  }

  const importRows = async (rows: ParsedRow[]) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/contacts/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          throw new Error(json.error || "Neuspjesan uvoz")
        }
        toast.success("Uspjesno", `${json.created} kontakata kreirano`)
        onImportComplete?.()
      } catch (err) {
        console.error(err)
        const message = err instanceof Error ? err.message : "Uvoz nije uspio"
        toast.error("Greska", message)
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
          <p className="text-sm font-semibold text-[var(--foreground)]">Uvoz kontakata (CSV)</p>
          <p className="text-xs text-[var(--muted)]">
            Stupci: type, name, oib, email, phone, address, city, postalCode, country,
            paymentTermsDays
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
                  "type,name,oib,email,phone,address,city,postalCode,country\nCUSTOMER,Primjer d.o.o.,12345678901,info@primjer.hr,01234567,Ulica 1,Zagreb,10000,HR\nSUPPLIER,Dobavljac j.d.o.o.,98765432109,nabava@dobavljac.hr,09876543,Avenija 2,Split,21000,HR"
                const blob = new Blob([example], { type: "text/csv;charset=utf-8;" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = "primjer-kontakti.csv"
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              Preuzmi primjer
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs">
            {error ? (
              <span className="inline-flex items-center gap-1 text-rose-600">
                <AlertCircle className="h-4 w-4" />
                {error}
              </span>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  rowCount > 0 ? "text-emerald-600" : "text-[var(--muted)]"
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                {rowCount > 0
                  ? `${rowCount} redaka ucitano`
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
