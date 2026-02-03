"use client"

import { useCallback, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, Check, AlertCircle, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { validateOib } from "@fiskai/shared"

export interface OibLookupData {
  name?: string
  address?: string
  city?: string
  postalCode?: string
  vatNumber?: string
  source?: string
}

interface OibInputProps {
  value: string
  onChange: (value: string) => void
  onLookupSuccess?: (data: OibLookupData) => void
  disabled?: boolean
  error?: string
  className?: string
}

type LookupState = "idle" | "loading" | "success" | "error"

export function OibInput({
  value,
  onChange,
  onLookupSuccess,
  disabled = false,
  error,
  className,
}: OibInputProps) {
  const [lookupState, setLookupState] = useState<LookupState>("idle")
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const lastLookupValue = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isValid = value.length === 11 && validateOib(value)
  const showValidationError = value.length === 11 && !validateOib(value)

  // Perform OIB lookup
  const performLookup = useCallback(async (oib: string) => {
    if (!validateOib(oib)) return
    if (lastLookupValue.current === oib) return

    lastLookupValue.current = oib
    setLookupState("loading")
    setLookupError(null)

    try {
      const response = await fetch("/api/oib/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oib }),
      })

      const result = await response.json()

      if (result.success) {
        setLookupState("success")
        onLookupSuccess?.({
          name: result.name,
          address: result.address,
          city: result.city,
          postalCode: result.postalCode,
          vatNumber: result.vatNumber,
          source: result.source,
        })
      } else {
        setLookupState("error")
        setLookupError(result.error || "Podaci nisu pronađeni")
      }
    } catch {
      setLookupState("error")
      setLookupError("Greška pri pretrazi")
    }
  }, [onLookupSuccess])

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, "").slice(0, 11)
    onChange(newValue)

    // Reset states when value changes
    if (newValue !== value) {
      setLookupState("idle")
      setLookupError(null)
      setValidationError(null)
    }

    // Validate when 11 digits entered
    if (newValue.length === 11) {
      if (!validateOib(newValue)) {
        setValidationError("Neispravan OIB - kontrolna znamenka ne odgovara")
      } else {
        setValidationError(null)
        // Auto-lookup when valid
        performLookup(newValue)
      }
    }
  }, [onChange, value, performLookup])

  // Handle manual lookup button click
  const handleManualLookup = useCallback(() => {
    if (isValid && !disabled) {
      lastLookupValue.current = null // Force re-lookup
      performLookup(value)
    }
  }, [isValid, disabled, value, performLookup])

  // Determine border color based on state
  const getBorderClass = () => {
    if (error || validationError || showValidationError) return "border-red-400"
    if (lookupState === "success") return "border-green-400"
    if (lookupState === "loading") return "border-cyan-400"
    if (lookupState === "error") return "border-amber-400"
    return "border-white/20"
  }

  // Render status icon
  const renderStatusIcon = () => {
    if (lookupState === "loading") {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
        </motion.div>
      )
    }

    if (lookupState === "success") {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          <Check className="h-5 w-5 text-green-400" />
        </motion.div>
      )
    }

    if (lookupState === "error" || validationError || showValidationError) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
        >
          <AlertCircle className="h-5 w-5 text-amber-400" />
        </motion.div>
      )
    }

    return null
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-2">
        {/* Input field */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={handleChange}
            disabled={disabled}
            placeholder="Unesite OIB (11 znamenki)"
            className={cn(
              "w-full rounded-xl border bg-white/10 px-4 py-3 pr-12 text-white backdrop-blur-sm transition-all",
              "placeholder:text-white/40",
              "focus:outline-none focus:ring-2 focus:ring-cyan-400/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
              getBorderClass()
            )}
            aria-label="OIB"
            aria-invalid={!!(error || validationError || showValidationError)}
            aria-describedby={
              error || validationError || lookupError ? "oib-error" : undefined
            }
          />

          {/* Status icon inside input */}
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
            <AnimatePresence mode="wait">
              {renderStatusIcon()}
            </AnimatePresence>
          </div>
        </div>

        {/* Manual lookup button */}
        <motion.button
          type="button"
          onClick={handleManualLookup}
          disabled={!isValid || disabled || lookupState === "loading"}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-3 font-medium transition-all",
            "bg-white/10 backdrop-blur-sm",
            isValid && !disabled && lookupState !== "loading"
              ? "border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10"
              : "border-white/20 text-white/40 cursor-not-allowed"
          )}
          whileHover={isValid && !disabled ? { scale: 1.02 } : {}}
          whileTap={isValid && !disabled ? { scale: 0.98 } : {}}
        >
          {lookupState === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Traži</span>
        </motion.button>
      </div>

      {/* Error/Success messages */}
      <AnimatePresence mode="wait">
        {(error || validationError || lookupError || lookupState === "success") && (
          <motion.div
            id="oib-error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2"
          >
            {/* External error prop */}
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            {/* Validation error */}
            {!error && validationError && (
              <p className="text-sm text-red-400">{validationError}</p>
            )}

            {/* Checksum validation error */}
            {!error && !validationError && showValidationError && (
              <p className="text-sm text-red-400">
                Neispravan OIB - kontrolna znamenka ne odgovara
              </p>
            )}

            {/* Lookup error with manual entry hint */}
            {!error && !validationError && lookupError && (
              <p className="text-sm text-amber-400">
                {lookupError} - unesite podatke ručno
              </p>
            )}

            {/* Success message */}
            {lookupState === "success" && !error && !validationError && !lookupError && (
              <p className="text-sm text-green-400">
                Podaci pronađeni i automatski popunjeni
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default OibInput
