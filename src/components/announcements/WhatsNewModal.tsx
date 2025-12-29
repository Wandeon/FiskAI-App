"use client"

import { useState, useEffect } from "react"
import { X, Sparkles, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChangelogEntry {
  version: string
  date: string
  highlights: {
    title: string
    description: string
    type: "added" | "changed" | "fixed"
  }[]
}

// Current version - update this when releasing new features
const CURRENT_VERSION = "1.2.0"

// Key for localStorage
const DISMISSED_VERSION_KEY = "fiskai_whats_new_dismissed"

// Changelog entries to display
const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "1.2.0",
    date: "2024-12-29",
    highlights: [
      {
        title: "Sustav obavijesti o novostima",
        description: "Saznajte o novim funkcijama i poboljsanjima izravno u aplikaciji",
        type: "added",
      },
      {
        title: "Poboljsane performanse",
        description: "Brze ucitavanje nadzorne ploce i optimizirana navigacija",
        type: "changed",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2024-12-15",
    highlights: [
      {
        title: "AI Asistent v2",
        description: "Poboljsani prikaz razloga i dokaza za regulatorne odgovore",
        type: "added",
      },
      {
        title: "Personalizacija asistenta",
        description: "Prilagodite postavke AI asistenta prema vasim potrebama",
        type: "added",
      },
    ],
  },
]

const typeColors = {
  added: "bg-green-500/10 text-green-600 border-green-500/20",
  changed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  fixed: "bg-amber-500/10 text-amber-600 border-amber-500/20",
}

const typeLabels = {
  added: "Novo",
  changed: "Promjena",
  fixed: "Ispravak",
}

export function WhatsNewModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check if user has dismissed this version
    const dismissedVersion = localStorage.getItem(DISMISSED_VERSION_KEY)
    if (dismissedVersion !== CURRENT_VERSION) {
      // Show modal after a short delay for better UX
      const timer = setTimeout(() => setIsOpen(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_VERSION_KEY, CURRENT_VERSION)
    setIsOpen(false)
  }

  // Don't render on server or if not mounted
  if (!mounted || !isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="relative w-full max-w-lg rounded-2xl bg-[var(--surface)] shadow-elevated animate-scale-in overflow-hidden"
      >
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] px-6 py-8 text-white">
          <div className="absolute top-4 right-4">
            <button
              onClick={handleDismiss}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Zatvori"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2.5">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 id="whats-new-title" className="text-xl font-bold">
                Sto je novo?
              </h2>
              <p className="text-sm text-white/80">
                Verzija {CURRENT_VERSION}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {CHANGELOG_ENTRIES.map((entry, entryIndex) => (
            <div key={entry.version} className={cn(entryIndex > 0 && "mt-6 pt-6 border-t border-[var(--border)]")}>
              <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-3">
                <span className="font-medium text-[var(--foreground)]">v{entry.version}</span>
                <span>-</span>
                <span>{new Date(entry.date).toLocaleDateString("hr-HR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}</span>
              </div>
              <div className="space-y-3">
                {entry.highlights.map((highlight, index) => (
                  <div
                    key={index}
                    className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium",
                        typeColors[highlight.type]
                      )}
                    >
                      {typeLabels[highlight.type]}
                    </span>
                    <div>
                      <h3 className="font-medium text-[var(--foreground)]">{highlight.title}</h3>
                      <p className="mt-0.5 text-sm text-[var(--muted)]">{highlight.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center border-t border-[var(--border)] px-6 py-4 bg-[var(--surface-secondary)]">
          <a
            href="/postavke/changelog"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1"
          >
            Pogledaj puni changelog
            <ArrowRight className="h-4 w-4" />
          </a>
          <button
            onClick={handleDismiss}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] transition-colors"
          >
            Shvacam
          </button>
        </div>
      </div>
    </div>
  )
}
