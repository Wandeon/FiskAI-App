"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Calendar, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

const TARGET_DATE = new Date("2026-01-01T00:00:00+01:00") // Croatian timezone

function calculateTimeLeft(): TimeLeft {
  const now = new Date()
  const difference = TARGET_DATE.getTime() - now.getTime()

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  }
}

function getUrgencyLevel(days: number): "relaxed" | "attention" | "urgent" | "critical" {
  if (days > 180) return "relaxed"
  if (days > 90) return "attention"
  if (days > 30) return "urgent"
  return "critical"
}

const urgencyStyles = {
  relaxed: {
    bg: "bg-success-bg",
    border: "border-success-border",
    text: "text-success-text",
    bar: "bg-success",
  },
  attention: {
    bg: "bg-info-bg",
    border: "border-info-border",
    text: "text-info-text",
    bar: "bg-info",
  },
  urgent: {
    bg: "bg-warning-bg",
    border: "border-warning-border",
    text: "text-warning-text",
    bar: "bg-warning",
  },
  critical: {
    bg: "bg-danger-bg",
    border: "border-danger-border",
    text: "text-danger-text",
    bar: "bg-danger",
  },
}

interface CountdownTimerProps {
  variant?: "compact" | "detailed"
  className?: string
  showLink?: boolean
}

export function CountdownTimer({
  variant = "compact",
  className,
  showLink = true,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  if (!mounted) {
    return (
      <div className={cn("rounded-xl border border-white/10 bg-white/5 p-4", className)}>
        <div className="h-16 animate-pulse rounded bg-white/10" />
      </div>
    )
  }

  const urgency = getUrgencyLevel(timeLeft.days)
  const styles = urgencyStyles[urgency]
  const progress = Math.max(0, Math.min(100, ((365 - timeLeft.days) / 365) * 100))

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "rounded-xl border p-4 backdrop-blur-sm",
          styles.bg,
          styles.border,
          className
        )}
      >
        <div className="mb-2 flex items-center gap-2">
          <Calendar className={cn("h-4 w-4", styles.text)} />
          <span className="text-xs font-semibold text-white/80">E-RAČUNI 2026</span>
        </div>

        <div className="mb-2 flex items-baseline gap-1">
          <span className={cn("text-2xl font-bold", styles.text)}>{timeLeft.days}</span>
          <span className="text-sm text-white/60">dana</span>
        </div>

        {/* Progress bar */}
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className={cn("h-full rounded-full", styles.bar)}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>

        {showLink && (
          <Link
            href="/fiskalizacija"
            className={cn(
              "flex items-center justify-center gap-1 text-xs font-medium transition-colors",
              styles.text,
              "hover:text-white"
            )}
          >
            Jesi li spreman? →
          </Link>
        )}
      </div>
    )
  }

  // Detailed variant
  return (
    <div
      className={cn("rounded-2xl border p-6 backdrop-blur-sm", styles.bg, styles.border, className)}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {urgency === "critical" || urgency === "urgent" ? (
            <AlertTriangle className={cn("h-5 w-5", styles.text)} />
          ) : (
            <Calendar className={cn("h-5 w-5", styles.text)} />
          )}
          <span className="font-semibold text-white">E-računi postaju obvezni</span>
        </div>
        <span className="text-sm text-white/60">01.01.2026.</span>
      </div>

      {/* Countdown boxes */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        <TimeBox value={timeLeft.days} label="dana" highlight />
        <TimeBox value={timeLeft.hours} label="sati" />
        <TimeBox value={timeLeft.minutes} label="min" />
        <TimeBox value={timeLeft.seconds} label="sek" />
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs text-white/60">
          <span>Napredak godine</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className={cn("h-full rounded-full", styles.bar)}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>

      {showLink && (
        <Link
          href="/fiskalizacija"
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all",
            "bg-white/10 text-white hover:bg-white/20"
          )}
        >
          Provjeri svoju spremnost →
        </Link>
      )}
    </div>
  )
}

function TimeBox({
  value,
  label,
  highlight = false,
}: {
  value: number
  label: string
  highlight?: boolean
}) {
  return (
    <div className={cn("rounded-lg p-2 text-center", highlight ? "bg-white/15" : "bg-white/5")}>
      <div className={cn("text-xl font-bold", highlight ? "text-white" : "text-white/80")}>
        {value.toString().padStart(2, "0")}
      </div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  )
}
