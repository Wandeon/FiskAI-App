"use client"

import { CheckCircle2 } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export function DemoInvoice({ reduce }: { reduce: boolean }) {
  const pulse = reduce
    ? undefined
    : {
        opacity: [0.6, 1, 0.6],
        transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
      }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-[var(--muted)]">Račun</p>
          <p className="text-xs font-semibold">#2025-041</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.span
            aria-hidden
            className="h-2 w-2 rounded-full bg-interactive"
            animate={pulse as any}
          />
          <span className="text-[10px] font-semibold text-interactive">Spremno</span>
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--muted)]">Kupac</span>
          <span className="text-xs font-semibold">ACME d.o.o.</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--muted)]">Iznos</span>
          <span className="text-xs font-semibold">1.250,00 €</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--muted)]">Rok</span>
          <span className="text-xs font-semibold">15 dana</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="h-2 w-28 overflow-hidden rounded-full bg-[var(--border-light)]">
          <motion.div
            className="h-full rounded-full bg-interactive"
            initial={reduce ? false : { width: "20%" }}
            animate={reduce ? undefined : { width: ["20%", "70%", "40%"] }}
            transition={reduce ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <motion.div
          className="inline-flex items-center rounded-md bg-interactive px-3 py-2 text-xs font-semibold text-white"
          animate={pulse as any}
        >
          Pošalji PDF
        </motion.div>
      </div>
    </div>
  )
}

export function DemoScan({ reduce }: { reduce: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_0.9fr]">
      <div className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
        <div className="space-y-2">
          <div className="h-3 w-3/5 rounded bg-surface/70" />
          <div className="h-2.5 w-4/5 rounded bg-surface/60" />
          <div className="h-2.5 w-2/3 rounded bg-surface/60" />
          <div className="h-2.5 w-5/6 rounded bg-surface/60" />
          <div className="mt-3 h-2.5 w-1/2 rounded bg-surface/60" />
          <div className="h-2.5 w-3/4 rounded bg-surface/60" />
        </div>

        {!reduce && (
          <>
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-2 right-2 top-3 h-0.5 rounded bg-interactive/80"
              animate={{ y: [0, 110, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-x-3 top-10 h-6 rounded border border-info-border bg-info-bg/20"
              animate={{ opacity: [0.25, 0.7, 0.25] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}
      </div>

      <div className="space-y-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2">
          <p className="text-[10px] font-semibold text-[var(--muted)]">Dobavljač</p>
          <p className="text-xs font-semibold">Konzum</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2">
          <p className="text-[10px] font-semibold text-[var(--muted)]">Iznos</p>
          <p className="text-xs font-semibold">23,49 €</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2">
          <p className="text-[10px] font-semibold text-[var(--muted)]">Kategorija</p>
          <p className="text-xs font-semibold">Ured</p>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] font-semibold text-interactive">AI prijedlog</span>
          <span className="rounded-full bg-interactive px-2 py-1 text-[10px] font-semibold text-white">
            Potvrdi
          </span>
        </div>
      </div>
    </div>
  )
}

export function DemoPayments({ reduce }: { reduce: boolean }) {
  return (
    <div className="space-y-2">
      {[
        { id: "#2025-041", status: "Poslano", tone: "bg-interactive-secondary text-interactive" },
        { id: "#2025-042", status: "Dospijeva", tone: "bg-warning-bg text-warning-text" },
        { id: "#2025-043", status: "Plaćeno", tone: "bg-success-bg text-success-text" },
      ].map((row) => (
        <div
          key={row.id}
          className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2"
        >
          <p className="text-xs font-semibold">{row.id}</p>
          <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", row.tone)}>
            {row.status}
          </span>
        </div>
      ))}

      <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">Cashflow pregled</p>
          <span className="text-[10px] font-semibold text-[var(--muted)]">ovaj tjedan</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border-light)]">
          <motion.div
            className="h-full rounded-full bg-interactive"
            initial={reduce ? false : { width: "35%" }}
            animate={reduce ? undefined : { width: ["35%", "72%", "48%"] }}
            transition={reduce ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </div>
  )
}

export function DemoExport({ reduce }: { reduce: boolean }) {
  const items = ["računi.csv", "troškovi.csv", "PDF prilozi", "audit-log.json"]
  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2"
          >
            <span className="text-xs font-semibold">{item}</span>
            <CheckCircle2 className="h-4 w-4 text-success-icon" aria-hidden />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="h-2 w-28 overflow-hidden rounded-full bg-[var(--border-light)]">
          <motion.div
            className="h-full rounded-full bg-green-600"
            initial={reduce ? false : { width: "0%" }}
            animate={reduce ? undefined : { width: ["0%", "100%"] }}
            transition={reduce ? undefined : { duration: 1.1, repeat: Infinity, repeatDelay: 0.6 }}
          />
        </div>
        <span className="inline-flex items-center rounded-md bg-interactive px-3 py-2 text-xs font-semibold text-white">
          Preuzmi ZIP
        </span>
      </div>
    </div>
  )
}

export function DemoStatusFlow({ reduce }: { reduce: boolean }) {
  const steps = ["Kreirano", "Poslano", "Dostavljeno", "Prihvaćeno"]

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-3">
        <p className="text-xs font-semibold">Status e-računa</p>
        <div className="mt-3 space-y-2">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center gap-2">
              <motion.span
                aria-hidden
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  index < 2 ? "bg-green-600" : "bg-[var(--border)]"
                )}
                animate={
                  reduce ? undefined : index === 2 ? { opacity: [0.35, 1, 0.35] } : undefined
                }
                transition={
                  reduce ? undefined : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                }
              />
              <span className={cn("text-xs", index < 2 ? "font-semibold" : "text-[var(--muted)]")}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2">
        <span className="text-xs font-semibold">Praćenje</span>
        <span className="rounded-full bg-interactive px-2 py-1 text-[10px] font-semibold text-white">
          Status live
        </span>
      </div>
    </div>
  )
}
