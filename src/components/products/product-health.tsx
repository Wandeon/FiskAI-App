import { AlertTriangle, CheckCircle2, Package, Upload, Tags } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface ProductHealthProps {
  total: number
  inactiveCount: number
  missingSkuCount: number
  zeroPriceCount: number
}

export function ProductHealth({
  total,
  inactiveCount,
  missingSkuCount,
  zeroPriceCount,
}: ProductHealthProps) {
  const issues = [
    {
      label: "Bez šifre",
      value: missingSkuCount,
      hint: "Dodajte šifru radi lakše pretrage i uvoza.",
    },
    {
      label: "Cijena = 0",
      value: zeroPriceCount,
      hint: "Unesite prodajnu cijenu ili označite kao uslugu bez naplate.",
    },
    {
      label: "Neaktivni",
      value: inactiveCount,
      hint: "Aktivirajte proizvode koje koristite u ponudama.",
    },
  ]

  const hasIssues = issues.some((issue) => issue.value > 0)

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-50 p-2 text-brand-600">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Zdravlje kataloga
            </p>
            <p className="text-sm text-[var(--muted)]">
              {hasIssues
                ? "Dovršite podatke da bi ponude i e-računi bili točni."
                : "Katalog je spreman za izradu računa."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/products/new">
            <Button size="sm">
              <Tags className="mr-2 h-4 w-4" />
              Dodaj proizvod
            </Button>
          </Link>
          <Button size="sm" variant="outline" disabled>
            <Upload className="mr-2 h-4 w-4" />
            Uvoz CSV (uskoro)
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {issues.map((issue) => (
          <div
            key={issue.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">{issue.label}</span>
              {issue.value > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning-text">
                  <AlertTriangle className="h-3 w-3" />
                  {issue.value}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-xs font-semibold text-success-text">
                  <CheckCircle2 className="h-3 w-3" />0
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">{issue.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>Ukupno stavki</span>
        <span className="font-semibold text-[var(--foreground)]">{total}</span>
      </div>
    </div>
  )
}
