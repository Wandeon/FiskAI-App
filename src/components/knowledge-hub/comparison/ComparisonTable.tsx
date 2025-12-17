"use client"

import { cn } from "@/lib/utils"
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { ComparisonCell } from "./ComparisonCell"

interface ComparisonColumn {
  id: string
  name: string
  highlighted?: boolean
}

interface ComparisonRow {
  label: string
  tooltip?: string
  values: Record<string, string | ReactNode>
}

interface ComparisonTableProps {
  columns?: ComparisonColumn[]
  rows?: ComparisonRow[]
  compareIds?: string[]
  highlightedColumn?: string // from URL params
  children?: ReactNode
}

type ParsedCell = {
  type?: any
  isPositive?: boolean
  isNegative?: boolean
  content: ReactNode
}

type ParsedRow = {
  label: string
  tooltip?: string
  cells: ParsedCell[]
}

function labelForCompareId(id: string) {
  const normalized = id.toLowerCase()
  if (normalized === "pausalni-uz-posao") return "Paušalni uz posao"
  if (normalized === "pausalni") return "Paušalni obrt"
  if (normalized.startsWith("pausalni-")) return "Paušalni obrt"
  if (normalized === "obrt-dohodak") return "Obrt na dohodak"
  if (normalized === "jdoo") return "J.D.O.O."
  if (normalized === "doo") return "D.O.O."
  if (normalized === "freelancer") return "Freelancer"
  if (normalized === "ugovor-djelo") return "Ugovor o djelu"
  if (normalized === "autorski") return "Autorski honorar"
  return id.replace(/-/g, " ")
}

export function ComparisonTable({
  columns,
  rows,
  compareIds,
  highlightedColumn,
  children,
}: ComparisonTableProps) {
  const tableDomId = `comparison-table-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const [showScrollHint, setShowScrollHint] = useState(true)
  const compareKey = (compareIds ?? []).join("|")

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollHint(false)
    }

    const scrollContainer = document.getElementById("mobile-comparison-scroll")
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, { once: true })
      return () => scrollContainer.removeEventListener("scroll", handleScroll)
    }
  }, [])

  const derivedColumns = useMemo(
    () => (compareIds ?? []).map((id) => ({ id, name: labelForCompareId(id) })),
    [compareKey]
  )

  const parsedRows: ParsedRow[] = useMemo(() => {
    if (!children) return []

    return Children.toArray(children)
      .filter(isValidElement)
      .map((rowEl: any) => {
        const label = String(rowEl.props?.label ?? "")
        const tooltip = rowEl.props?.tooltip ? String(rowEl.props.tooltip) : undefined
        const cells: ParsedCell[] = Children.toArray(rowEl.props?.children).map((cellNode) => {
          if (isValidElement(cellNode)) {
            const props: any = cellNode.props ?? {}
            return {
              type: props.type,
              isPositive: !!props.isPositive,
              isNegative: !!props.isNegative,
              content: props.children,
            }
          }
          return { content: cellNode }
        })
        return { label, tooltip, cells }
      })
      .filter((row) => row.label.length > 0)
  }, [children])

  const inferredColumnCount = derivedColumns.length || parsedRows[0]?.cells.length || 0
  const columnsToUse = useMemo(() => {
    if (derivedColumns.length > 0) return derivedColumns
    if (!inferredColumnCount) return []
    return Array.from({ length: inferredColumnCount }).map((_, index) => ({
      id: `col-${index + 1}`,
      name: `Opcija ${index + 1}`,
    }))
  }, [derivedColumns, inferredColumnCount])

  const [activeId, setActiveId] = useState(() => columnsToUse[0]?.id ?? "")
  const columnsKey = columnsToUse.map((c) => c.id).join("|")

  useEffect(() => {
    const firstId = columnsToUse[0]?.id
    if (!firstId) return
    const preferred =
      highlightedColumn && columnsToUse.some((c) => c.id === highlightedColumn)
        ? highlightedColumn
        : firstId

    setActiveId((current) => {
      if (!current) return preferred
      if (!columnsToUse.some((c) => c.id === current)) return preferred
      if (current === firstId && preferred !== firstId) return preferred
      return current
    })
  }, [columnsKey, columnsToUse, highlightedColumn])

  const activeIndex = Math.max(
    0,
    columnsToUse.findIndex((c) => c.id === activeId)
  )
  const activeColumn = columnsToUse[activeIndex]
  const highlightIndex =
    highlightedColumn && columnsToUse.length > 0
      ? columnsToUse.findIndex((c) => c.id === highlightedColumn)
      : -1

  // If children are provided, render them directly in a table structure
  if (children) {
    return (
      <div className="not-prose my-6">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
          {highlightIndex >= 0 && (
            <style>{`
              #${tableDomId} tbody tr td:nth-child(${highlightIndex + 2}) { background-color: rgba(59,130,246,0.06); }
              #${tableDomId} tbody tr:hover td:nth-child(${highlightIndex + 2}) { background-color: rgba(59,130,246,0.10); }
            `}</style>
          )}
          <table id={tableDomId} className="w-full border-collapse">
            {columnsToUse.length > 0 && (
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-30 min-w-[180px] border-b border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-left font-semibold text-[var(--foreground)]">
                    Usporedba
                  </th>
                  {columnsToUse.map((col) => (
                    <th
                      key={col.id}
                      className={cn(
                        "sticky top-0 z-20 min-w-[180px] border-b border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-center font-semibold text-[var(--foreground)]",
                        col.id === highlightedColumn && "bg-[rgba(59,130,246,0.12)]"
                      )}
                    >
                      {col.name}
                      {col.id === highlightedColumn && (
                        <span className="block text-xs font-normal text-[var(--accent)]">
                          Preporučeno
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>{children}</tbody>
          </table>
        </div>

        {/* Mobile Comparison Cards */}
        <div className="md:hidden">
          <div
            className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {columnsToUse.map((col) => {
              const selected = col.id === activeId
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setActiveId(col.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                    selected
                      ? "border-[rgba(59,130,246,0.25)] bg-[rgba(59,130,246,0.12)] text-[var(--foreground)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
                  )}
                >
                  {col.name}
                </button>
              )
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[var(--muted)]">Odabrana opcija</p>
                <p className="text-base font-semibold">{activeColumn?.name ?? "Usporedba"}</p>
              </div>
              {activeColumn?.id === highlightedColumn && (
                <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  Preporučeno
                </span>
              )}
            </div>

            <dl className="mt-4 space-y-3">
              {parsedRows.map((row) => {
                const cell = row.cells[activeIndex]
                const content = cell?.content ?? "—"
                return (
                  <div
                    key={row.label}
                    className="flex items-start justify-between gap-3 border-b border-[var(--border-light)] pb-3 last:border-b-0 last:pb-0"
                  >
                    <dt className="max-w-[52%] text-xs font-medium text-[var(--muted)]">
                      <span>{row.label}</span>
                      {row.tooltip && (
                        <span
                          className="ml-1 cursor-help text-[var(--muted)]/70"
                          title={row.tooltip}
                        >
                          ⓘ
                        </span>
                      )}
                    </dt>
                    <dd className="text-right">
                      <ComparisonCell
                        as="span"
                        type={cell?.type ?? "generic"}
                        isPositive={cell?.isPositive}
                        isNegative={cell?.isNegative}
                      >
                        {content}
                      </ComparisonCell>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        </div>
      </div>
    )
  }

  // Original prop-based approach for backwards compatibility
  if (!columns || !rows) {
    return (
      <div className="text-red-500">
        ComparisonTable requires either children or columns/rows props
      </div>
    )
  }

  return (
    <div className="not-prose">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-left font-semibold text-[var(--foreground)]">
                Usporedba
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={cn(
                    "border-b border-[var(--border)] p-3 text-center font-semibold text-[var(--foreground)]",
                    col.highlighted || col.id === highlightedColumn
                      ? "bg-[rgba(59,130,246,0.12)]"
                      : "bg-[var(--surface-secondary)]"
                  )}
                >
                  {col.name}
                  {(col.highlighted || col.id === highlightedColumn) && (
                    <span className="block text-xs font-normal text-[var(--accent)]">
                      Preporučeno
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-[var(--border)] hover:bg-[var(--surface-secondary)]/40"
              >
                <td className="p-3 font-medium text-[var(--foreground)]">
                  {row.label}
                  {row.tooltip && (
                    <span className="ml-1 cursor-help text-[var(--muted)]" title={row.tooltip}>
                      ⓘ
                    </span>
                  )}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      "p-3 text-center",
                      (col.highlighted || col.id === highlightedColumn) &&
                        "bg-[rgba(59,130,246,0.06)]"
                    )}
                  >
                    {row.values[col.id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Horizontal Scroll Table */}
      <div className="md:hidden relative">
        {/* Scroll hint indicator */}
        {showScrollHint && (
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 flex w-12 items-center justify-end bg-gradient-to-l from-[var(--surface)] to-transparent pr-2">
            <span className="animate-pulse text-xs text-[var(--muted)]">→</span>
          </div>
        )}

        <div
          id="mobile-comparison-scroll"
          className="overflow-x-auto -mx-4 px-4 pb-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <table className="w-full border-collapse min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[120px] border-b border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-left font-semibold text-[var(--foreground)] shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                  Usporedba
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={cn(
                      "min-w-[140px] border-b border-[var(--border)] p-3 text-center font-semibold text-[var(--foreground)]",
                      col.highlighted || col.id === highlightedColumn
                        ? "bg-[rgba(59,130,246,0.12)]"
                        : "bg-[var(--surface-secondary)]"
                    )}
                  >
                    <div className="whitespace-nowrap">{col.name}</div>
                    {(col.highlighted || col.id === highlightedColumn) && (
                      <span className="mt-1 block text-xs font-normal text-[var(--accent)]">
                        Preporučeno
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b">
                  <td className="sticky left-0 z-10 min-h-[44px] border-r border-[var(--border)] bg-[var(--surface)] p-3 font-medium text-[var(--foreground)] shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{row.label}</span>
                      {row.tooltip && (
                        <span
                          className="cursor-help text-xs text-[var(--muted)]"
                          title={row.tooltip}
                        >
                          ⓘ
                        </span>
                      )}
                    </div>
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        "p-3 text-center text-sm min-h-[44px]",
                        (col.highlighted || col.id === highlightedColumn) &&
                          "bg-[rgba(59,130,246,0.06)]"
                      )}
                    >
                      {row.values[col.id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Swipe hint text */}
        {showScrollHint && (
          <div className="mt-2 text-center text-xs text-[var(--muted)]">
            Povucite za više opcija
          </div>
        )}
      </div>
    </div>
  )
}
