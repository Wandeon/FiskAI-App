"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { Search, Filter, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const typeOptions = [
  { value: "ALL", label: "Svi tipovi" },
  { value: "CUSTOMER", label: "Kupci" },
  { value: "SUPPLIER", label: "Dobavljači" },
  { value: "BOTH", label: "Kupci/Dobavljači" },
]

interface ContactFiltersProps {
  initialSearch?: string
  initialType?: string
  initialSegments?: string[]
  view?: string
}

type SavedPreset = {
  name: string
  search: string
  type: string
  segments: string[]
}

const segmentOptions = [
  { value: "VAT_PAYER", label: "PDV obveznici" },
  { value: "MISSING_EMAIL", label: "Bez e-maila" },
  { value: "NO_DOCUMENTS", label: "Bez e-računa" },
] as const

export function ContactFilters({
  initialSearch = "",
  initialType = "ALL",
  initialSegments = [],
  view = "list",
}: ContactFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(initialSearch)
  const [type, setType] = useState(initialType)
  const [isOpen, setIsOpen] = useState(false)
  const [segments, setSegments] = useState<string[]>(initialSegments)
  const [presetName, setPresetName] = useState("")
  const [presets, setPresets] = useState<SavedPreset[]>([])

  useEffect(() => {
    const stored = localStorage.getItem("contacts-filter-presets")
    if (stored) {
      try {
        setPresets(JSON.parse(stored))
      } catch {
        setPresets([])
      }
    }
  }, [])

  const persistPresets = (next: SavedPreset[]) => {
    setPresets(next)
    localStorage.setItem("contacts-filter-presets", JSON.stringify(next))
  }

  const hasFilters = search || type !== "ALL" || segments.length > 0
  const toggleSegment = (value: string) => {
    setSegments((prev) =>
      prev.includes(value) ? prev.filter((segment) => segment !== value) : [...prev, value]
    )
  }

  const applyFilters = () => {
    startTransition(() => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (type !== "ALL") params.set("type", type)
      segments.forEach((segment) => params.append("segment", segment))
      if (view) params.set("view", view)
      router.push(`/contacts?${params.toString()}`)
    })
    setIsOpen(false)
  }

  const clearFilters = () => {
    setSearch("")
    setType("ALL")
    setSegments([])
    startTransition(() => {
      const params = new URLSearchParams()
      if (view) params.set("view", view)
      const query = params.toString()
      router.push(query ? `/contacts?${query}` : "/contacts")
    })
  }

  const savePreset = () => {
    if (!presetName.trim()) return
    const next: SavedPreset[] = [
      ...presets.filter((p) => p.name.toLowerCase() !== presetName.toLowerCase()),
      { name: presetName.trim(), search, type, segments },
    ]
    persistPresets(next)
    setPresetName("")
  }

  const applyPreset = (preset: SavedPreset) => {
    setSearch(preset.search)
    setType(preset.type)
    setSegments(preset.segments)
    startTransition(() => {
      const params = new URLSearchParams()
      if (preset.search) params.set("search", preset.search)
      if (preset.type !== "ALL") params.set("type", preset.type)
      preset.segments.forEach((segment) => params.append("segment", segment))
      if (view) params.set("view", view)
      router.push(`/contacts?${params.toString()}`)
    })
  }

  const deletePreset = (name: string) => {
    const next = presets.filter((p) => p.name !== name)
    persistPresets(next)
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Pretraži po nazivu, OIB-u ili emailu..."
            className="w-full rounded-button border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
          />
        </div>

        {/* Filter Toggle (Mobile) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-2 rounded-button border px-4 py-2.5 text-sm font-medium transition-colors md:hidden",
            hasFilters
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
          )}
        >
          <Filter className="h-4 w-4" />
          Filteri
          {hasFilters && (
            <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-xs text-white">1</span>
          )}
        </button>

        {/* Desktop Filters */}
        <div className="hidden flex-1 flex-col gap-2 md:flex">
          <div className="flex gap-3 items-center">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-button border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {segmentOptions.map((segment) => {
              const isActive = segments.includes(segment.value)
              return (
                <button
                  key={segment.value}
                  type="button"
                  onClick={() => toggleSegment(segment.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    isActive
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted)] hover:border-brand-200"
                  )}
                >
                  {segment.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Button onClick={applyFilters} disabled={isPending}>
            {isPending ? "Učitavanje..." : "Filtriraj"}
          </Button>

          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} disabled={isPending}>
              <X className="h-4 w-4 mr-1" />
              Očisti
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Filter Panel */}
      {isOpen && (
        <div className="rounded-card border border-[var(--border)] bg-[var(--surface)] p-4 md:hidden animate-scale-in">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--foreground)]">Tip kontakta</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      type === opt.value
                        ? "bg-brand-500 text-white"
                        : "bg-[var(--surface-secondary)] text-[var(--foreground)] hover:bg-[var(--border)]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--foreground)]">Segmenti</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {segmentOptions.map((segment) => (
                  <button
                    key={segment.value}
                    onClick={() => toggleSegment(segment.value)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      segments.includes(segment.value)
                        ? "bg-brand-500 text-white"
                        : "bg-[var(--surface-secondary)] text-[var(--foreground)] hover:bg-[var(--border)]"
                    )}
                  >
                    {segment.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={applyFilters} disabled={isPending} className="flex-1">
                Primijeni
              </Button>
              <Button variant="outline" onClick={clearFilters} disabled={isPending}>
                Očisti
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Presets */}
      <div className="rounded-card border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Spremi filtere</p>
            <p className="text-xs text-[var(--muted)]">
              Sačuvajte česte kombinacije (npr. PDV kupci bez e-maila).
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Naziv preseta"
              className="w-full rounded-button border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:w-48"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={savePreset}
              disabled={isPending || !presetName.trim()}
            >
              Spremi
            </Button>
          </div>
        </div>

        {presets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <div
                key={preset.name}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1 text-xs font-medium"
              >
                <button
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="text-[var(--foreground)] hover:text-brand-700"
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={() => deletePreset(preset.name)}
                  className="text-[var(--muted)] hover:text-danger"
                  aria-label={`Obriši preset ${preset.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
