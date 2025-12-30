"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import {
  COMPETENCE_LEVELS,
  GUIDANCE_CATEGORIES,
  type CompetenceLevel,
  type GuidanceCategory,
} from "@/lib/guidance/constants"
import { getHelpDensity, type HelpDensityConfig } from "@/lib/guidance/help-density"

interface GuidancePreferences {
  levelFakturiranje: CompetenceLevel
  levelFinancije: CompetenceLevel
  levelEu: CompetenceLevel
  globalLevel: CompetenceLevel | null
}

interface GuidanceContextType {
  preferences: GuidancePreferences
  isLoading: boolean
  getLevel: (category: GuidanceCategory) => CompetenceLevel
  setLevel: (category: GuidanceCategory | "global", level: CompetenceLevel) => Promise<void>
  shouldShowTooltip: (category: GuidanceCategory) => boolean
  shouldShowWizard: (category: GuidanceCategory) => boolean
  isDenseMode: () => boolean
  getHelpDensity: (category: GuidanceCategory) => HelpDensityConfig
}

const defaultPreferences: GuidancePreferences = {
  levelFakturiranje: "beginner",
  levelFinancije: "beginner",
  levelEu: "beginner",
  globalLevel: null,
}

const GuidanceContext = createContext<GuidanceContextType | null>(null)

export function GuidanceProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<GuidancePreferences>(defaultPreferences)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch preferences on mount
  useEffect(() => {
    async function fetchPreferences() {
      try {
        const res = await fetch("/api/guidance/preferences")
        if (res.ok) {
          const data = await res.json()
          setPreferences({
            levelFakturiranje: data.preferences.levelFakturiranje || "beginner",
            levelFinancije: data.preferences.levelFinancije || "beginner",
            levelEu: data.preferences.levelEu || "beginner",
            globalLevel: data.preferences.globalLevel || null,
          })
        }
      } catch (error) {
        console.error("Failed to fetch guidance preferences:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchPreferences()
  }, [])

  const getLevel = useCallback(
    (category: GuidanceCategory): CompetenceLevel => {
      if (preferences.globalLevel) return preferences.globalLevel

      switch (category) {
        case "fakturiranje":
          return preferences.levelFakturiranje
        case "financije":
          return preferences.levelFinancije
        case "eu":
          return preferences.levelEu
        default:
          return "beginner"
      }
    },
    [preferences]
  )

  const getHelpDensityConfig = useCallback(
    (category: GuidanceCategory): HelpDensityConfig => {
      const level = getLevel(category)
      return getHelpDensity(level)
    },
    [getLevel]
  )

  const setLevel = useCallback(
    async (category: GuidanceCategory | "global", level: CompetenceLevel) => {
      try {
        const body =
          category === "global"
            ? { globalLevel: level }
            : { [`level${category.charAt(0).toUpperCase() + category.slice(1)}`]: level }

        const res = await fetch("/api/guidance/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (res.ok) {
          const data = await res.json()
          setPreferences({
            levelFakturiranje: data.preferences.levelFakturiranje,
            levelFinancije: data.preferences.levelFinancije,
            levelEu: data.preferences.levelEu,
            globalLevel: data.preferences.globalLevel,
          })
        }
      } catch (error) {
        console.error("Failed to update guidance level:", error)
      }
    },
    []
  )

  const shouldShowTooltip = useCallback(
    (category: GuidanceCategory): boolean => {
      const level = getLevel(category)
      return level === "beginner"
    },
    [getLevel]
  )

  const shouldShowWizard = useCallback(
    (category: GuidanceCategory): boolean => {
      const level = getLevel(category)
      return level === "beginner" || level === "average"
    },
    [getLevel]
  )

  const isDenseMode = useCallback((): boolean => {
    // Dense mode if ALL categories are pro, or global is pro
    if (preferences.globalLevel === "pro") return true
    return (
      preferences.levelFakturiranje === "pro" &&
      preferences.levelFinancije === "pro" &&
      preferences.levelEu === "pro"
    )
  }, [preferences])

  return (
    <GuidanceContext.Provider
      value={{
        preferences,
        isLoading,
        getLevel,
        setLevel,
        shouldShowTooltip,
        shouldShowWizard,
        isDenseMode,
        getHelpDensity: getHelpDensityConfig,
      }}
    >
      {children}
    </GuidanceContext.Provider>
  )
}

export function useGuidance() {
  const context = useContext(GuidanceContext)
  if (!context) {
    throw new Error("useGuidance must be used within a GuidanceProvider")
  }
  return context
}

export function useGuidanceLevel(category: GuidanceCategory) {
  const { getLevel, shouldShowTooltip, shouldShowWizard } = useGuidance()
  return {
    level: getLevel(category),
    showTooltip: shouldShowTooltip(category),
    showWizard: shouldShowWizard(category),
  }
}
