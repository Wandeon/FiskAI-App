"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { OTPInput } from "../OTPInput"

interface VerifyStepProps {
  email: string
  onVerify: (code: string) => Promise<boolean>
  onResend: () => Promise<void>
  onBack: () => void
  isLoading: boolean
  error: string | null
}

export function VerifyStep({
  email,
  onVerify,
  onResend,
  onBack,
  isLoading,
  error,
}: VerifyStepProps) {
  const [otpError, setOtpError] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resending, setResending] = useState(false)

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [resendCooldown])

  // Reset OTP error when error prop changes
  useEffect(() => {
    if (error) {
      setOtpError(true)
      setTimeout(() => setOtpError(false), 300)
    }
  }, [error])

  const handleComplete = async (code: string) => {
    const success = await onVerify(code)
    if (!success) {
      setOtpError(true)
      setTimeout(() => setOtpError(false), 300)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return

    setResending(true)
    await onResend()
    setResending(false)
    setResendCooldown(60) // 60 second cooldown
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Unesite kod</h1>
        <p className="mt-2 text-white/70">Poslali smo 6-znamenkasti kod na</p>
        <motion.button
          type="button"
          onClick={onBack}
          className="mt-1 inline-flex items-center gap-1 text-accent hover:text-accent-light font-medium"
        >
          {email}
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </motion.button>
      </div>

      <OTPInput
        length={6}
        onComplete={handleComplete}
        error={otpError}
        disabled={isLoading}
        autoFocus
      />

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-sm text-danger-text"
        >
          {error}
        </motion.p>
      )}

      <div className="text-center">
        <p className="text-sm text-white/50">
          Niste primili kod?{" "}
          {resendCooldown > 0 ? (
            <span className="text-white/40">Pošalji ponovno za {resendCooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-accent hover:text-accent-light font-medium disabled:opacity-50"
            >
              {resending ? "Šaljem..." : "Pošalji ponovno"}
            </button>
          )}
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center">
          <motion.div
            className="h-8 w-8 border-2 border-accent-light/30 border-t-cyan-400 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          />
        </div>
      )}
    </motion.div>
  )
}
