// src/components/auth/OTPInput.tsx
"use client"

import { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface OTPInputProps {
  length?: number
  onComplete: (code: string) => void
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
}

export function OTPInput({
  length = 6,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
}: OTPInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""))
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-focus first input
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [autoFocus])

  // Check for completion
  useEffect(() => {
    const code = values.join("")
    if (code.length === length && !values.includes("")) {
      onComplete(code)
    }
  }, [values, length, onComplete])

  // Clear on error
  useEffect(() => {
    if (error) {
      setValues(Array(length).fill(""))
      setActiveIndex(0)
      inputRefs.current[0]?.focus()
    }
  }, [error, length])

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1)

    const newValues = [...values]
    newValues[index] = digit
    setValues(newValues)

    // Auto-advance
    if (digit && index < length - 1) {
      setActiveIndex(index + 1)
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault()

      const newValues = [...values]

      if (values[index]) {
        // Clear current
        newValues[index] = ""
        setValues(newValues)
      } else if (index > 0) {
        // Move to previous
        newValues[index - 1] = ""
        setValues(newValues)
        setActiveIndex(index - 1)
        inputRefs.current[index - 1]?.focus()
      }
    }

    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault()
      setActiveIndex(index - 1)
      inputRefs.current[index - 1]?.focus()
    }

    if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault()
      setActiveIndex(index + 1)
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)

    if (pastedData.length === length) {
      const newValues = pastedData.split("")
      setValues(newValues)
      setActiveIndex(length - 1)
      inputRefs.current[length - 1]?.focus()
    }
  }

  const handleFocus = (index: number) => {
    setActiveIndex(index)
    // Select all text in the input
    inputRefs.current[index]?.select()
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      {Array.from({ length }, (_, index) => (
        <motion.div
          key={index}
          animate={
            error
              ? {
                  x: [0, -4, 4, -4, 4, 0],
                  transition: { duration: 0.3 },
                }
              : undefined
          }
        >
          <input
            ref={(el) => {
              inputRefs.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={values[index]}
            disabled={disabled}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => handleFocus(index)}
            className={cn(
              "h-14 w-11 sm:h-16 sm:w-14 rounded-xl border bg-white/10 backdrop-blur-sm text-center text-2xl font-bold text-white transition-all",
              "focus:outline-none focus:ring-0",
              activeIndex === index && !error
                ? "border-accent-light ring-2 ring-cyan-400/30 scale-105"
                : "border-white/20",
              error && "border-danger-border bg-danger/20",
              disabled && "cursor-not-allowed opacity-50"
            )}
            aria-label={`Digit ${index + 1} of ${length}`}
          />
        </motion.div>
      ))}
    </div>
  )
}

export default OTPInput
