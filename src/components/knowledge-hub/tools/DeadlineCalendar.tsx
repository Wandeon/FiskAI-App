"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

interface Deadline {
  date: string // YYYY-MM-DD
  title: string
  type: "doprinosi" | "pdv" | "dohodak" | "porez" | "joppd"
  description: string
  applies: string[] // ["pausalni", "obrt-dohodak", "doo"]
}

const DEADLINES_2025: Deadline[] = [
  // Monthly - Contributions (every 15th)
  ...Array.from({ length: 12 }, (_, i) => ({
    date: `2025-${String(i + 1).padStart(2, "0")}-15`,
    title: "Doprinosi",
    type: "doprinosi" as const,
    description: "Rok za uplatu mjesečnih doprinosa MIO i HZZO",
    applies: ["pausalni", "obrt-dohodak"],
  })),
  // Quarterly PDV
  {
    date: "2025-01-20",
    title: "PDV Q4/2024",
    type: "pdv",
    description: "PDV prijava za Q4 2024",
    applies: ["pdv-obveznik"],
  },
  {
    date: "2025-04-20",
    title: "PDV Q1/2025",
    type: "pdv",
    description: "PDV prijava za Q1 2025",
    applies: ["pdv-obveznik"],
  },
  {
    date: "2025-07-20",
    title: "PDV Q2/2025",
    type: "pdv",
    description: "PDV prijava za Q2 2025",
    applies: ["pdv-obveznik"],
  },
  {
    date: "2025-10-20",
    title: "PDV Q3/2025",
    type: "pdv",
    description: "PDV prijava za Q3 2025",
    applies: ["pdv-obveznik"],
  },
  // Annual
  {
    date: "2025-02-28",
    title: "Godišnja prijava",
    type: "dohodak",
    description: "Rok za godišnju prijavu poreza na dohodak",
    applies: ["pausalni", "obrt-dohodak"],
  },
  {
    date: "2025-04-30",
    title: "Prijava poreza na dobit",
    type: "porez",
    description: "Rok za prijavu poreza na dobit",
    applies: ["doo", "jdoo"],
  },
]

const typeColors = {
  doprinosi: "bg-blue-600",
  pdv: "bg-purple-600",
  dohodak: "bg-green-600",
  porez: "bg-amber-500",
  joppd: "bg-red-600",
}

interface DeadlineCalendarProps {
  year: number
}

export function DeadlineCalendar({ year }: DeadlineCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null)
  const [filter, setFilter] = useState<string>("all")

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

  const getDeadlinesForMonth = (month: number) => {
    return DEADLINES_2025.filter((d) => {
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
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-white/20 bg-white/5 text-white/90 hover:bg-white/10"
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
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-white/20 bg-white/5 text-white/90 hover:bg-white/10"
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
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-white/20 bg-white/5 text-white/90 hover:bg-white/10"
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
          className="btn-press inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 p-2 hover:bg-white/10 text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-display text-2xl font-semibold text-white">
          {monthNames[selectedMonth]} {year}
        </h2>
        <button
          type="button"
          onClick={() => setSelectedMonth((m) => Math.min(11, m + 1))}
          className="btn-press inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 p-2 hover:bg-white/10 text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl border border-white/20 overflow-hidden bg-slate-800/80">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-white/10">
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
            <div key={`empty-${i}`} className="p-2 border-t border-white/10 bg-white/5" />
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
                  isToday && "bg-blue-500/20"
                )}
              >
                <span className={cn("text-sm text-white/90", isToday && "font-bold text-cyan-400")}>
                  {day}
                </span>
                <div className="mt-1 space-y-1">
                  {dayDeadlines.map((deadline, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setSelectedDeadline(deadline)}
                      className={cn(
                        "btn-press w-full text-left text-xs p-1 rounded-md text-white truncate hover:opacity-95",
                        typeColors[deadline.type]
                      )}
                    >
                      {deadline.title}
                    </button>
                  ))}
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
            </div>
            <button
              type="button"
              onClick={() => setSelectedDeadline(null)}
              className="btn-press inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 p-2 hover:bg-white/10 text-white"
              aria-label="Zatvori detalje"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-white/90">{selectedDeadline.description}</p>
          <div className="mt-2">
            <span className="text-xs text-white/70">Primjenjuje se na: </span>
            <span className="text-xs text-white/90">{selectedDeadline.applies.join(", ")}</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(typeColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <span className={cn("w-3 h-3 rounded", color)} />
            <span className="capitalize text-white/70">{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
