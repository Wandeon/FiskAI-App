// src/app/(dashboard)/settings/guidance/GuidanceSettingsClient.tsx
"use client"

import { useState } from "react"
import { Save, Loader2, Mail, Check } from "lucide-react"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { CompetenceSelector } from "@/components/guidance"
import { Button } from "@/components/ui/button"
import type { UserGuidancePreferences } from "@/lib/db/schema/guidance"
import { type CompetenceLevel, type GuidanceCategory } from "@/lib/guidance/constants"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const categoryToKey: Record<GuidanceCategory, keyof UserGuidancePreferences> = {
  fakturiranje: "levelFakturiranje",
  financije: "levelFinancije",
  eu: "levelEu",
}

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
        [categoryToKey[category]]: level,
      }))
    }
    setSaved(false)
  }

  const handleEmailDigestChange = async (value: "daily" | "weekly" | "none") => {
    try {
      const res = await fetch("/api/guidance/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailDigest: value }),
      })
      if (res.ok) {
        const data = await res.json()
        setPreferences(data.preferences)
        toast.success("Postavke spremljene")
      }
    } catch (error) {
      toast.error("Greška pri spremanju")
    }
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
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Postavke pomoći</h1>
        <p className="text-[var(--muted)] mt-1">
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

      {/* Email Digest Settings */}
      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
            <Mail className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Email obavijesti</h3>
            <p className="text-sm text-white/70">Primajte preglede zadataka na email</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { value: "daily", label: "Dnevno", description: "Svaki dan u 8:00" },
            { value: "weekly", label: "Tjedno", description: "Svaki ponedjeljak u 8:00" },
            { value: "none", label: "Nikada", description: "Ne šalji email obavijesti" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => handleEmailDigestChange(option.value as "daily" | "weekly" | "none")}
              className={cn(
                "w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all",
                preferences?.emailDigest === option.value
                  ? "bg-brand-500/20 border border-brand-500/30"
                  : "bg-[var(--surface)]/50 border border-[var(--border)] hover:bg-[var(--surface)]"
              )}
            >
              <div className="text-left">
                <div className="font-medium text-[var(--foreground)]">{option.label}</div>
                <div className="text-sm text-[var(--muted)]">{option.description}</div>
              </div>
              {preferences?.emailDigest === option.value && (
                <Check className="h-5 w-5 text-brand-400" />
              )}
            </button>
          ))}
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
