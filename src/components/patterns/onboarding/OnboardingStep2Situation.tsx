"use client"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { StepIndicator } from "./StepIndicator"
import { SituationQuestion, type SituationOption } from "./SituationQuestion"
import { tokenResolver } from "@/lib/services/token-resolver.service"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Expected income range values
 */
export type IncomeRange = "under30" | "30to60" | "60to100" | "over100"

/**
 * Form data for Step 2
 */
export interface Step2FormData {
  employedElsewhere: boolean | null
  acceptsCash: boolean | null
  isVatPayer: boolean | null
  expectedIncomeRange: IncomeRange | null
}

interface OnboardingStep2SituationProps {
  initialData?: Partial<Step2FormData>
  onNext: (data: Step2FormData) => void
  onBack: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Step 2: Situation - Determines Obligations
 *
 * This step asks 4 questions that determine the user's legal obligations:
 * 1. Employment status (determines contribution obligations)
 * 2. Cash/card acceptance (determines fiscalization obligation)
 * 3. VAT status (determines VAT filing obligations)
 * 4. Expected income (determines limit tracking urgency)
 */
export function OnboardingStep2Situation({
  initialData,
  onNext,
  onBack,
}: OnboardingStep2SituationProps) {
  // Form state
  const [employedElsewhere, setEmployedElsewhere] = useState<boolean | null>(
    initialData?.employedElsewhere ?? null
  )
  const [acceptsCash, setAcceptsCash] = useState<boolean | null>(initialData?.acceptsCash ?? null)
  const [isVatPayer, setIsVatPayer] = useState<boolean | null>(initialData?.isVatPayer ?? null)
  const [expectedIncomeRange, setExpectedIncomeRange] = useState<IncomeRange | null>(
    initialData?.expectedIncomeRange ?? null
  )

  // Token resolution context (no company yet during onboarding)
  const tokenContext = useMemo(
    () => ({
      year: new Date().getFullYear(),
      locale: "hr",
    }),
    []
  )

  // Resolve income range tokens
  const resolvedTokens = useMemo(() => {
    return {
      limit30Pct: tokenResolver.resolve("{{limit_30_pct}}", tokenContext),
      limit60Pct: tokenResolver.resolve("{{limit_60_pct}}", tokenContext),
      limit100Pct: tokenResolver.resolve("{{limit_100_pct}}", tokenContext),
      pausalLimit: tokenResolver.resolve("{{pausal_limit}}", tokenContext),
      currentYear: tokenResolver.resolve("{{current_year}}", tokenContext),
    }
  }, [tokenContext])

  // =============================================================================
  // QUESTION OPTIONS
  // =============================================================================

  // Employment question options
  const employmentOptions: SituationOption<boolean>[] = useMemo(
    () => [
      {
        value: true,
        icon: "\uD83D\uDC54", // Tie emoji
        label: "Da, zaposlen sam drugdje",
        consequences: [
          { text: "Doprinosi se plaćaju preko poslodavca", type: "arrow" },
          { text: "Iz obrta plaćate samo porez na dohodak", type: "arrow" },
        ],
      },
      {
        value: false,
        icon: "\uD83C\uDFE0", // House emoji
        label: "Ne, obrt mi je jedini posao",
        consequences: [
          { text: "OBVEZA: Plaćate doprinose (MIO + ZO)", type: "arrow" },
          { text: "FiskAI će vas podsjetiti na rokove", type: "arrow" },
        ],
      },
    ],
    []
  )

  // Cash acceptance question options
  const cashOptions: SituationOption<boolean>[] = useMemo(
    () => [
      {
        value: true,
        icon: "\uD83D\uDCB5", // Money emoji
        label: "Da, prihvaćam gotovinu/kartice",
        consequences: [
          { text: "OBVEZA: Fiskalizacija je obavezna", type: "arrow" },
          { text: "Trebat ćete certifikat (pomoći ćemo vam)", type: "arrow" },
        ],
      },
      {
        value: false,
        icon: "\uD83C\uDFE6", // Bank emoji
        label: "Ne, samo virman/transakcijski račun",
        consequences: [
          { text: "Fiskalizacija nije potrebna", type: "arrow" },
          { text: "Jednostavniji računi", type: "arrow" },
        ],
      },
    ],
    []
  )

  // VAT question options
  const vatOptions: SituationOption<boolean>[] = useMemo(
    () => [
      {
        value: false,
        label: "Ne, nisam u sustavu PDV-a",
        consequences: [
          { text: "Jednostavniji računi", type: "check" },
          { text: "Manje administracije", type: "check" },
          { text: "Ne možete odbiti PDV na troškove", type: "cross" },
        ],
      },
      {
        value: true,
        label: "Da, u sustavu sam PDV-a",
        consequences: [
          { text: "Možete odbiti PDV na troškove", type: "check" },
          { text: "OBVEZA: Kvartalne PDV prijave", type: "arrow" },
          { text: "+25% na cijene za privatne osobe", type: "cross" },
        ],
      },
    ],
    []
  )

  // Income range question options
  const incomeOptions: SituationOption<IncomeRange>[] = useMemo(
    () => [
      {
        value: "under30",
        label: `Do 30% limita (~${resolvedTokens.limit30Pct})`,
        consequences: [{ text: "Opušteno - daleko od limita", type: "check" }],
      },
      {
        value: "30to60",
        label: `30-60% limita (~${resolvedTokens.limit30Pct} - ${resolvedTokens.limit60Pct})`,
        consequences: [{ text: "Solidno - pratite prihode", type: "check" }],
      },
      {
        value: "60to100",
        label: `60-100% limita (~${resolvedTokens.limit60Pct} - ${resolvedTokens.limit100Pct})`,
        consequences: [{ text: "Aktivna upozorenja na približavanje", type: "arrow" }],
      },
      {
        value: "over100",
        label: `Više od limita (>${resolvedTokens.limit100Pct})`,
        consequences: [{ text: "Prelazak na vođenje knjiga - kontaktirajte nas", type: "arrow" }],
      },
    ],
    [resolvedTokens]
  )

  // =============================================================================
  // VALIDATION & SUBMISSION
  // =============================================================================

  // Check if form is valid (all questions answered)
  const isFormValid =
    employedElsewhere !== null &&
    acceptsCash !== null &&
    isVatPayer !== null &&
    expectedIncomeRange !== null

  // Handle form submission
  const handleSubmit = useCallback(() => {
    if (!isFormValid) return

    onNext({
      employedElsewhere: employedElsewhere!,
      acceptsCash: acceptsCash!,
      isVatPayer: isVatPayer!,
      expectedIncomeRange: expectedIncomeRange!,
    })
  }, [isFormValid, employedElsewhere, acceptsCash, isVatPayer, expectedIncomeRange, onNext])

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <StepIndicator currentStep={2} completedSteps={[1]} />

      {/* Intro text */}
      <p className="text-body-base text-secondary mb-8">
        Ovi odgovori određuju vaše zakonske obveze.
      </p>

      {/* Questions */}
      <div className="space-y-8">
        {/* Question 1: Employment status */}
        <SituationQuestion<boolean>
          question="Jeste li zaposleni negdje drugdje?"
          options={employmentOptions}
          value={employedElsewhere}
          onChange={setEmployedElsewhere}
          infoLinkText="Više o doprinosima"
          infoLinkUrl="/vodici/doprinosi-pausalni-obrt"
        />

        <hr className="border-border" />

        {/* Question 2: Cash/card acceptance */}
        <SituationQuestion<boolean>
          question="Primate li gotovinu ili kartice od kupaca?"
          options={cashOptions}
          value={acceptsCash}
          onChange={setAcceptsCash}
          infoLinkText="Tko mora fiskalizirati?"
          infoLinkUrl="/vodici/fiskalizacija-obveznici"
        />

        <hr className="border-border" />

        {/* Question 3: VAT status */}
        <SituationQuestion<boolean>
          question="Jeste li u sustavu PDV-a?"
          options={vatOptions}
          value={isVatPayer}
          onChange={setIsVatPayer}
          compactMode={true}
          hint="Niste sigurni?"
          warning="Jednom u PDV-u, ostajete min. 3 godine."
          infoLinkText="PDV za paušalne - kada se isplati?"
          infoLinkUrl="/vodici/pdv-pausalni-obrt"
        />

        <hr className="border-border" />

        {/* Question 4: Expected income */}
        <SituationQuestion<IncomeRange>
          question="Očekivani godišnji prihod?"
          options={incomeOptions}
          value={expectedIncomeRange}
          onChange={setExpectedIncomeRange}
          compactMode={true}
          hint={`Paušalni limit ${resolvedTokens.currentYear}: ${resolvedTokens.pausalLimit}`}
          infoLinkText="Što kad premašim limit?"
          infoLinkUrl="/vodici/premasivanje-limita"
        />
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-8">
        <Button type="button" variant="outline" onClick={onBack}>
          Natrag
        </Button>
        <Button type="button" variant="primary" onClick={handleSubmit} disabled={!isFormValid}>
          Dalje &rarr;
        </Button>
      </div>
    </div>
  )
}
