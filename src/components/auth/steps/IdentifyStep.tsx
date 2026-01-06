"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { AnimatedButton } from "../AnimatedButton"
import { cn } from "@/lib/utils"

interface IdentifyStepProps {
  onSubmit: (email: string) => Promise<void>
  onGoogleSignIn: () => void
  isLoading: boolean
  error: string | null
}

export function IdentifyStep({ onSubmit, onGoogleSignIn, isLoading, error }: IdentifyStepProps) {
  const [email, setEmail] = useState("")
  const [touched, setTouched] = useState(false)

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const showError = touched && email && !isValidEmail

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isValidEmail) {
      await onSubmit(email)
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Dobrodošli u FiskAI</h1>
        <p className="mt-2 text-white/70">Unesite email za nastavak</p>
      </div>

      <div className="space-y-2">
        <motion.div layoutId="email-field">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="vas@email.com"
            autoComplete="email"
            autoFocus
            className={cn(
              "w-full h-12 px-4 text-base rounded-xl border transition-all",
              "bg-surface/10 text-white placeholder:text-white/40 backdrop-blur-sm",
              "focus:outline-none focus:ring-2 focus:ring-accent-light/30",
              showError ? "border-danger-border" : "border-white/20 focus:border-accent-light",
              isValidEmail && touched && "border-success-border"
            )}
          />
        </motion.div>

        {showError && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-danger-text"
          >
            Unesite valjanu email adresu
          </motion.p>
        )}

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-danger-text"
          >
            {error}
          </motion.p>
        )}
      </div>

      <AnimatedButton type="submit" state={isLoading ? "loading" : "idle"} disabled={!isValidEmail}>
        Nastavi
      </AnimatedButton>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-transparent px-4 text-white/50">ili</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onGoogleSignIn}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-surface/10 px-4 py-3 text-white transition-all hover:bg-surface/20 backdrop-blur-sm"
      >
{/* eslint-disable fisk-design-system/no-hardcoded-colors -- @design-override: Google brand logo uses mandatory brand colors per Google branding guidelines */}
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {/* eslint-enable fisk-design-system/no-hardcoded-colors */}
        Nastavi s Google računom
      </button>
    </motion.form>
  )
}
