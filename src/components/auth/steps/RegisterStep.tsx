// src/components/auth/steps/RegisterStep.tsx
"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { AnimatedButton } from "../AnimatedButton"
import { cn } from "@/lib/utils"

interface RegisterStepProps {
  email: string
  onSubmit: (name: string, password: string) => Promise<void>
  onBack: () => void
  isLoading: boolean
  error: string | null
}

export function RegisterStep({ email, onSubmit, onBack, isLoading, error }: RegisterStepProps) {
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState({ password: false, confirm: false })

  const passwordValid = password.length >= 8
  const passwordsMatch = password === confirmPassword
  const canSubmit = name && passwordValid && passwordsMatch && acceptTerms

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (canSubmit) {
      await onSubmit(name, password)
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-5"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Kreirajte račun</h1>
        <motion.button
          type="button"
          onClick={onBack}
          layoutId="email-field"
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 hover:bg-gray-200"
        >
          {email}
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </motion.button>
      </div>

      <div className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ime i prezime"
          autoComplete="name"
          autoFocus
          className="w-full h-12 px-4 text-base rounded-xl border-2 border-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
        />

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            placeholder="Lozinka (min. 8 znakova)"
            autoComplete="new-password"
            className={cn(
              "w-full h-12 px-4 pr-12 text-base rounded-xl border-2 transition-all",
              "focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500",
              touched.password && !passwordValid ? "border-red-500" : "border-gray-200",
              touched.password && passwordValid && "border-green-500"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
          placeholder="Potvrdi lozinku"
          autoComplete="new-password"
          className={cn(
            "w-full h-12 px-4 text-base rounded-xl border-2 transition-all",
            "focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500",
            touched.confirm && !passwordsMatch ? "border-red-500" : "border-gray-200",
            touched.confirm && passwordsMatch && confirmPassword && "border-green-500"
          )}
        />

        {touched.confirm && confirmPassword && !passwordsMatch && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-500"
          >
            Lozinke se ne podudaraju
          </motion.p>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
        />
        <span className="text-sm text-gray-600">
          Prihvaćam{" "}
          <a href="/terms" className="text-cyan-600 hover:underline" target="_blank">
            Uvjete korištenja
          </a>{" "}
          i{" "}
          <a href="/privacy" className="text-cyan-600 hover:underline" target="_blank">
            Politiku privatnosti
          </a>
        </span>
      </label>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-500"
        >
          {error}
        </motion.p>
      )}

      <AnimatedButton
        type="submit"
        state={isLoading ? "loading" : "idle"}
        disabled={!canSubmit}
      >
        Kreiraj račun
      </AnimatedButton>
    </motion.form>
  )
}
