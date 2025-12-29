"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, Circle, ChevronUp, ChevronDown, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useComplianceStore,
  type ComplianceStep,
  getTrafficLightColor,
} from "@/stores/compliance-store"
import { useVisitorStore } from "@/stores/visitor-store"

// Default checklists based on business type
const defaultChecklists: Record<string, { title: string; steps: ComplianceStep[] }> = {
  pausal: {
    title: "Paušalni obrt - Priprema",
    steps: [
      "oib-registration",
      "bank-account",
      "fina-certificate",
      "fiscal-device",
      "first-invoice",
    ],
  },
  doo: {
    title: "D.O.O. - Priprema",
    steps: [
      "oib-registration",
      "bank-account",
      "fina-certificate",
      "vat-registration",
      "employee-registration",
      "fiscal-device",
      "first-invoice",
    ],
  },
  default: {
    title: "Poslovna spremnost",
    steps: ["oib-registration", "bank-account", "fina-certificate", "first-invoice"],
  },
}

const stepLabels: Record<ComplianceStep, string> = {
  "oib-registration": "OIB registracija",
  "bank-account": "Poslovni račun",
  "fina-certificate": "FINA certifikat",
  "vat-registration": "PDV prijava",
  "employee-registration": "Prijava zaposlenika",
  "fiscal-device": "Fiskalna blagajna",
  "first-invoice": "Prvi račun",
}

const stepPoints: Record<ComplianceStep, number> = {
  "oib-registration": 15,
  "bank-account": 15,
  "fina-certificate": 20,
  "vat-registration": 15,
  "employee-registration": 10,
  "fiscal-device": 15,
  "first-invoice": 10,
}

export function ComplianceProgressBar({ className }: { className?: string }) {
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { businessType } = useVisitorStore()
  const {
    completedSteps,
    currentChecklist,
    complianceScore,
    markStepComplete,
    unmarkStep,
    setChecklist,
    calculateScore,
  } = useComplianceStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize checklist based on business type
  useEffect(() => {
    if (!mounted) return

    if (!currentChecklist) {
      const type = businessType === "pausal" ? "pausal" : businessType === "doo" ? "doo" : "default"
      const checklist = defaultChecklists[type]
      setChecklist({
        id: type,
        title: checklist.title,
        steps: checklist.steps,
        businessType: type,
      })
    }
  }, [mounted, businessType, currentChecklist, setChecklist])

  // Recalculate score when steps change
  useEffect(() => {
    if (mounted && currentChecklist) {
      calculateScore()
    }
  }, [mounted, completedSteps, currentChecklist, calculateScore])

  if (!mounted) return null

  const checklist = currentChecklist || defaultChecklists.default
  const steps = checklist.steps
  const trafficLight = getTrafficLightColor(complianceScore)

  const handleToggleStep = (step: ComplianceStep) => {
    if (completedSteps.includes(step)) {
      unmarkStep(step)
    } else {
      markStepComplete(step)
    }
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--glass-surface)] backdrop-blur transition-all",
        className
      )}
    >
      {/* Collapsed Bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 hover:bg-[var(--surface-secondary)]"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white",
              trafficLight === "green" && "bg-success",
              trafficLight === "yellow" && "bg-warning",
              trafficLight === "red" && "bg-danger"
            )}
          >
            {complianceScore}%
          </div>
          <div className="text-left">
            <p className="text-sm font-medium">Tvoja spremnost</p>
            <p className="text-xs text-[var(--muted)]">
              {completedSteps.length} / {steps.length} koraka
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="hidden flex-1 px-6 sm:block">
          <div className="h-2 overflow-hidden rounded-full bg-surface-1">
            <motion.div
              className={cn(
                "h-full rounded-full",
                trafficLight === "green" && "bg-success",
                trafficLight === "yellow" && "bg-warning",
                trafficLight === "red" && "bg-danger"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${complianceScore}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">{expanded ? "Zatvori" : "Detalji"}</span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
          ) : (
            <ChevronUp className="h-4 w-4 text-[var(--muted)]" />
          )}
        </div>
      </button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[var(--border)]"
          >
            <div className="mx-auto max-w-4xl px-4 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{checklist.title}</h3>
                <a
                  href="/register"
                  className="flex items-center gap-1 rounded-md bg-interactive px-3 py-1.5 text-xs font-medium text-white hover:bg-interactive-hover"
                >
                  <Save className="h-3 w-3" />
                  Spremi napredak
                </a>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {steps.map((step) => {
                  const isComplete = completedSteps.includes(step)
                  const points = stepPoints[step] || 10

                  return (
                    <button
                      key={step}
                      onClick={() => handleToggleStep(step)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-3 text-left transition-all",
                        isComplete
                          ? "border-success-border bg-success-bg"
                          : "border-[var(--border)] bg-[var(--surface)] hover:border-focus"
                      )}
                    >
                      {isComplete ? (
                        <CheckCircle className="h-5 w-5 flex-shrink-0 text-success-icon" />
                      ) : (
                        <Circle className="h-5 w-5 flex-shrink-0 text-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm font-medium",
                            isComplete && "text-success-text"
                          )}
                        >
                          {stepLabels[step] || step}
                        </p>
                        <p className="text-xs text-[var(--muted)]">+{points}%</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <p className="mt-3 text-center text-xs text-[var(--muted)]">
                Kreiraj račun da sačuvaš napredak i pristupiš svim alatima →{" "}
                <a href="/register" className="font-medium text-link hover:underline">
                  Besplatna registracija
                </a>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
