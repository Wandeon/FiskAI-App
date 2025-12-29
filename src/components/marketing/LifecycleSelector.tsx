"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Lightbulb, Rocket, Building2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useVisitorStore, type LifecycleStage } from "@/stores/visitor-store"

const stages: {
  id: LifecycleStage
  label: string
  shortLabel: string
  icon: typeof Lightbulb
  description: string
}[] = [
  {
    id: "planning",
    label: "Planiram",
    shortLabel: "Plan",
    icon: Lightbulb,
    description: "Istražujem opcije za pokretanje poslovanja",
  },
  {
    id: "starting",
    label: "Pokrećem",
    shortLabel: "Start",
    icon: Rocket,
    description: "Registriram firmu i pribavljam dokumente",
  },
  {
    id: "running",
    label: "Vodim",
    shortLabel: "Vodim",
    icon: Building2,
    description: "Imam aktivno poslovanje",
  },
  {
    id: "panicking",
    label: "Panično!",
    shortLabel: "Help!",
    icon: AlertTriangle,
    description: "Trebam hitnu pomoć s usklađenošću",
  },
]

export function LifecycleSelector({ className }: { className?: string }) {
  const { lifecycleStage, setLifecycleStage } = useVisitorStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Avoid hydration mismatch
  const currentStage = mounted ? lifecycleStage : "planning"

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="mr-2 hidden text-xs text-[var(--muted)] lg:inline">Ja sam:</span>
      <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
        {stages.map((stage) => {
          const Icon = stage.icon
          const isActive = currentStage === stage.id
          const isPanic = stage.id === "panicking"

          return (
            <button
              key={stage.id}
              onClick={() => setLifecycleStage(stage.id)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                "hover:bg-[var(--surface-secondary)]",
                isActive && !isPanic && "text-interactive",
                isActive && isPanic && "text-danger-text",
                !isActive && "text-[var(--muted)]"
              )}
              title={stage.description}
            >
              {isActive && (
                <motion.div
                  layoutId="lifecycle-indicator"
                  className={cn(
                    "absolute inset-0 rounded-md",
                    isPanic ? "bg-danger-bg" : "bg-info-bg"
                  )}
                  transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                />
              )}
              <Icon
                className={cn("relative z-10 h-3.5 w-3.5", isPanic && isActive && "animate-pulse")}
              />
              <span className="relative z-10 hidden sm:inline">{stage.shortLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Hook to get stage-specific content recommendations
export function useLifecycleContent() {
  const { lifecycleStage, businessType } = useVisitorStore()

  const getRecommendedTools = () => {
    switch (lifecycleStage) {
      case "planning":
        return [
          { href: "/wizard", label: "Koji oblik poslovanja?", priority: 1 },
          { href: "/vodic/pausalni-obrt", label: "Vodič: Paušalni obrt", priority: 2 },
          { href: "/alati/kalkulator-poreza", label: "Kalkulator poreza", priority: 3 },
        ]
      case "starting":
        return [
          { href: "/alati/oib-validator", label: "Provjeri OIB", priority: 1 },
          { href: "/alati/kalendar", label: "Rokovi za registraciju", priority: 2 },
          { href: "/register", label: "Otvori FiskAI račun", priority: 3 },
        ]
      case "running":
        return [
          { href: "/alati/e-racun", label: "Izradi e-račun", priority: 1 },
          { href: "/alati/kalendar", label: "Kalendar rokova", priority: 2 },
          { href: "/alati/pdv-kalkulator", label: "PDV kalkulator", priority: 3 },
        ]
      case "panicking":
        return [
          { href: "/alati/kalendar", label: "Hitni rokovi!", priority: 1 },
          { href: "/contact", label: "Kontaktiraj podršku", priority: 2 },
          { href: "/register", label: "Brza registracija", priority: 3 },
        ]
      default:
        return []
    }
  }

  const getHeroContent = () => {
    switch (lifecycleStage) {
      case "planning":
        return {
          headline: "Pronađi idealan oblik poslovanja",
          subheadline: "Usporedi paušalni obrt, d.o.o. i freelance opcije",
          cta: { label: "Pokreni čarobnjak", href: "/wizard" },
        }
      case "starting":
        return {
          headline: "Pokreni poslovanje u 24h",
          subheadline: "OIB, FINA certifikat, PDV prijava - sve na jednom mjestu",
          cta: { label: "Checklist za start", href: "/baza-znanja" },
        }
      case "running":
        return {
          headline: "E-fiskalizacija 2026 je tu",
          subheadline: "Generiraj UBL 2.1 XML račune i budi spreman za FINA",
          cta: { label: "Izradi e-račun", href: "/alati/e-racun" },
        }
      case "panicking":
        return {
          headline: "Bez panike - FiskAI pomaže",
          subheadline: "Provjeri rokove, generiraj dokumente, budi usklađen",
          cta: { label: "Provjeri hitne rokove", href: "/alati/kalendar" },
        }
      default:
        return {
          headline: "AI računovodstveni asistent",
          subheadline: "Za paušalne obrte i male poduzetnike u Hrvatskoj",
          cta: { label: "Započni besplatno", href: "/register" },
        }
    }
  }

  return {
    lifecycleStage,
    businessType,
    recommendedTools: getRecommendedTools(),
    heroContent: getHeroContent(),
  }
}
