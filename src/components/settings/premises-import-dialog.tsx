"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Modal, ModalFooter } from "@/components/ui/modal"
import { toast } from "@/lib/toast"
import {
  parsePremisesCsv,
  bulkImportPremises,
  generatePremisesTemplate,
} from "@/lib/premises/bulk-actions"
import { Upload, Download, AlertCircle, CheckCircle, XCircle } from "lucide-react"

interface PremisesImportDialogProps {
  companyId: string
  isOpen: boolean
  onClose: () => void
}

interface ParsedRow {
  code: number
  name: string
  address?: string
  isDefault?: boolean
}

export function PremisesImportDialog({ companyId, isOpen, onClose }: PremisesImportDialogProps) {
  const router = useRouter()
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload")
  const [isLoading, setIsLoading] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importResult, setImportResult] = useState<{
    created: number
    skipped: number
    errors: string[]
  } | null>(null)

  const handleClose = useCallback(() => {
    setStep("upload")
    setParsedRows([])
    setParseErrors([])
    setImportResult(null)
    onClose()
  }, [onClose])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setParseErrors([])

    try {
      const text = await file.text()
      const { rows, errors } = await parsePremisesCsv(text)

      setParsedRows(rows)
      setParseErrors(errors)

      if (rows.length > 0) {
        setStep("preview")
      } else if (errors.length > 0) {
        toast.error("CSV datoteka ima greske. Provjerite format.")
      }
    } catch (error) {
      console.error("Failed to parse CSV:", error)
      toast.error("Greska pri citanju CSV datoteke")
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    if (parsedRows.length === 0) return

    setIsLoading(true)

    try {
      const result = await bulkImportPremises(companyId, parsedRows)
      setImportResult(result)
      setStep("result")

      if (result.created > 0) {
        toast.success(`Uspjesno uvezeno ${result.created} poslovnih prostora`)
        router.refresh()
      }
    } catch (error) {
      console.error("Failed to import premises:", error)
      toast.error("Greska pri uvozu poslovnih prostora")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadTemplate = () => {
    const template = generatePremisesTemplate()
    const blob = new Blob([template], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "poslovni-prostori-predlozak.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Uvoz poslovnih prostora"
      description="Uvezite vise poslovnih prostora odjednom iz CSV datoteke"
      size="lg"
    >
      {step === "upload" && (
        <div className="space-y-4">
          <div className="rounded-lg border-2 border-dashed border-[var(--border)] p-8 text-center">
            <Upload className="mx-auto h-10 w-10 text-[var(--muted)]" />
            <p className="mt-2 text-sm text-[var(--muted)]">
              Povucite CSV datoteku ovdje ili kliknite za odabir
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={isLoading}
              style={{ position: "relative" }}
            />
            <Button variant="outline" className="mt-4" disabled={isLoading}>
              <label className="cursor-pointer">
                Odaberi datoteku
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isLoading}
                />
              </label>
            </Button>
          </div>

          <div className="rounded-lg bg-[var(--surface-secondary)] p-4">
            <h4 className="text-sm font-medium">Ocekivani format CSV datoteke:</h4>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Stupci: <code className="bg-[var(--surface)] px-1 rounded">kod</code>,{" "}
              <code className="bg-[var(--surface)] px-1 rounded">naziv</code>,{" "}
              <code className="bg-[var(--surface)] px-1 rounded">adresa</code> (opcionalno),{" "}
              <code className="bg-[var(--surface)] px-1 rounded">zadani</code> (opcionalno)
            </p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Preuzmi predlozak
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          {parseErrors.length > 0 && (
            <div className="rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-[var(--muted)] flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-[var(--foreground)]">
                    Upozorenja pri parsiranju
                  </h4>
                  <ul className="mt-1 text-xs text-[var(--muted)] list-disc list-inside">
                    {parseErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parseErrors.length > 5 && (
                      <li>... i jos {parseErrors.length - 5} upozorenja</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border overflow-hidden">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead className="bg-[var(--surface-secondary)]">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--muted)] uppercase">
                    Kod
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--muted)] uppercase">
                    Naziv
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--muted)] uppercase">
                    Adresa
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--muted)] uppercase">
                    Zadani
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {parsedRows.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-sm font-mono">{row.code}</td>
                    <td className="px-4 py-2 text-sm">{row.name}</td>
                    <td className="px-4 py-2 text-sm text-[var(--muted)]">{row.address || "-"}</td>
                    <td className="px-4 py-2 text-sm">
                      {row.isDefault ? (
                        <CheckCircle className="h-4 w-4 text-[var(--success)]" />
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 10 && (
              <div className="bg-[var(--surface-secondary)] px-4 py-2 text-xs text-[var(--muted)]">
                Prikazano 10 od {parsedRows.length} redova
              </div>
            )}
          </div>

          <ModalFooter>
            <Button variant="outline" onClick={() => setStep("upload")}>
              Natrag
            </Button>
            <Button onClick={handleImport} disabled={isLoading}>
              {isLoading ? "Uvoz u tijeku..." : `Uvezi ${parsedRows.length} prostora`}
            </Button>
          </ModalFooter>
        </div>
      )}

      {step === "result" && importResult && (
        <div className="space-y-4">
          <div className="text-center py-4">
            {importResult.created > 0 ? (
              <CheckCircle className="mx-auto h-12 w-12 text-[var(--success)]" />
            ) : (
              <XCircle className="mx-auto h-12 w-12 text-[var(--danger)]" />
            )}
            <h3 className="mt-4 text-lg font-semibold">
              {importResult.created > 0 ? "Uvoz uspjesan" : "Uvoz nije uspio"}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="rounded-lg bg-[var(--success-bg)] border border-[var(--success-border)] p-4">
              <p className="text-2xl font-bold text-[var(--success-text)]">
                {importResult.created}
              </p>
              <p className="text-sm text-[var(--success-text)]">Kreirano</p>
            </div>
            <div className="rounded-lg bg-[var(--warning-bg)] border border-[var(--warning-border)] p-4">
              <p className="text-2xl font-bold text-[var(--warning-text)]">
                {importResult.skipped}
              </p>
              <p className="text-sm text-[var(--warning-text)]">Preskoceno</p>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] p-3">
              <h4 className="text-sm font-medium text-[var(--danger-text)]">Greske:</h4>
              <ul className="mt-1 text-xs text-[var(--danger-text)] list-disc list-inside">
                {importResult.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {importResult.errors.length > 5 && (
                  <li>... i jos {importResult.errors.length - 5} gresaka</li>
                )}
              </ul>
            </div>
          )}

          <ModalFooter>
            <Button onClick={handleClose}>Zatvori</Button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  )
}
