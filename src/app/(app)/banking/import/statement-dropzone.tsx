"use client"

import { useState, useRef, useEffect } from "react"
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BankAccount } from "@prisma/client"

type DropzoneProps = {
  accounts: Pick<BankAccount, "id" | "name" | "iban">[]
  lastByAccount: Record<string, { date: string | null; sequenceNumber: number | null }>
}

type UploadState = "idle" | "uploading" | "success" | "error"

export function StatementDropzone({ accounts, lastByAccount }: DropzoneProps) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")
  const [status, setStatus] = useState<UploadState>("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [_jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [progressText, setProgressText] = useState<string | null>(null)
  const [poller, setPoller] = useState<NodeJS.Timeout | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [needsOverwrite, setNeedsOverwrite] = useState(false)
  const [step, setStep] = useState<"idle" | "upload" | "process" | "vision" | "done" | "error">(
    "idle"
  )
  const [logs, setLogs] = useState<string[]>([])

  async function uploadFile(file: File, overwrite = false) {
    if (!accountId) {
      setStatus("error")
      setMessage("Odaberite bankovni račun prije uploada")
      return
    }
    if (
      !["application/pdf", "application/xml", "text/xml"].includes(file.type) &&
      !file.name.match(/\.(pdf|xml)$/i)
    ) {
      setStatus("error")
      setMessage("Podržani su samo PDF ili XML izvodi")
      return
    }

    const formData = new FormData()
    formData.append("file", file)
    formData.append("accountId", accountId)
    formData.append("overwrite", overwrite ? "true" : "false")

    setStatus("uploading")
    setMessage("Upload u tijeku...")
    setProgressText(null)
    setJobStatus(null)
    setJobId(null)
    setNeedsOverwrite(false)
    setPendingFile(file)
    setStep("upload")
    setLogs((prev) => ["Analiza datoteke započeta", ...prev].slice(0, 6))

    try {
      const res = await fetch("/api/banking/import/upload", {
        method: "POST",
        body: formData,
      })
      const json = await res.json()
      if (res.status === 409 && json.requiresOverwrite) {
        setStatus("idle")
        setNeedsOverwrite(true)
        setMessage("Ovaj izvod već postoji. Želite li prepisati?")
        return
      }
      if (!res.ok || !json.success) {
        setStatus("error")
        setMessage(json.error || "Upload nije uspio")
        return
      }
      const newJobId = json.jobId as string
      setJobId(newJobId)
      // Kick off processing in the background (best-effort)
      fetch("/api/banking/import/process", { method: "POST" }).catch(() => {
        // silent fire-and-forget; processing endpoint will be called by cron/worker too
      })
      setStatus("success")
      setMessage("Primljeno! Obrada će se nastaviti u pozadini.")
      setFileName(file.name)
      setJobStatus("PENDING")
      setStep("process")
      setLogs((prev) => ["Učitavanje stranica i ekstrakcija teksta...", ...prev].slice(0, 6))
      startPolling(newJobId)
    } catch (err) {
      console.error(err)
      setStatus("error")
      setMessage("Neuspješan upload")
      setStep("error")
      setLogs((prev) => ["Greška pri uploadu", ...prev].slice(0, 6))
    }
  }

  useEffect(() => {
    return () => {
      if (poller) {
        clearInterval(poller)
      }
    }
  }, [poller])

  function startPolling(id: string) {
    if (poller) {
      clearInterval(poller)
      setPoller(null)
    }
    const pollJob = async () => {
      try {
        const res = await fetch(`/api/banking/import/jobs/${id}`)
        const json = await res.json()
        if (!res.ok || !json.success) return

        const job = json.job
        setJobStatus(job.status)

        if (job.pagesProcessed && job.pageCount) {
          setProgressText(
            `Stranice: ${job.pagesProcessed}/${job.pageCount} · VERIFIED ${job.pagesVerified || 0}${job.pagesNeedsVision ? ` · NEEDS_VISION ${job.pagesNeedsVision}` : ""}`
          )
        } else if (job.status === "PROCESSING") {
          setProgressText("Obrada u tijeku...")
        }
        if (job.pagesNeedsVision) {
          setStep("vision")
          setLogs((prev) =>
            ["Matematičko odstupanje. Pokrećem vizualnu provjeru...", ...prev].slice(0, 6)
          )
        } else {
          setStep("process")
        }

        const terminal = ["VERIFIED", "NEEDS_REVIEW", "FAILED"]
        if (terminal.includes(job.status)) {
          clearInterval(interval)
          setPoller(null)
          if (job.status === "VERIFIED") {
            setMessage("Izvod je verificiran matematikom.")
            setStep("done")
            setLogs((prev) => ["Matematički točno. Završeno.", ...prev].slice(0, 6))
          } else if (job.status === "NEEDS_REVIEW") {
            setMessage("Obrada završena uz odstupanja — potrebno pregledati.")
            setStep("vision")
            setLogs((prev) => ["Potrebna ručna provjera.", ...prev].slice(0, 6))
          } else {
            setMessage(job.failureReason || "Obrada nije uspjela.")
            setStatus("error")
            setStep("error")
            setLogs((prev) => ["Greška u obradi.", ...prev].slice(0, 6))
          }
        }
      } catch (error) {
        console.warn("Polling failed", error)
      }
    }
    const interval = setInterval(() => void pollJob(), 3000)
    setPoller(interval)
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    setFileName(file.name)
    void uploadFile(file)
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    const files = e.dataTransfer?.files
    handleFiles(files)
  }

  function onBrowseClick() {
    inputRef.current?.click()
  }

  const borderColor =
    status === "success"
      ? "border-success-border bg-success-bg"
      : status === "error"
        ? "border-danger-border bg-danger-bg"
        : "border-dashed border-[var(--border)] bg-gradient-to-r from-info-bg via-[var(--surface)] to-info-bg"

  const last = lastByAccount[accountId]
  const lastLabel = last?.sequenceNumber
    ? `Posljednji izvod: #${last.sequenceNumber}${last.date ? ` (${new Date(last.date).toLocaleDateString("hr-HR")})` : ""}`
    : "Nije pronađen prethodni izvod"

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-gradient-to-r from-foreground via-foreground to-foreground text-inverse p-5 border border-strong shadow">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-inverse/80">Uvoz bankovnih izvoda</p>
            <p className="text-lg font-semibold">Povucite PDF ili XML ovdje</p>
            <p className="text-xs text-inverse/70 mt-1">
              Podržano: RBA, ZABA, PBZ (PDF) ili CAMT.053 (XML)
            </p>
            <p className="text-xs text-inverse/70 mt-1">{lastLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-inverse/70">Račun</label>
            <select
              className="rounded-md border border-strong bg-surface-2 px-3 py-2 text-sm text-foreground"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.iban})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={onDrop}
        className={`relative rounded-xl border ${borderColor} p-6 transition bg-[var(--surface)] shadow-sm`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.xml,application/pdf,application/xml,text/xml"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center justify-center gap-3 text-center">
          {status === "uploading" ? (
            <Loader2 className="h-10 w-10 animate-spin text-link" />
          ) : status === "success" ? (
            <CheckCircle2 className="h-10 w-10 text-success-text" />
          ) : status === "error" ? (
            <AlertCircle className="h-10 w-10 text-danger-text" />
          ) : (
            <UploadCloud className="h-10 w-10 text-link" />
          )}

          <div>
            <p className="text-base font-semibold">Povucite i ispustite PDF ili XML izvod ovdje</p>
            <p className="text-xs text-secondary">
              Digitalni ili skenirani PDF · CAMT XML · max 20 MB
            </p>
          </div>

          <Button variant="outline" onClick={onBrowseClick} disabled={status === "uploading"}>
            Odaberi datoteku
          </Button>

          {fileName && (
            <p className="text-xs text-secondary">
              Odabrano: <span className="font-medium">{fileName}</span>
            </p>
          )}

          {message && (
            <p
              className={`text-xs ${
                status === "error"
                  ? "text-danger-text"
                  : status === "success"
                    ? "text-success-text"
                    : "text-secondary"
              }`}
            >
              {message}
            </p>
          )}
          {needsOverwrite && pendingFile && (
            <div className="flex items-center gap-2 text-xs text-foreground">
              <Button
                size="sm"
                onClick={() => void uploadFile(pendingFile, true)}
                disabled={status === "uploading"}
              >
                Prepiši i nastavi
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNeedsOverwrite(false)
                  setPendingFile(null)
                }}
              >
                Odustani
              </Button>
            </div>
          )}
        </div>
        <ProgressBar step={step} />

        {jobStatus && (
          <div className="mt-3 text-xs text-foreground">
            <span className="font-semibold">Status:</span> {jobStatus}{" "}
            {progressText ? `· ${progressText}` : ""}
          </div>
        )}
        {logs.length > 0 && (
          <div className="w-full mt-3 rounded-md bg-surface-1 border border-default p-2 text-left">
            <p className="text-[11px] text-secondary mb-1">Dnevnik procesa</p>
            <ul className="space-y-1 text-[11px] text-foreground max-h-24 overflow-y-auto">
              {logs.map((l, idx) => (
                <li key={idx} className="truncate">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function ProgressBar({
  step,
}: {
  step: "idle" | "upload" | "process" | "vision" | "done" | "error"
}) {
  const steps = ["upload", "process", "vision", "done"] as const
  const labels: Record<(typeof steps)[number], string> = {
    upload: "Upload",
    process: "Tekst & Matematika",
    vision: "Vision fallback",
    done: "Završeno",
  }
  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s === step || (step === "error" && s === "process")) ?? 0
  )
  const percent = ((activeIndex + (step === "done" ? 0 : 0.5)) / (steps.length - 1)) * 100

  return (
    <div className="mt-4 space-y-2 rounded-lg border bg-[var(--surface)]/70 p-3 shadow-sm">
      <div className="flex items-center justify-between text-[11px] text-secondary mb-1">
        {steps.map((s, idx) => (
          <span key={s} className={idx <= activeIndex ? "font-semibold text-foreground" : ""}>
            {labels[s]}
          </span>
        ))}
      </div>
      <div className="h-2 w-full rounded-full bg-surface-1 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-interactive to-interactive transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <div className="text-[11px] text-secondary">
        {step === "upload" && "Upload u tijeku..."}
        {step === "process" && "Ekstrakcija teksta i matematička provjera."}
        {step === "vision" && "Vision fallback za stranice s greškama."}
        {step === "done" && "Verificirano."}
        {step === "error" && "Obrada nije uspjela. Pokušajte ponovno ili ručno pregledajte."}
      </div>
    </div>
  )
}
