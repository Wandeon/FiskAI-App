'use client'

import { useEffect, useState, useRef } from "react"
import { Loader2, Search, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type SearchResult = {
  name: string
  oib?: string
  address?: string
  city?: string
  postalCode?: string
  vatNumber?: string
}

interface OibNameSearchProps {
  onSelect: (result: SearchResult) => void
  placeholder?: string
  className?: string
}

export function OibNameSearch({ onSelect, placeholder = "Upišite naziv tvrtke", className }: OibNameSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 3) {
      setResults([])
      setError(null)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/oib/search?query=${encodeURIComponent(query.trim())}`)
        const json = await res.json()
        if (!res.ok || json.error) {
          setError(json.error || "Pretraga nije uspjela")
          setResults([])
        } else {
          setResults(json.results || [])
        }
      } catch {
        setError("Greška pri pretrazi")
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-2 rounded-button border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <Search className="h-4 w-4 text-[var(--muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
        />
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-brand-600" />}
      </div>

      {(results.length > 0 || error) && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          {results.length > 0 && (
            <ul className="max-h-64 overflow-y-auto divide-y divide-[var(--border)]">
              {results.map((item) => (
                <li key={`${item.name}-${item.oib ?? Math.random()}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item)
                      setResults([])
                      setQuery(item.name)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-secondary)]"
                  >
                    <p className="font-semibold text-[var(--foreground)]">{item.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {item.oib ? `OIB: ${item.oib}` : "OIB nije dostupan"}
                      {item.city ? ` • ${item.city}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
