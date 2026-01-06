"use client"

import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { PaymentSlipModal } from "@/components/pausalni/payment-slip-modal"
import { DEADLINES, ADDITIONAL_DEADLINES } from "@/lib/fiscal-data"

interface Deadline {
  date: string // YYYY-MM-DD
  title: string
  type: "doprinosi" | "pdv" | "dohodak" | "porez" | "joppd"
  description: string
  applies: string[] // ["pausalni", "obrt-dohodak", "doo"]
  isObligation?: boolean
  obligationId?: string
  obligationType?: string
  periodMonth?: number
  periodYear?: number
  amount?: string
  status?: string
}

function toIsoDate(year: number, dateString: string) {
  const [day, month] = dateString.split(".").map(Number)
  const paddedMonth = String(month).padStart(2, "0")
  const paddedDay = String(day).padStart(2, "0")
  return `${year}-${paddedMonth}-${paddedDay}`
}

function buildStaticDeadlines(year: number): Deadline[] {
  const deadlines: Deadline[] = []

  // Monthly contributions
  const contributionDay = DEADLINES.contributions.monthly.dates[0]
  for (let month = 1; month <= 12; month += 1) {
    const dateString = `${contributionDay}.${String(month).padStart(2, "0")}`
    deadlines.push({
      date: toIsoDate(year, dateString),
      title: DEADLINES.contributions.monthly.name,
      type: "doprinosi",
      description: DEADLINES.contributions.monthly.description,
      applies: ["pausalni", "obrt-dohodak"],
    })
  }

  // Quarterly PDV
  for (const dateString of ADDITIONAL_DEADLINES.pdv.quarterly.dates) {
    const [, month] = dateString.split(".").map(Number)
    const pdvMeta =
      month === 1
        ? { quarter: 4, yearOffset: -1 }
        : month === 4
          ? { quarter: 1, yearOffset: 0 }
          : month === 7
            ? { quarter: 2, yearOffset: 0 }
            : month === 10
              ? { quarter: 3, yearOffset: 0 }
              : { quarter: Math.ceil(month / 3), yearOffset: 0 }

    const labelYear = year + pdvMeta.yearOffset
    deadlines.push({
      date: toIsoDate(year, dateString),
      title: `PDV Q${pdvMeta.quarter}/${labelYear}`,
      type: "pdv",
      description: `PDV prijava za Q${pdvMeta.quarter} ${labelYear}`,
      applies: ["pdv-obveznik"],
    })
  }

  // Annual filing
  deadlines.push({
    date: toIsoDate(year, DEADLINES.annualFiling.dohodak.dates[0]),
    title: DEADLINES.annualFiling.dohodak.name,
    type: "dohodak",
    description: DEADLINES.annualFiling.dohodak.description,
    applies: ["pausalni", "obrt-dohodak"],
  })

  deadlines.push({
    date: toIsoDate(year, DEADLINES.annualFiling.dobit.dates[0]),
    title: DEADLINES.annualFiling.dobit.name,
    type: "porez",
    description: DEADLINES.annualFiling.dobit.description,
    applies: ["doo", "jdoo"],
  })

  return deadlines
}

const typeColors = {
  doprinosi: "bg-interactive",
  pdv: "bg-chart-2",
  dohodak: "bg-success",
  porez: "bg-warning",
  joppd: "bg-danger",
}

// Status colors for database-driven obligations
const statusColors = {
  PAID: "bg-success",
  OVERDUE: "bg-danger",
  DUE_SOON: "bg-warning",
  PENDING: "bg-interactive",
  SKIPPED: "bg-neutral",
}

interface DeadlineCalendarProps {
  year: number
}

export function DeadlineCalendar({ year }: DeadlineCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null)
  const [filter, setFilter] = useState<string>("all")
  const [obligations, setObligations] = useState<Deadline[]>([])
  const [showPaymentSlip, setShowPaymentSlip] = useState(false)
  const staticDeadlines = useMemo(() => buildStaticDeadlines(year), [year])

  const monthNames = [
    "Siječanj",
    "Veljača",
    "Ožujak",
    "Travanj",
    "Svibanj",
    "Lipanj",
    "Srpanj",
    "Kolovoz",
    "Rujan",
    "Listopad",
    "Studeni",
    "Prosinac",
  ]

  // Fetch obligations from database for pausalni users
  useEffect(() => {
    async function fetchObligations() {
      try {
        const res = await fetch(`/api/pausalni/obligations?year=${year}`)
        if (res.ok) {
          const data = await res.json()

          // Convert obligations to Deadline format
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const obligationDeadlines: Deadline[] = data.obligations.map((ob: any) => {
            const obligationType = ob.obligationType
            let type: "doprinosi" | "pdv" | "dohodak" | "porez" | "joppd" = "doprinosi"
            let title = obligationType

            if (obligationType.includes("DOPRINOSI")) {
              type = "doprinosi"
              title = "Doprinosi"
            } else if (obligationType === "PDV") {
              type = "pdv"
              title = "PDV"
            } else if (obligationType.includes("DOHODAK")) {
              type = "dohodak"
              title = "Porez na dohodak"
            } else if (obligationType === "HOK") {
              type = "joppd"
              title = "HOK članarina"
            }

            return {
              date: ob.dueDate,
              title,
              type,
              description: `${title} za ${ob.periodMonth}/${ob.periodYear}`,
              applies: ["pausalni"],
              isObligation: true,
              obligationId: ob.id,
              obligationType: ob.obligationType,
              periodMonth: ob.periodMonth,
              periodYear: ob.periodYear,
              amount: ob.amount,
              status: ob.status,
            }
          })

          setObligations(obligationDeadlines)
        }
      } catch (error) {
        console.error("Failed to fetch obligations:", error)
      }
    }

    void fetchObligations()
  }, [year])

  const getDeadlinesForMonth = (month: number) => {
    // Combine static deadlines with database obligations
    const allDeadlines = [...staticDeadlines, ...obligations]

    return allDeadlines.filter((d) => {
      const deadlineMonth = parseInt(d.date.split("-")[1]) - 1
      const matchesMonth = deadlineMonth === month
      const matchesFilter = filter === "all" || d.applies.includes(filter)
      return matchesMonth && matchesFilter
    })
  }

  const getDaysInMonth = (month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (month: number) => {
    const day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1 // Monday = 0
  }

  const monthDeadlines = getDeadlinesForMonth(selectedMonth)
  const daysInMonth = getDaysInMonth(selectedMonth)
  const firstDay = getFirstDayOfMonth(selectedMonth)

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "btn-press rounded-full border px-3 py-1.5 text-sm font-medium",
            filter === "all"
              ? "border-focus bg-interactive text-white"
              : "border-white/20 bg-surface/5 text-white/90 hover:bg-surface/10"
          )}
        >
          Svi rokovi
        </button>
        <button
          type="button"
          onClick={() => setFilter("pausalni")}
          className={cn(
            "btn-press rounded-full border px-3 py-1.5 text-sm font-medium",
            filter === "pausalni"
              ? "border-focus bg-interactive text-white"
              : "border-white/20 bg-surface/5 text-white/90 hover:bg-surface/10"
          )}
        >
          Paušalni obrt
        </button>
        <button
          type="button"
          onClick={() => setFilter("doo")}
          className={cn(
            "btn-press rounded-full border px-3 py-1.5 text-sm font-medium",
            filter === "doo"
              ? "border-focus bg-interactive text-white"
              : "border-white/20 bg-surface/5 text-white/90 hover:bg-surface/10"
          )}
        >
          D.O.O.
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setSelectedMonth((m) => Math.max(0, m - 1))}
          className="btn-press inline-flex items-center justify-center rounded-md border border-white/20 bg-surface/5 p-2 hover:bg-surface/10 text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-display text-2xl font-semibold text-white">
          {monthNames[selectedMonth]} {year}
        </h2>
        <button
          type="button"
          onClick={() => setSelectedMonth((m) => Math.min(11, m + 1))}
          className="btn-press inline-flex items-center justify-center rounded-md border border-white/20 bg-surface/5 p-2 hover:bg-surface/10 text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl border border-white/20 overflow-hidden bg-surface-elevated/80">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-surface/10">
          {["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"].map((day) => (
            <div key={day} className="p-2 text-center text-sm font-semibold text-white/70">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} className="p-2 border-t border-white/10 bg-surface/5" />
          ))}

          {/* Month days */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const dateStr = `${year}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            const dayDeadlines = monthDeadlines.filter((d) => d.date === dateStr)
            const isToday = new Date().toISOString().split("T")[0] === dateStr

            return (
              <div
                key={day}
                className={cn(
                  "p-2 border-t border-white/10 min-h-[84px]",
                  isToday && "bg-interactive/20"
                )}
              >
                <span className={cn("text-sm text-white/90", isToday && "font-bold text-accent")}>
                  {day}
                </span>
                <div className="mt-1 space-y-1">
                  {dayDeadlines.map((deadline, idx) => {
                    // Use status color for obligations, type color for hardcoded deadlines
                    const bgColor =
                      deadline.isObligation && deadline.status
                        ? statusColors[deadline.status as keyof typeof statusColors] ||
                          typeColors[deadline.type]
                        : typeColors[deadline.type]

                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setSelectedDeadline(deadline)}
                        className={cn(
                          "btn-press w-full text-left text-xs p-1 rounded-md text-white truncate hover:opacity-95",
                          bgColor
                        )}
                      >
                        {deadline.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected deadline details */}
      {selectedDeadline && (
        <div className="card p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-white">{selectedDeadline.title}</h3>
              <p className="text-sm text-white/70">{selectedDeadline.date}</p>
              {selectedDeadline.isObligation && selectedDeadline.status && (
                <div className="mt-1">
                  <span
                    className={cn(
                      "inline-block px-2 py-0.5 text-xs rounded-full text-white",
                      statusColors[selectedDeadline.status as keyof typeof statusColors]
                    )}
                  >
                    {selectedDeadline.status === "PAID" && "Plaćeno"}
                    {selectedDeadline.status === "OVERDUE" && "Prosječen rok"}
                    {selectedDeadline.status === "DUE_SOON" && "Uskoro dospijeva"}
                    {selectedDeadline.status === "PENDING" && "Na čekanju"}
                    {selectedDeadline.status === "SKIPPED" && "Preskočeno"}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedDeadline(null)}
              className="btn-press inline-flex items-center justify-center rounded-md border border-white/20 bg-surface/5 p-2 hover:bg-surface/10 text-white"
              aria-label="Zatvori detalje"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-white/90">{selectedDeadline.description}</p>
          {selectedDeadline.amount && (
            <div className="mt-2">
              <span className="text-xs text-white/70">Iznos: </span>
              <span className="text-sm font-semibold text-white">
                {parseFloat(selectedDeadline.amount).toFixed(2)} EUR
              </span>
            </div>
          )}
          <div className="mt-2">
            <span className="text-xs text-white/70">Primjenjuje se na: </span>
            <span className="text-xs text-white/90">{selectedDeadline.applies.join(", ")}</span>
          </div>
          {selectedDeadline.isObligation && selectedDeadline.status !== "PAID" && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowPaymentSlip(true)}
                className="btn-press w-full rounded-md border border-focus bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
              >
                Prikaži uplatnicu
              </button>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="font-semibold text-white/90 w-full">Vrste obveza:</div>
          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <span className={cn("w-3 h-3 rounded", color)} />
              <span className="capitalize text-white/70">{type}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-sm pt-2 border-t border-white/10">
          <div className="font-semibold text-white/90 w-full">Statusi obveza:</div>
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <span className={cn("w-3 h-3 rounded", color)} />
              <span className="text-white/70">
                {status === "PAID" && "Plaćeno"}
                {status === "OVERDUE" && "Prosječen rok"}
                {status === "DUE_SOON" && "Uskoro dospijeva"}
                {status === "PENDING" && "Na čekanju"}
                {status === "SKIPPED" && "Preskočeno"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Slip Modal */}
      {showPaymentSlip && selectedDeadline?.isObligation && (
        <PaymentSlipModal
          obligation={{
            id: selectedDeadline.obligationId!,
            obligationType: selectedDeadline.obligationType!,
            periodMonth: selectedDeadline.periodMonth!,
            periodYear: selectedDeadline.periodYear!,
            amount: selectedDeadline.amount!,
            dueDate: selectedDeadline.date,
          }}
          onClose={() => setShowPaymentSlip(false)}
        />
      )}
    </div>
  )
}
