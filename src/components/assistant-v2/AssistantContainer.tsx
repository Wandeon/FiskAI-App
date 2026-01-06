"use client"

import React, { useCallback, useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAssistantController, useCTAEligibility, type Surface } from "@/lib/assistant/client"
import { cn } from "@/lib/utils"

// v2 components
import { AssistantInput, type AssistantInputHandle } from "./AssistantInput"
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

export type AssistantVariant = "light" | "dark"

interface AssistantContainerProps {
  surface: Surface
  companyId?: string
  className?: string
  variant?: AssistantVariant
  /** Pre-fill and auto-submit this query on mount (e.g., from landing page) */
  initialQuery?: string
  /** Source tracking (e.g., "landing-mini") */
  source?: string
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
 *
 * Variant:
 * - "light" (default): Standard light theme
 * - "dark": Command center theme with glass-morphism
 */
export function AssistantContainer({
  surface,
  companyId,
  className,
  variant = "light",
  initialQuery,
  source,
}: AssistantContainerProps) {
  const router = useRouter()
  const { state, submit } = useAssistantController({ surface, companyId })
  const [ctaDismissed, setCtaDismissed] = useState(false)
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false)
  const inputRef = useRef<AssistantInputHandle>(null)

  // CTA eligibility for MARKETING surface
  const { isEligible: ctaEligible, ctaType, recordAnswer } = useCTAEligibility({ surface })

  // Auto-submit initial query from URL params (e.g., from landing mini assistant)
  useEffect(() => {
    if (initialQuery && !hasAutoSubmitted && state.status === "IDLE") {
      setHasAutoSubmitted(true)
      // Log source for analytics
      if (source) {
        console.log(`[Assistant] Query from source: ${source}`)
      }
      void submit(initialQuery)
    }
  }, [initialQuery, hasAutoSubmitted, state.status, submit, source])

  // Record answers for CTA tracking
  useEffect(() => {
    if (state.activeAnswer && state.activeQuery) {
      void recordAnswer(state.activeAnswer, state.activeQuery)
    }
  }, [state.activeAnswer, state.activeQuery, recordAnswer])

  const isApp = surface === "APP"
  const isMarketing = surface === "MARKETING"
  const isLoading = state.status === "LOADING" || state.status === "STREAMING"
  const isIdle = state.status === "IDLE"
  const hasAnswer = state.status === "COMPLETE" || state.status === "PARTIAL_COMPLETE"
  const isDark = variant === "dark"

  // Handle submit from input (async for AssistantInput)
  const handleSubmit = useCallback(
    async (query: string) => {
      await submit(query)
    },
    [submit]
  )

  // Wrapper for sync callbacks (SuggestionChips)
  const handleSuggestionSelect = useCallback(
    (query: string) => {
      void submit(query)
    },
    [submit]
  )

  // Handle fill-only from clarification chips (does NOT submit)
  const handleFillInput = useCallback((text: string) => {
    inputRef.current?.fill(text)
  }, [])

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
      <AssistantInput
        ref={inputRef}
        surface={surface}
        onSubmit={handleSubmit}
        disabled={isLoading}
        loading={isLoading}
        variant={variant}
      />

      {/* Suggestion Chips (only when idle) */}
      {isIdle && (
        <SuggestionChips
          suggestions={SUGGESTIONS[surface]}
          onSelect={handleSuggestionSelect}
          variant={variant}
        />
      )}

      {/* Main Content Grid */}
      <div className={cn("grid gap-6", isApp ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        {/* Answer Column */}
        <div data-testid="answer-column" className="lg:col-span-1">
          {/* Clarification chips fill the input only - no auto-submit */}
          <AnswerSection
            state={state}
            surface={surface}
            onSuggestionClick={handleFillInput}
            variant={variant}
          />
        </div>

        {/* Evidence Column */}
        <div data-testid="evidence-column" className="lg:col-span-1">
          {isIdle ? (
            <EmptyState type="evidence" surface={surface} variant={variant} />
          ) : (
            <EvidencePanel
              citations={state.activeAnswer?.citations}
              status={state.status}
              variant={variant}
            />
          )}
        </div>

        {/* Client Data Column (APP only) */}
        {isApp && (
          <div data-testid="client-data-column" className="lg:col-span-1">
            {isIdle ? (
              <EmptyState type="clientData" surface={surface} variant={variant} />
            ) : (
              <ClientDataPanel
                clientContext={state.activeAnswer?.clientContext}
                status={state.status}
                onConnectData={handleConnectData}
                variant={variant}
              />
            )}
          </div>
        )}

        {/* MARKETING: Personalization Preview Placeholder - only for successful answers */}
        {isMarketing && hasAnswer && state.activeAnswer?.kind === "ANSWER" && (
          <div
            data-testid="personalization-preview"
            className={cn(
              "lg:col-span-2 p-4 border border-dashed rounded-lg",
              isDark ? "bg-accent/5 border-accent/20 text-white/70" : "bg-primary/5 border-default"
            )}
          >
            <p className={cn("text-sm", isDark ? "text-secondary" : "text-muted-foreground")}>
              <strong className={isDark ? "text-white" : "text-foreground"}>
                Personalizirani izračun:
              </strong>{" "}
              Povežite svoje poslovne podatke za prilagođene pragove i iznose.
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
