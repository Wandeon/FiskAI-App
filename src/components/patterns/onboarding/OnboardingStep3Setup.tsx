"use client"

import { useState, useCallback, useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StepIndicator } from "./StepIndicator"
import { SetupChecklistItem, type ChecklistItemStatus } from "./SetupChecklistItem"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Fiscalization setup data
 */
interface FiscalizationData {
  status: ChecklistItemStatus
  hasCertificate?: boolean
}

/**
 * IBAN setup data
 */
interface IbanData {
  status: "pending" | "completed"
  value: string
}

/**
 * Logo setup data
 */
interface LogoData {
  status: "pending" | "in_progress" | "completed" | "skipped"
  file?: File
}

/**
 * Bank connection setup data
 */
interface BankConnectionData {
  status: "pending" | "in_progress" | "completed" | "skipped"
  connected: boolean
}

/**
 * Form data for Step 3
 */
export interface Step3FormData {
  fiscalization: FiscalizationData
  iban: IbanData
  logo: LogoData
  bankConnection: BankConnectionData
}

/**
 * Situation data from Step 2
 */
interface SituationData {
  acceptsCash: boolean
}

/**
 * Props for OnboardingStep3Setup component
 */
interface OnboardingStep3SetupProps {
  situation: SituationData
  initialData?: Partial<Step3FormData>
  onBack: () => void
  onComplete: (data: Step3FormData) => void
}

// =============================================================================
// IBAN VALIDATION
// =============================================================================

/**
 * Croatian IBAN format: HR + 2 check digits + 17 digits = 21 characters
 */
const IBAN_REGEX = /^HR\d{19}$/

/**
 * Format IBAN with spaces for display (e.g., HR12 1234 5678 9012 3456 7)
 */
function formatIban(value: string): string {
  // Remove all non-alphanumeric characters
  const cleaned = value.replace(/[^A-Z0-9]/gi, "").toUpperCase()

  // Group by 4 characters
  const groups = cleaned.match(/.{1,4}/g)
  return groups ? groups.join(" ") : cleaned
}

/**
 * Clean IBAN for storage (remove spaces)
 */
function cleanIban(value: string): string {
  return value.replace(/\s/g, "").toUpperCase()
}

/**
 * Validate Croatian IBAN
 */
function validateIban(value: string): { isValid: boolean; error?: string } {
  const cleaned = cleanIban(value)

  if (cleaned.length === 0) {
    return { isValid: false }
  }

  if (cleaned.length < 21) {
    return {
      isValid: false,
      error: `IBAN mora imati 21 znak (${cleaned.length}/21)`,
    }
  }

  if (cleaned.length > 21) {
    return {
      isValid: false,
      error: "IBAN ima previše znakova",
    }
  }

  if (!IBAN_REGEX.test(cleaned)) {
    return {
      isValid: false,
      error: "Neispravan format - hrvatski IBAN počinje s HR",
    }
  }

  return { isValid: true }
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Step 3: Setup Checklist (Obligations + Readiness)
 *
 * Dynamically generated based on Step 2 answers:
 * - Required items based on situation (e.g., fiscalization if accepts cash)
 * - Optional items (logo, bank connection)
 */
export function OnboardingStep3Setup({
  situation,
  initialData,
  onBack,
  onComplete,
}: OnboardingStep3SetupProps) {
  // ==========================================================================
  // STATE
  // ==========================================================================

  // Fiscalization state (only required if accepts cash)
  const [fiscalization, setFiscalization] = useState<FiscalizationData>(
    initialData?.fiscalization || { status: "pending" }
  )

  // IBAN state (always required)
  const [iban, setIban] = useState<IbanData>(initialData?.iban || { status: "pending", value: "" })
  const [ibanInput, setIbanInput] = useState(initialData?.iban?.value || "")

  // Logo state (optional)
  const [logo, setLogo] = useState<LogoData>(initialData?.logo || { status: "pending" })

  // Bank connection state (optional)
  const [bankConnection, setBankConnection] = useState<BankConnectionData>(
    initialData?.bankConnection || { status: "pending", connected: false }
  )

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  // IBAN validation
  const ibanValidation = useMemo(() => validateIban(ibanInput), [ibanInput])

  // Check if IBAN is valid for completion
  const isIbanValid = useMemo(() => {
    const cleaned = cleanIban(ibanInput)
    return cleaned.length === 21 && IBAN_REGEX.test(cleaned)
  }, [ibanInput])

  // Check if there are incomplete required items
  const hasIncompleteRequired = useMemo(() => {
    // IBAN is always required
    if (iban.status !== "completed") return true

    // Fiscalization is required only if accepts cash
    if (situation.acceptsCash && fiscalization.status === "pending") return true

    return false
  }, [iban.status, fiscalization.status, situation.acceptsCash])

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  // Handle IBAN input change
  const handleIbanChange = useCallback((value: string) => {
    // Format the input
    const formatted = formatIban(value)
    setIbanInput(formatted)

    // Auto-mark as completed when valid
    const cleaned = cleanIban(value)
    if (cleaned.length === 21 && IBAN_REGEX.test(cleaned)) {
      setIban({ status: "completed", value: formatted })
    } else {
      setIban((prev) => ({ ...prev, status: "pending" }))
    }
  }, [])

  // Handle "I have certificate" click
  const handleHaveCertificate = useCallback(() => {
    setFiscalization({ status: "in_progress", hasCertificate: true })
    // TODO: Navigate to certificate setup flow
    // For now, simulate completion
    setTimeout(() => {
      setFiscalization({ status: "completed", hasCertificate: true })
    }, 500)
  }, [])

  // Handle "Need help" click
  const handleNeedHelp = useCallback(() => {
    setFiscalization({ status: "in_progress", hasCertificate: false })
    // TODO: Navigate to help flow or contact form
  }, [])

  // Handle add logo
  const handleAddLogo = useCallback(() => {
    // TODO: Open file picker
    setLogo({ status: "in_progress" })
  }, [])

  // Handle connect bank
  const handleConnectBank = useCallback(() => {
    // TODO: Navigate to bank connection flow
    setBankConnection({ status: "in_progress", connected: false })
  }, [])

  // Handle form completion
  const handleComplete = useCallback(() => {
    onComplete({
      fiscalization,
      iban: {
        status: isIbanValid ? "completed" : "pending",
        value: cleanIban(ibanInput),
      },
      logo,
      bankConnection,
    })
  }, [onComplete, fiscalization, isIbanValid, ibanInput, logo, bankConnection])

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <StepIndicator currentStep={3} completedSteps={[1, 2]} />

      {/* Intro text */}
      <p className="text-body-base text-secondary mb-8">
        Na temelju vaših odgovora, ovo trebate postaviti:
      </p>

      {/* Required section */}
      <div className="mb-8">
        <h3 className="text-body-sm font-semibold text-foreground uppercase tracking-wide mb-4">
          OBAVEZNO
        </h3>

        <div className="space-y-4">
          {/* Fiscalization - only shown if accepts cash */}
          {situation.acceptsCash && (
            <SetupChecklistItem
              id="fiscalization"
              title="Fiskalizacija"
              description="Primate gotovinu, pa je fiskalizacija obavezna."
              required={true}
              status={fiscalization.status}
              requirements={[
                "Certifikat od FINA-e (ako nemate, pomažemo)",
                "Oznaku poslovnog prostora",
              ]}
              actions={
                fiscalization.status === "pending"
                  ? [
                      {
                        label: "Imam certifikat \u2192",
                        variant: "primary",
                        onClick: handleHaveCertificate,
                      },
                      {
                        label: "Trebam pomoć \u2192",
                        variant: "outline",
                        onClick: handleNeedHelp,
                      },
                    ]
                  : undefined
              }
              hint={
                fiscalization.status === "pending"
                  ? "Možete preskočiti i postaviti kasnije, ali gotovinski računi neće biti valjani."
                  : undefined
              }
            />
          )}

          {/* IBAN - always required */}
          <SetupChecklistItem
            id="iban"
            title="IBAN za primanje uplata"
            description="Prikazuje se na računima."
            required={true}
            status={iban.status}
            inputField={{
              type: "text",
              placeholder: "HR12 1234 5678 9012 3456 7",
              value: ibanInput,
              onChange: handleIbanChange,
              error:
                ibanInput.length > 0 && !ibanValidation.isValid ? ibanValidation.error : undefined,
            }}
          />
        </div>
      </div>

      {/* Divider */}
      <hr className="border-border mb-8" />

      {/* Optional section */}
      <div className="mb-8">
        <h3 className="text-body-sm font-semibold text-muted uppercase tracking-wide mb-4">
          OPCIONALNO (možete kasnije)
        </h3>

        <div className="space-y-4">
          {/* Logo upload */}
          <SetupChecklistItem
            id="logo"
            title="Logo tvrtke"
            description="Prikazuje se na računima"
            required={false}
            status={logo.status}
            actions={
              logo.status === "pending"
                ? [
                    {
                      label: "Dodaj logo",
                      variant: "outline",
                      onClick: handleAddLogo,
                    },
                  ]
                : undefined
            }
          />

          {/* Bank connection */}
          <SetupChecklistItem
            id="bank-connection"
            title="Povezi banku"
            description="Automatsko praćenje uplata"
            required={false}
            status={bankConnection.status}
            actions={
              bankConnection.status === "pending"
                ? [
                    {
                      label: "Povezi",
                      variant: "outline",
                      onClick: handleConnectBank,
                    },
                  ]
                : undefined
            }
          />
        </div>
      </div>

      {/* Incomplete required warning */}
      {hasIncompleteRequired && (
        <div className="mb-8 p-4 rounded-lg bg-warning-bg border border-warning">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-body-sm text-warning-text">
              Imate nepotpune obavezne postavke. Možete nastaviti, ali neke funkcije neće raditi
              ispravno.
            </p>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Natrag
        </Button>
        <Button type="button" variant="primary" onClick={handleComplete}>
          Završi i idi na dashboard &rarr;
        </Button>
      </div>
    </div>
  )
}
