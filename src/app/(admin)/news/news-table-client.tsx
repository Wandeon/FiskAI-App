"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, Pencil, Search, X, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react"
import { DeleteButton } from "./delete-button"
import { useDebouncedCallback } from "use-debounce"

interface Post {
  id: string
  slug: string
  title: string
  status: string
  categoryId: string | null
  impactLevel: string | null
  viewCount: number
  publishedAt: string | null
  createdAt: string
}

interface NewsTableClientProps {
  initialPosts: Post[]
  categories: { id: string; nameHr: string }[]
}

type SortField = "createdAt" | "publishedAt" | "title" | "status" | "viewCount"
type SortDirection = "asc" | "desc"

const ITEMS_PER_PAGE = 20

const STATUS_OPTIONS = [
  { value: "", label: "Svi statusi" },
  { value: "pending", label: "Pending" },
  { value: "draft", label: "Draft" },
  { value: "reviewing", label: "Reviewing" },
  { value: "published", label: "Published" },
]

const IMPACT_OPTIONS = [
  { value: "", label: "Svi utjecaji" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

export function NewsTableClient({ initialPosts, categories }: NewsTableClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get initial values from URL
  const initialSearch = searchParams.get("q") || ""
  const initialStatus = searchParams.get("status") || ""
  const initialCategory = searchParams.get("category") || ""
  const initialImpact = searchParams.get("impact") || ""
  const initialPage = parseInt(searchParams.get("page") || "1", 10)
  const initialSortField = (searchParams.get("sortBy") as SortField) || "createdAt"
  const initialSortDir = (searchParams.get("sortDir") as SortDirection) || "desc"

  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [categoryFilter, setCategoryFilter] = useState(initialCategory)
  const [impactFilter, setImpactFilter] = useState(initialImpact)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [sortField, setSortField] = useState<SortField>(initialSortField)
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDir)

  // Update URL when filters change
  const updateUrl = useCallback(
    (params: Record<string, string>) => {
      const newParams = new URLSearchParams(searchParams.toString())
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          newParams.set(key, value)
        } else {
          newParams.delete(key)
        }
      })
      router.replace(`/news?${newParams.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  // Debounced search update
  const debouncedSearch = useDebouncedCallback((value: string) => {
    setCurrentPage(1)
    updateUrl({ q: value, page: "" })
  }, 300)

  // Filter and sort posts
  const filteredPosts = useMemo(() => {
    let result = [...initialPosts]

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((post) => post.title.toLowerCase().includes(searchLower))
    }

    // Status filter
    if (statusFilter) {
      result = result.filter((post) => post.status === statusFilter)
    }

    // Category filter
    if (categoryFilter) {
      result = result.filter((post) => post.categoryId === categoryFilter)
    }

    // Impact filter
    if (impactFilter) {
      result = result.filter((post) => post.impactLevel === impactFilter)
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number | null = null
      let bVal: string | number | null = null

      switch (sortField) {
        case "title":
          aVal = a.title.toLowerCase()
          bVal = b.title.toLowerCase()
          break
        case "status":
          aVal = a.status
          bVal = b.status
          break
        case "viewCount":
          aVal = a.viewCount
          bVal = b.viewCount
          break
        case "publishedAt":
          aVal = a.publishedAt || ""
          bVal = b.publishedAt || ""
          break
        case "createdAt":
        default:
          aVal = a.createdAt
          bVal = b.createdAt
          break
      }

      if (aVal === null || aVal === "") return sortDirection === "asc" ? -1 : 1
      if (bVal === null || bVal === "") return sortDirection === "asc" ? 1 : -1

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return result
  }, [initialPosts, search, statusFilter, categoryFilter, impactFilter, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / ITEMS_PER_PAGE)
  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredPosts.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredPosts, currentPage])

  // Reset page when filters change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  const handleSort = (field: SortField) => {
    const newDirection = sortField === field && sortDirection === "desc" ? "asc" : "desc"
    setSortField(field)
    setSortDirection(newDirection)
    updateUrl({ sortBy: field, sortDir: newDirection })
  }

  const handleFilterChange = (
    type: "status" | "category" | "impact",
    value: string
  ) => {
    setCurrentPage(1)
    switch (type) {
      case "status":
        setStatusFilter(value)
        updateUrl({ status: value, page: "" })
        break
      case "category":
        setCategoryFilter(value)
        updateUrl({ category: value, page: "" })
        break
      case "impact":
        setImpactFilter(value)
        updateUrl({ impact: value, page: "" })
        break
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    updateUrl({ page: page.toString() })
  }

  const clearFilters = () => {
    setSearch("")
    setStatusFilter("")
    setCategoryFilter("")
    setImpactFilter("")
    setCurrentPage(1)
    setSortField("createdAt")
    setSortDirection("desc")
    router.replace("/news", { scroll: false })
  }

  const hasActiveFilters = search || statusFilter || categoryFilter || impactFilter

  const categoryOptions = useMemo(
    () => [{ id: "", nameHr: "Sve kategorije" }, ...categories],
    [categories]
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
      {/* Header with filters */}
      <div className="border-b border-[var(--border)] bg-[var(--surface-secondary)] px-6 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Svi postovi</h3>
            <span className="text-sm text-[var(--muted)]">
              {filteredPosts.length} od {initialPosts.length} postova
            </span>
          </div>

          {/* Search and filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Pretrazi po naslovu..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  debouncedSearch(e.target.value)
                }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => handleFilterChange("category", e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nameHr}
                </option>
              ))}
            </select>

            {/* Impact filter */}
            <select
              value={impactFilter}
              onChange={(e) => handleFilterChange("impact", e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {IMPACT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Clear filters button */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
              >
                <X className="h-4 w-4" />
                Ocisti
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead className="bg-[var(--surface-secondary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3">
              <button
                onClick={() => handleSort("status")}
                className="flex items-center gap-1 hover:text-[var(--foreground)]"
              >
                Status
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </th>
            <th className="px-4 py-3">
              <button
                onClick={() => handleSort("title")}
                className="flex items-center gap-1 hover:text-[var(--foreground)]"
              >
                Naslov
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </th>
            <th className="px-4 py-3">Kategorija</th>
            <th className="px-4 py-3">Utjecaj</th>
            <th className="px-4 py-3">
              <button
                onClick={() => handleSort("viewCount")}
                className="flex items-center gap-1 hover:text-[var(--foreground)]"
              >
                Pregledi
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </th>
            <th className="px-4 py-3">
              <button
                onClick={() => handleSort("publishedAt")}
                className="flex items-center gap-1 hover:text-[var(--foreground)]"
              >
                Objavljeno
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </th>
            <th className="px-4 py-3 text-right">Akcije</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] text-sm">
          {paginatedPosts.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                {hasActiveFilters ? "Nema rezultata za odabrane filtere" : "Nema vijesti"}
              </td>
            </tr>
          ) : (
            paginatedPosts.map((post) => (
              <tr key={post.id} className="hover:bg-[var(--surface-secondary)]/50">
                <td className="px-4 py-3">
                  <StatusBadge status={post.status} />
                </td>
                <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                  <div className="max-w-md truncate">{post.title}</div>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {categories.find((c) => c.id === post.categoryId)?.nameHr || post.categoryId || "-"}
                </td>
                <td className="px-4 py-3">
                  <ImpactBadge level={post.impactLevel} />
                </td>
                <td className="px-4 py-3 font-mono text-sm text-[var(--muted)]">
                  {post.viewCount.toLocaleString("hr-HR")}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString("hr-HR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/vijesti/${post.slug}`}
                      className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--surface-secondary)]"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/news/${post.id}`}
                      className="rounded-lg border border-[var(--border)] p-2 hover:bg-[var(--surface-secondary)]"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <DeleteButton postId={post.id} postTitle={post.title} />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-secondary)] px-6 py-3">
          <div className="text-sm text-[var(--muted)]">
            Stranica {currentPage} od {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface-secondary)]"
            >
              <ChevronLeft className="h-4 w-4" />
              Prethodna
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`h-8 w-8 rounded-lg text-sm ${
                      currentPage === pageNum
                        ? "bg-blue-600 text-white"
                        : "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]"
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--surface-secondary)]"
            >
              Sljedeca
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-500/20 text-gray-700 dark:text-gray-300",
    draft: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
    reviewing: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    published: "bg-green-500/20 text-green-700 dark:text-green-300",
  }

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] || colors.pending}`}
    >
      {status}
    </span>
  )
}

function ImpactBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-[var(--muted)]">-</span>

  const colors: Record<string, string> = {
    high: "bg-red-500/20 text-red-700 dark:text-red-300",
    medium: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
    low: "bg-gray-500/20 text-gray-700 dark:text-gray-300",
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[level] || ""}`}>
      {level}
    </span>
  )
}
