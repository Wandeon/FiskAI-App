"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { OTPInput } from "../OTPInput"

interface ResetStepProps {
  email: string
  onSubmit: (code: string, newPassword: string) => Promise<boolean>
  onVerify: (code: string) => Promise<boolean>
  onResend: () => Promise<void>
  onBack: () => void
  isLoading: boolean
  error: string | null
}

export function ResetStep({ email, onSubmit, onResend, onBack, isLoading, error }: ResetStepProps) {
  const [step, setStep] = useState<"code" | "password">("code")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
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

  // Show OTP error animation
  useEffect(() => {
    if (error && step === "code") {
      setOtpError(true)
      setTimeout(() => setOtpError(false), 300)
    }
  }, [error, step])

  const handleCodeComplete = (enteredCode: string) => {
    setCode(enteredCode)
    setStep("password")
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return

    setResending(true)
    await onResend()
    setResending(false)
    setResendCooldown(60)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (password.length < 8) {
      setLocalError("Lozinka mora imati najmanje 8 znakova")
      return
    }

    if (password !== confirmPassword) {
      setLocalError("Lozinke se ne podudaraju")
      return
    }

    const success = await onSubmit(code, password)
    if (!success) {
      // If code was wrong, go back to code step
      if (error?.includes("kod")) {
        setStep("code")
        setCode("")
      }
    }
  }

  const displayError = localError || error

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Resetirajte lozinku</h1>
        <p className="mt-2 text-white/70">
          {step === "code" ? "Unesite kod koji smo vam poslali na" : "Unesite novu lozinku"}
        </p>
        {step === "code" && (
          <motion.button
            type="button"
            onClick={onBack}
            className="mt-1 inline-flex items-center gap-1 text-accent hover:text-cyan-300 font-medium"
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
        )}
      </div>

      {step === "code" ? (
        <>
          <OTPInput
            length={6}
            onComplete={handleCodeComplete}
            error={otpError}
            disabled={isLoading}
            autoFocus
          />

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
                  className="text-accent hover:text-cyan-300 font-medium disabled:opacity-50"
                >
                  {resending ? "Šaljem..." : "Pošalji ponovno"}
                </button>
              )}
            </p>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white/80 mb-1.5">
              Nova lozinka
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Najmanje 8 znakova"
                className="w-full rounded-xl border border-white/20 bg-surface/10 px-4 pr-12 py-3 text-white placeholder:text-white/40 focus:border-accent-light focus:outline-none focus:ring-1 focus:ring-accent-light/50 backdrop-blur-sm"
                disabled={isLoading}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-white/80 mb-1.5"
            >
              Potvrdite lozinku
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ponovite lozinku"
                className="w-full rounded-xl border border-white/20 bg-surface/10 px-4 pr-12 py-3 text-white placeholder:text-white/40 focus:border-accent-light focus:outline-none focus:ring-1 focus:ring-accent-light/50 backdrop-blur-sm"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
              >
                {showConfirmPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={isLoading || !password || !confirmPassword}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:shadow-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <motion.div
                className="mx-auto h-5 w-5 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
            ) : (
              "Spremi novu lozinku"
            )}
          </motion.button>

          <button
            type="button"
            onClick={() => {
              setStep("code")
              setCode("")
            }}
            className="w-full text-center text-sm text-white/60 hover:text-white/80"
          >
            Unesite drugi kod
          </button>
        </form>
      )}

      {displayError && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-sm text-danger-text"
        >
          {displayError}
        </motion.p>
      )}

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-sm text-white/60 hover:text-white/80"
      >
        Natrag na prijavu
      </button>
    </motion.div>
  )
}
