"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { BuyerStep, ItemsStep, ReviewStep } from "./steps"
import type { EInvoiceLineInput } from "@fiskai/shared"

const TOTAL_STEPS = 3

const STEP_LABELS = ["Kupac", "Stavke", "Pregled"]

interface EInvoiceWizardProps {
  companyId: string
}

interface WizardData {
  // Step 1: Buyer
  buyerId: string | null
  issueDate: string
  dueDate: string
  buyerReference: string
  // Step 2: Items
  lines: EInvoiceLineInput[]
  // Step 3: Notes
  notes: string
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const getDefaultData = (): WizardData => {
  const today = new Date()
  const dueDate = new Date(today)
  dueDate.setDate(dueDate.getDate() + 15)

  return {
    buyerId: null,
    issueDate: formatDateForInput(today),
    dueDate: formatDateForInput(dueDate),
    buyerReference: "",
    lines: [],
    notes: "",
  }
}

function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number
  totalSteps: number
}) {
  return (
    <div className="mb-8 w-full">
      <div className="flex items-center justify-center">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
          const isCompleted = step < currentStep
          const isCurrent = step === currentStep
          const isFuture = step > currentStep

          return (
            <div key={step} className="flex items-center">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                {isCompleted && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                )}

                {isCurrent && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500 ring-4 ring-cyan-500/30">
                    <span className="font-bold text-white">{step}</span>
                  </div>
                )}

                {isFuture && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                    <span className="text-white/40">{step}</span>
                  </div>
                )}

                {/* Step label */}
                <span
                  className={cn(
                    "mt-2 text-xs font-medium sm:text-sm",
                    "hidden sm:block",
                    isCompleted && "text-green-400",
                    isCurrent && "text-cyan-400",
                    isFuture && "text-white/40"
                  )}
                >
                  {STEP_LABELS[step - 1]}
                </span>
              </div>

              {/* Connector line */}
              {step < totalSteps && (
                <div
                  className={cn(
                    "mx-2 h-0.5 w-8 sm:mx-4 sm:w-12",
                    step < currentStep ? "bg-green-500" : "bg-white/20"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile step label (shown only on small screens) */}
      <div className="mt-4 text-center sm:hidden">
        <span className="text-sm font-medium text-cyan-400">
          {STEP_LABELS[currentStep - 1]}
        </span>
        <span className="ml-2 text-sm text-white/40">
          ({currentStep}/{totalSteps})
        </span>
      </div>
    </div>
  )
}

export function EInvoiceWizard({ companyId }: EInvoiceWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<WizardData>(getDefaultData)

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS))
  }, [])

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }, [])

  const handleBuyerDataChange = useCallback(
    (updates: Partial<Pick<WizardData, "buyerId" | "issueDate" | "dueDate" | "buyerReference">>) => {
      setData((prev) => ({ ...prev, ...updates }))
    },
    []
  )

  const handleLinesChange = useCallback((lines: EInvoiceLineInput[]) => {
    setData((prev) => ({ ...prev, lines }))
  }, [])

  const handleSubmit = useCallback(() => {
    // TODO: Submit invoice via tRPC
    console.log("Submitting invoice:", data)
  }, [data])

  return (
    <div className="mx-auto w-full max-w-2xl">
      <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep === 1 && (
            <BuyerStep
              companyId={companyId}
              data={{
                buyerId: data.buyerId,
                issueDate: data.issueDate,
                dueDate: data.dueDate,
                buyerReference: data.buyerReference,
              }}
              onDataChange={handleBuyerDataChange}
              onNext={handleNext}
            />
          )}
          {currentStep === 2 && (
            <ItemsStep
              companyId={companyId}
              lines={data.lines}
              onLinesChange={handleLinesChange}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {currentStep === 3 && (
            <ReviewStep onSubmit={handleSubmit} onBack={handleBack} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default EInvoiceWizard
