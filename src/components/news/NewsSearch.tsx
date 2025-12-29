"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X, Loader2, ExternalLink } from "lucide-react"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { Button } from "@/components/ui/button"
import { PostCard } from "./PostCard"
import { useDebouncedCallback } from "use-debounce"
import { format } from "date-fns"
import { hr } from "date-fns/locale"

interface SearchResult {
  id: string
  slug: string
  title: string
  excerpt: string | null
  categoryName: string | null
  categorySlug: string | null
  publishedAt: string | null
  featuredImageUrl: string | null
  featuredImageSource: string | null
  impactLevel: string | null
}

interface SourceItem {
  id: string
  sourceUrl: string
  title: string
  summaryHr: string | null
  publishedAt: string | null
  impactLevel: string | null
  sourceName: string | null
}

interface NewsSearchProps {
  initialQuery?: string
}

export function NewsSearch({ initialQuery = "" }: NewsSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isOpen, setIsOpen] = useState(!!initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [items, setItems] = useState<SourceItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const performSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      setItems([])
      setTotalCount(0)
      return
    }

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        type: "individual",
        limit: "10",
        includeItems: "true",
      })
      const res = await fetch(`/api/news/posts?${params}`)
      const data = await res.json()
      setResults(data.posts || [])
      setItems(data.items || [])
      setTotalCount(data.totalCount || 0)
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsLoading(false)
    }
  }, 300)

  useEffect(() => {
    if (query) {
      performSearch(query)
    }
  }, [query, performSearch])

  const handleOpenSearch = () => {
    setIsOpen(true)
  }

  const handleCloseSearch = () => {
    setIsOpen(false)
    setQuery("")
    setResults([])
    setItems([])
    // Remove query param from URL
    const params = new URLSearchParams(searchParams.toString())
    params.delete("q")
    router.push(`/vijesti${params.toString() ? `?${params}` : ""}`)
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    // Update URL with search query
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("q", value)
    } else {
      params.delete("q")
    }
    router.replace(`/vijesti?${params}`, { scroll: false })
  }

  if (!isOpen) {
    return (
      <Button variant="secondary" size="sm" onClick={handleOpenSearch}>
        <Search className="h-4 w-4" />
        Pretraži
      </Button>
    )
  }

  return (
    <div className="w-full">
      {/* Search Input */}
      <GlassCard hover={false} padding="sm" className="mb-4">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-white/50" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Pretraži vijesti..."
            className="flex-1 bg-transparent text-white placeholder:text-white/50 focus:outline-none"
            autoFocus
          />
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />}
          <button
            onClick={handleCloseSearch}
            className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </GlassCard>

      {/* Search Results */}
      {query.length >= 2 && (
        <div className="mb-8">
          <p className="mb-4 text-sm text-white/60">
            {isLoading ? (
              "Pretraživanje..."
            ) : totalCount > 0 ? (
              <>
                Pronađeno <strong className="text-white">{totalCount}</strong> rezultata za &quot;
                {query}&quot;
              </>
            ) : (
              <>Nema rezultata za &quot;{query}&quot;</>
            )}
          </p>

          {/* Published posts */}
          {results.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-4 text-sm font-semibold text-white/80">Objavljeni članci</h3>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {results.map((post) => (
                  <PostCard
                    key={post.id}
                    slug={post.slug}
                    title={post.title}
                    excerpt={post.excerpt}
                    categoryName={post.categoryName || undefined}
                    categorySlug={post.categorySlug || undefined}
                    publishedAt={post.publishedAt ? new Date(post.publishedAt) : new Date()}
                    featuredImageUrl={post.featuredImageUrl}
                    featuredImageSource={post.featuredImageSource}
                    impactLevel={post.impactLevel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Source items */}
          {items.length > 0 && (
            <div>
              <h3 className="mb-4 text-sm font-semibold text-white/80">Iz izvora</h3>
              <GlassCard hover={false} padding="sm">
                <ul className="divide-y divide-white/10">
                  {items.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-white/5"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white line-clamp-2 group-hover:text-cyan-300">
                            {item.title}
                          </p>
                          {item.summaryHr && (
                            <p className="mt-1 text-sm text-white/60 line-clamp-2">
                              {item.summaryHr}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-white/50">
                            {item.sourceName ?? "Izvor"}
                            {item.publishedAt
                              ? ` • ${format(new Date(item.publishedAt), "d. MMM yyyy", { locale: hr })}`
                              : ""}
                          </p>
                        </div>
                        <ExternalLink className="mt-1 h-4 w-4 flex-shrink-0 text-white/30 group-hover:text-cyan-400" />
                      </a>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
