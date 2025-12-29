"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, CheckCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

type TrafficLightStatus = "green" | "yellow" | "red"

interface DeadlineInfo {
  status: TrafficLightStatus
  message: string
  daysUntil?: number
  deadlineName?: string
}

async function fetchUpcomingDeadlines(): Promise<DeadlineInfo> {
  try {
    const response = await fetch("/api/deadlines/upcoming?days=14&limit=1")
    if (!response.ok) {
      return { status: "green", message: "Nema hitnih rokova" }
    }
    const data = await response.json()

    if (!data.deadlines || data.deadlines.length === 0) {
      return { status: "green", message: "Nema hitnih rokova ovaj tjedan" }
    }

    const nearest = data.deadlines[0]
    const daysUntil = nearest.daysUntil

    if (daysUntil <= 3) {
      return {
        status: "red",
        message: `HITNO: ${nearest.title}`,
        daysUntil,
        deadlineName: nearest.title,
      }
    } else if (daysUntil <= 7) {
      return {
        status: "yellow",
        message: `Uskoro: ${nearest.title} za ${daysUntil} dana`,
        daysUntil,
        deadlineName: nearest.title,
      }
    }

    return { status: "green", message: "Nema hitnih rokova ovaj tjedan" }
  } catch {
    return { status: "green", message: "Nema hitnih rokova" }
  }
}

const statusConfig = {
  green: {
    icon: CheckCircle,
    bg: "bg-success-bg",
    border: "border-success-border",
    text: "text-success-text",
    dot: "bg-success",
    glow: "shadow-success-border",
  },
  yellow: {
    icon: Clock,
    bg: "bg-warning-bg",
    border: "border-warning-border",
    text: "text-warning-text",
    dot: "bg-warning",
    glow: "shadow-warning-border",
  },
  red: {
    icon: AlertCircle,
    bg: "bg-danger-bg",
    border: "border-danger-border",
    text: "text-danger-text",
    dot: "bg-danger",
    glow: "shadow-danger-border",
  },
}

export function ComplianceTrafficLight({ className }: { className?: string }) {
  const [info, setInfo] = useState<DeadlineInfo>({
    status: "green",
    message: "Provjeravam...",
  })
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetchUpcomingDeadlines().then(setInfo)
    // Refresh every 5 minutes
    const interval = setInterval(
      () => {
        fetchUpcomingDeadlines().then(setInfo)
      },
      5 * 60 * 1000
    )
    return () => clearInterval(interval)
  }, [])

  const config = statusConfig[info.status]
  const Icon = config.icon

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
          config.bg,
          config.border,
          config.text,
          "hover:shadow-md",
          info.status === "red" && "animate-pulse"
        )}
        aria-label="Status usklađenosti"
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            config.dot,
            info.status !== "green" && "animate-ping"
          )}
          style={{ animationDuration: "2s" }}
        />
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">
          {info.status === "green" ? "OK" : info.daysUntil ? `${info.daysUntil}d` : "!"}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border p-3 shadow-lg",
              config.bg,
              config.border
            )}
          >
            <div className="flex items-start gap-2">
              <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", config.text)} />
              <div>
                <p className={cn("text-sm font-medium", config.text)}>{info.message}</p>
                {info.deadlineName && info.daysUntil !== undefined && (
                  <p className="mt-1 text-xs text-secondary">
                    {info.daysUntil === 0
                      ? "Rok je danas!"
                      : info.daysUntil === 1
                        ? "Rok je sutra!"
                        : `Rok za ${info.daysUntil} dana`}
                  </p>
                )}
                <a
                  href="/alati/kalendar"
                  className="mt-2 inline-block text-xs font-medium text-link hover:underline"
                >
                  Pogledaj kalendar rokova →
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
