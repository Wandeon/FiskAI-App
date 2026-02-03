"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { StepIndicator } from "./StepIndicator"
import { Step1Business, Step2Tax, Step3Contact, Step4Review } from "./steps"

const TOTAL_STEPS = 4

export function OnboardingWizard() {
  const { currentStep, setStep } = useOnboardingStore()

  const handleNext = () => setStep(Math.min(currentStep + 1, TOTAL_STEPS))
  const handleBack = () => setStep(Math.max(currentStep - 1, 1))

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
          {currentStep === 1 && <Step1Business onNext={handleNext} />}
          {currentStep === 2 && (
            <Step2Tax onNext={handleNext} onBack={handleBack} />
          )}
          {currentStep === 3 && (
            <Step3Contact onNext={handleNext} onBack={handleBack} />
          )}
          {currentStep === 4 && (
            <Step4Review onNext={handleNext} onBack={handleBack} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default OnboardingWizard
