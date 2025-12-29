"use client"

import { useState, useEffect } from "react"
import { NewsCard } from "./NewsCard"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface NewsItem {
  id: string
  originalTitle: string
  summaryHr: string | null
  categories: string[]
  publishedAt: string
  sourceUrl: string
  relevanceScore: string | null
}

const categoryFilters = [
  { value: "", label: "Sve vijesti" },
  { value: "tax", label: "Porezi" },
  { value: "vat", label: "PDV" },
  { value: "legislation", label: "Zakonodavstvo" },
  { value: "compliance", label: "Usklađenost" },
]

export function NewsList() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState("")

  useEffect(() => {
    async function fetchNews() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ limit: "20" })
        if (category) params.set("category", category)

        const res = await fetch(`/api/news?${params}`)
        const data = await res.json()
        setNews(data.news || [])
      } catch (error) {
        console.error("Error fetching news:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [category])

  return (
    <div>
      {/* Category Filters */}
      <div className="mb-8 flex flex-wrap gap-2">
        {categoryFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setCategory(filter.value)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              category === filter.value
                ? "bg-interactive text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* News Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : news.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-white/60">Nema vijesti za prikaz.</p>
          <p className="mt-2 text-sm text-white/40">
            Vijesti će biti dostupne uskoro nakon što se pokrene automatsko prikupljanje.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {news.map((item) => (
            <NewsCard
              key={item.id}
              title={item.originalTitle}
              summary={item.summaryHr || "Sažetak u pripremi..."}
              categories={(item.categories as string[]) || []}
              publishedAt={new Date(item.publishedAt)}
              sourceUrl={item.sourceUrl}
              relevanceScore={item.relevanceScore ? Number(item.relevanceScore) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
