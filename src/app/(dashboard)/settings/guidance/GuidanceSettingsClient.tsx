// src/app/(dashboard)/settings/guidance/GuidanceSettingsClient.tsx
"use client"

import { useState } from "react"
import { Save, Loader2 } from "lucide-react"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { CompetenceSelector } from "@/components/guidance"
import { Button } from "@/components/ui/primitives/button"
import type { UserGuidancePreferences } from "@/lib/db/schema/guidance"
import {
  type CompetenceLevel,
  type GuidanceCategory,
  LEVEL_DESCRIPTIONS,
} from "@/lib/guidance/constants"

interface Props {
  initialPreferences: UserGuidancePreferences
}

export function GuidanceSettingsClient({ initialPreferences }: Props) {
  const [preferences, setPreferences] = useState(initialPreferences)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleLevelChange = (category: GuidanceCategory | "global", level: CompetenceLevel) => {
    if (category === "global") {
      setPreferences((prev) => ({
        ...prev,
        globalLevel: level,
        levelFakturiranje: level,
        levelFinancije: level,
        levelEu: level,
      }))
    } else {
      setPreferences((prev) => ({
        ...prev,
        globalLevel: null,
        [`level${category.charAt(0).toUpperCase() + category.slice(1)}`]: level,
      }))
    }
    setSaved(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await fetch("/api/guidance/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          levelFakturiranje: preferences.levelFakturiranje,
          levelFinancije: preferences.levelFinancije,
          levelEu: preferences.levelEu,
          globalLevel: preferences.globalLevel,
          emailDigest: preferences.emailDigest,
          pushEnabled: preferences.pushEnabled,
        }),
      })
      setSaved(true)
    } catch (error) {
      console.error("Failed to save preferences:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Postavke pomoći</h1>
        <p className="text-white/60 mt-1">
          Prilagodite razinu pomoći i vodiča prema vašem iskustvu
        </p>
      </div>

      <GlassCard hover={false} padding="lg">
        <h2 className="text-lg font-semibold text-white mb-4">Razina iskustva</h2>

        <CompetenceSelector
          levels={{
            fakturiranje: preferences.levelFakturiranje as CompetenceLevel,
            financije: preferences.levelFinancije as CompetenceLevel,
            eu: preferences.levelEu as CompetenceLevel,
          }}
          globalLevel={preferences.globalLevel as CompetenceLevel | null}
          onChange={handleLevelChange}
        />
      </GlassCard>

      <GlassCard hover={false} padding="lg">
        <h2 className="text-lg font-semibold text-white mb-4">Obavijesti</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white/80">Email podsjetnici</label>
            <select
              value={preferences.emailDigest || "weekly"}
              onChange={(e) => {
                setPreferences((prev) => ({ ...prev, emailDigest: e.target.value }))
                setSaved(false)
              }}
              className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
            >
              <option value="daily">Dnevno</option>
              <option value="weekly">Tjedno</option>
              <option value="none">Isključeno</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-white/80">Push obavijesti</label>
              <p className="text-xs text-white/50">Primaj obavijesti u pregledniku</p>
            </div>
            <button
              onClick={() => {
                setPreferences((prev) => ({ ...prev, pushEnabled: !prev.pushEnabled }))
                setSaved(false)
              }}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                preferences.pushEnabled ? "bg-cyan-500" : "bg-white/20"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  preferences.pushEnabled ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </GlassCard>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || saved}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Spremam...
            </>
          ) : saved ? (
            "Spremljeno ✓"
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Spremi postavke
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
