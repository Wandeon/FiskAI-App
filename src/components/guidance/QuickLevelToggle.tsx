// src/components/guidance/QuickLevelToggle.tsx
"use client"

import { useState, useEffect } from "react"
import { Sparkles, Gauge, Zap, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { COMPETENCE_LEVELS, LEVEL_LABELS, type CompetenceLevel } from "@/lib/guidance/constants"

interface QuickLevelToggleProps {
  className?: string
  variant?: "dropdown" | "buttons"
}

const levelIcons = {
  beginner: Sparkles,
  average: Gauge,
  pro: Zap,
}

const levelColors = {
  beginner: "text-success",
  average: "text-warning",
  pro: "text-accent",
}

export function QuickLevelToggle({ className, variant = "dropdown" }: QuickLevelToggleProps) {
  const [currentLevel, setCurrentLevel] = useState<CompetenceLevel>("beginner")
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch current global level
  useEffect(() => {
    async function fetchLevel() {
      try {
        const res = await fetch("/api/guidance/preferences")
        if (res.ok) {
          const data = await res.json()
          // Use global level or determine from individual levels
          const level =
            data.preferences.globalLevel ||
            (data.preferences.levelFakturiranje === data.preferences.levelFinancije &&
            data.preferences.levelFinancije === data.preferences.levelEu
              ? data.preferences.levelFakturiranje
              : "beginner")
          setCurrentLevel(level)
        }
      } catch (error) {
        console.error("Failed to fetch level:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchLevel()
  }, [])

  const handleSetLevel = async (level: CompetenceLevel) => {
    setCurrentLevel(level)
    setIsOpen(false)

    try {
      await fetch("/api/guidance/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalLevel: level }),
      })
    } catch (error) {
      console.error("Failed to update level:", error)
    }
  }

  const CurrentIcon = levelIcons[currentLevel]
  const levels = Object.values(COMPETENCE_LEVELS) as CompetenceLevel[]

  // Listen for keyboard shortcut (Cmd+G / Ctrl+G) to cycle levels
  useEffect(() => {
    const handleToggle = () => {
      const currentIndex = levels.indexOf(currentLevel)
      const nextIndex = (currentIndex + 1) % levels.length
      handleSetLevel(levels[nextIndex])
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
        e.preventDefault()
        handleToggle()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("toggle-guidance-level", handleToggle)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("toggle-guidance-level", handleToggle)
    }
  }, [currentLevel, levels])

  if (variant === "buttons") {
    return (
      <div className={cn("flex gap-1", className)}>
        {levels.map((level) => {
          const Icon = levelIcons[level]
          const isActive = currentLevel === level
          return (
            <button
              key={level}
              onClick={() => handleSetLevel(level)}
              disabled={isLoading}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                isActive
                  ? `bg-surface/10 ${levelColors[level]}`
                  : "text-white/50 hover:text-white/70 hover:bg-surface/5"
              )}
              title={LEVEL_LABELS[level]}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{LEVEL_LABELS[level]}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-all",
          "bg-surface/5 hover:bg-surface/10 border border-white/10",
          levelColors[currentLevel]
        )}
      >
        <CurrentIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{LEVEL_LABELS[currentLevel]}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-white/10 bg-surface-elevated py-1 shadow-xl">
            <div className="px-3 py-2 text-xs text-white/50 border-b border-white/10">
              Razina pomoći
            </div>
            {levels.map((level) => {
              const Icon = levelIcons[level]
              const isActive = currentLevel === level
              return (
                <button
                  key={level}
                  onClick={() => handleSetLevel(level)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                    isActive
                      ? `${levelColors[level]} bg-surface/5`
                      : "text-white/70 hover:bg-surface/5 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{LEVEL_LABELS[level]}</span>
                  {isActive && <span className="ml-auto text-xs">✓</span>}
                </button>
              )
            })}
            <div className="px-3 py-2 text-xs text-white/40 border-t border-white/10">
              <a href="/settings/guidance" className="hover:text-white/60">
                Više opcija →
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
