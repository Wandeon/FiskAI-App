"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { AnimatedButton } from "../AnimatedButton"
import { cn } from "@/lib/utils"

interface AuthenticateStepProps {
  email: string
  userName?: string
  hasPasskey: boolean
  onSubmit: (password: string) => Promise<void>
  onPasskeyAuth: () => void
  onForgotPassword: () => void
  onBack: () => void
  isLoading: boolean
  error: string | null
}

export function AuthenticateStep({
  email,
  userName,
  hasPasskey,
  onSubmit,
  onPasskeyAuth,
  onForgotPassword,
  onBack,
  isLoading,
  error,
}: AuthenticateStepProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password) {
      await onSubmit(password)
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
        <h1 className="text-2xl font-bold text-white">
          Dobrodošli natrag{userName ? `, ${userName.split(" ")[0]}` : ""}!
        </h1>
        <motion.button
          type="button"
          onClick={onBack}
          layoutId="email-field"
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface/10 px-3 py-1 text-sm text-white/80 hover:bg-surface/20"
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

      <div className="space-y-2">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Lozinka"
            autoComplete="current-password"
            autoFocus
            className={cn(
              "w-full h-12 px-4 pr-12 text-base rounded-xl border transition-all",
              "bg-surface/10 text-white placeholder:text-white/40 backdrop-blur-sm",
              "focus:outline-none focus:ring-2 focus:ring-accent-light/30 focus:border-accent-light",
              error ? "border-danger-border" : "border-white/20"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
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

      <AnimatedButton type="submit" state={isLoading ? "loading" : "idle"} disabled={!password}>
        Prijavi se
      </AnimatedButton>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-accent hover:text-cyan-300"
        >
          Zaboravljena lozinka?
        </button>

        {hasPasskey && (
          <button
            type="button"
            onClick={onPasskeyAuth}
            className="flex items-center gap-1 text-accent hover:text-cyan-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
              />
            </svg>
            Koristi passkey
          </button>
        )}
      </div>
    </motion.form>
  )
}
