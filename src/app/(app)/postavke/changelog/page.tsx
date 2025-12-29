import { Metadata } from "next"
import { FileText, Plus, RefreshCw, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Changelog | FiskAI",
  description: "Popis svih promjena i novih funkcionalnosti u FiskAI aplikaciji",
}

interface ChangelogEntry {
  version: string
  date: string
  changes: {
    type: "added" | "changed" | "fixed"
    description: string
  }[]
}

const FULL_CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "2024-12-29",
    changes: [
      { type: "added", description: "Sustav obavijesti o novostima - saznajte o novim funkcijama izravno u aplikaciji" },
      { type: "added", description: "\"Sto je novo\" modal koji se prikazuje nakon prijave za nove verzije" },
      { type: "added", description: "Stranica s punim changelogom u postavkama" },
      { type: "changed", description: "Poboljsane performanse ucitavanja nadzorne ploce" },
    ],
  },
  {
    version: "1.1.0",
    date: "2024-12-15",
    changes: [
      { type: "added", description: "AI Asistent v2 s poboljsanim prikazom razloga" },
      { type: "added", description: "Panel s dokazima za regulatorne odgovore" },
      { type: "added", description: "Postavke personalizacije asistenta" },
      { type: "fixed", description: "Problemi s responzivnoscu mobilne navigacije" },
    ],
  },
  {
    version: "1.0.0",
    date: "2024-12-01",
    changes: [
      { type: "added", description: "Inicijalno izdanje FiskAI platforme" },
      { type: "added", description: "Nadzorna ploca s statusom uskladenosti" },
      { type: "added", description: "Upravljanje racunima" },
      { type: "added", description: "Fiskalizacija" },
      { type: "added", description: "Upravljanje kontaktima" },
      { type: "added", description: "Katalog proizvoda" },
      { type: "added", description: "Pracenje troskova" },
      { type: "added", description: "Integracija s bankom" },
      { type: "added", description: "Izvjestaji (osnovni i napredni)" },
      { type: "added", description: "Podrska za pausalni obrt" },
      { type: "added", description: "Upravljanje PDV-om" },
      { type: "added", description: "Modul poreza na dobit" },
      { type: "added", description: "POS sustav" },
      { type: "added", description: "Upravljanje dokumentima" },
      { type: "added", description: "AI asistent" },
    ],
  },
]

const typeConfig = {
  added: {
    icon: Plus,
    label: "Novo",
    className: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  changed: {
    icon: RefreshCw,
    label: "Promjena",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  fixed: {
    icon: Wrench,
    label: "Ispravak",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
}

export default function ChangelogPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[var(--primary)]/10 p-2.5">
          <FileText className="h-6 w-6 text-[var(--primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Changelog</h1>
          <p className="text-sm text-[var(--muted)]">
            Popis svih promjena i novih funkcionalnosti
          </p>
        </div>
      </div>

      {/* Changelog entries */}
      <div className="space-y-8">
        {FULL_CHANGELOG.map((entry, index) => (
          <div
            key={entry.version}
            className={cn(
              "relative pl-8 pb-8",
              index < FULL_CHANGELOG.length - 1 && "border-l-2 border-[var(--border)]"
            )}
          >
            {/* Version dot */}
            <div className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-[var(--primary)] border-4 border-[var(--surface)]" />

            {/* Version header */}
            <div className="mb-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[var(--primary)]/10 px-3 py-1 text-sm font-bold text-[var(--primary)]">
                  v{entry.version}
                </span>
                <span className="text-sm text-[var(--muted)]">
                  {new Date(entry.date).toLocaleDateString("hr-HR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            {/* Changes list */}
            <div className="space-y-2">
              {entry.changes.map((change, changeIndex) => {
                const config = typeConfig[change.type]
                const Icon = config.icon
                return (
                  <div
                    key={changeIndex}
                    className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
                        config.className
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </span>
                    <p className="text-sm text-[var(--foreground)]">{change.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
