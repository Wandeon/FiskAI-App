"use client"

import React, { useCallback, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAssistantController, useCTAEligibility, type Surface } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

// v2 components
import { AssistantInput } from "./AssistantInput"
import { AnswerSection } from "./AnswerSection"
import { EvidencePanel } from "./EvidencePanel"
import { ClientDataPanel } from "./ClientDataPanel"
import { CTABlock } from "./CTABlock"
import { EmptyState } from "./EmptyState"
import { SuggestionChips } from "./SuggestionChips"

// Default suggestions per surface
const SUGGESTIONS: Record<Surface, string[]> = {
  MARKETING: [
    "Koja je stopa PDV-a u Hrvatskoj?",
    "Koji je prag za paušalni obrt?",
    "Kada moram u sustav PDV-a?",
    "Kako fiskalizirati račun?",
  ],
  APP: [
    "Koliko mi preostaje do praga?",
    "Koje su moje obveze ovaj mjesec?",
    "Trebam li se registrirati za PDV?",
    "Izračunaj moje doprinose",
  ],
}

interface AssistantContainerProps {
  surface: Surface
  companyId?: string
  className?: string
}

/**
 * AssistantContainer - Main container for the two-surface assistant
 *
 * MARKETING surface:
 * - Public, no auth required
 * - Shows CTAs for signup
 * - No ClientDataPanel (placeholder only)
 * - Never shows actual client data
 *
 * APP surface:
 * - Authenticated users only
 * - Shows ClientDataPanel with real data
 * - No signup CTAs
 * - Personalized answers when companyId provided
 */
export function AssistantContainer({ surface, companyId, className }: AssistantContainerProps) {
  const router = useRouter()
  const { state, submit } = useAssistantController({ surface, companyId })
  const [ctaDismissed, setCtaDismissed] = useState(false)

  // CTA eligibility for MARKETING surface
  const { isEligible: ctaEligible, ctaType, recordAnswer } = useCTAEligibility({ surface })

  // Record answers for CTA tracking
  useEffect(() => {
    if (state.activeAnswer && state.activeQuery) {
      recordAnswer(state.activeAnswer, state.activeQuery)
    }
  }, [state.activeAnswer, state.activeQuery, recordAnswer])

  const isApp = surface === "APP"
  const isMarketing = surface === "MARKETING"
  const isLoading = state.status === "LOADING" || state.status === "STREAMING"
  const isIdle = state.status === "IDLE"
  const hasAnswer = state.status === "COMPLETE" || state.status === "PARTIAL_COMPLETE"
  const hasError = state.status === "ERROR"

  // Handle submit from input
  const handleSubmit = useCallback(
    async (query: string) => {
      await submit(query)
    },
    [submit]
  )

  // Handle CTA action (navigate to signup)
  const handleCTAAction = useCallback(() => {
    router.push("/register")
  }, [router])

  // Handle CTA dismiss
  const handleCTADismiss = useCallback(() => {
    setCtaDismissed(true)
  }, [])

  // Handle connect data action
  const handleConnectData = useCallback(() => {
    // In APP surface, this would navigate to data connection page
    // In MARKETING surface, this triggers signup
    if (isApp) {
      router.push("/dashboard/settings/data")
    } else {
      router.push("/register")
    }
  }, [isApp, router])

  // Show CTA only on MARKETING surface, when eligible, and not dismissed
  const showCTA = isMarketing && ctaEligible && ctaType && !ctaDismissed && hasAnswer

  return (
    <section
      role="region"
      aria-label="Regulatory assistant"
      aria-busy={isLoading}
      className={cn("flex flex-col gap-6", className)}
    >
      {/* Input Section */}
      <AssistantInput surface={surface} onSubmit={handleSubmit} disabled={isLoading} />

      {/* Suggestion Chips (only when idle) */}
      {isIdle && <SuggestionChips suggestions={SUGGESTIONS[surface]} onSelect={handleSubmit} />}

      {/* Main Content Grid */}
      <div className={cn("grid gap-6", isApp ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        {/* Answer Column */}
        <div data-testid="answer-column" className="lg:col-span-1">
          <AnswerSection state={state} surface={surface} onSuggestionClick={handleSubmit} />
        </div>

        {/* Evidence Column */}
        <div data-testid="evidence-column" className="lg:col-span-1">
          {isIdle ? (
            <EmptyState type="evidence" surface={surface} />
          ) : (
            <EvidencePanel citations={state.activeAnswer?.citations} status={state.status} />
          )}
        </div>

        {/* Client Data Column (APP only) */}
        {isApp && (
          <div data-testid="client-data-column" className="lg:col-span-1">
            {isIdle ? (
              <EmptyState type="clientData" surface={surface} />
            ) : (
              <ClientDataPanel
                clientContext={state.activeAnswer?.clientContext}
                status={state.status}
                onConnectData={handleConnectData}
              />
            )}
          </div>
        )}

        {/* MARKETING: Personalization Preview Placeholder - only for successful answers */}
        {isMarketing && hasAnswer && state.activeAnswer?.kind === "ANSWER" && (
          <div
            data-testid="personalization-preview"
            className="lg:col-span-2 p-4 border border-dashed rounded-lg bg-primary/5"
          >
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Your calculation preview:</strong> Connect your
              business data to see personalized thresholds and amounts.
            </p>
          </div>
        )}
      </div>

      {/* CTA Block (MARKETING only, when eligible) */}
      {showCTA && ctaType && (
        <CTABlock
          variant={ctaType}
          topic={state.activeAnswer?.topic || "REGULATORY"}
          onAction={handleCTAAction}
          onDismiss={handleCTADismiss}
        />
      )}
    </section>
  )
}
