"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "./input"
import { Loader2, Check, AlertCircle } from "lucide-react"

export interface OibLookupData {
  name?: string
  address?: string
  city?: string
  postalCode?: string
  vatNumber?: string
}

interface OibInputProps {
  value: string
  onChange: (value: string) => void
  onLookupSuccess?: (data: OibLookupData) => void
  onLookupError?: (error: string) => void
  disabled?: boolean
  error?: string
  className?: string
}

export function OibInput({
  value,
  onChange,
  onLookupSuccess,
  onLookupError,
  disabled = false,
  error,
  className,
}: OibInputProps) {
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [lookupSuccess, setLookupSuccess] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const performLookup = useCallback(async (oib: string) => {
    setIsLookingUp(true)
    setLookupSuccess(false)
    setLookupError(null)

    try {
      const response = await fetch("/api/oib/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ oib }),
      })

      const result = await response.json()

      if (result.success) {
        setLookupSuccess(true)
        setLookupError(null)
        
        if (onLookupSuccess) {
          onLookupSuccess({
            name: result.name,
            address: result.address,
            city: result.city,
            postalCode: result.postalCode,
            vatNumber: result.vatNumber,
          })
        }
      } else {
        setLookupSuccess(false)
        setLookupError(result.error || "Greška pri pretrazi")
        
        if (onLookupError) {
          onLookupError(result.error || "Greška pri pretrazi")
        }
      }
    } catch (_error) {
      setLookupSuccess(false)
      setLookupError("Greška pri povezivanju s API-jem")
      
      if (onLookupError) {
        onLookupError("Greška pri povezivanju s API-jem")
      }
    } finally {
      setIsLookingUp(false)
    }
  }, [onLookupSuccess, onLookupError])

  useEffect(() => {
    // Reset states when value changes
    setLookupSuccess(false)
    setLookupError(null)

    // Trigger lookup when 11 digits are entered
    if (value.length === 11 && /^\d{11}$/.test(value)) {
      performLookup(value)
    }
  }, [value, performLookup])

  return (
    <div className="relative">
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="12345678901"
        maxLength={11}
        disabled={disabled || isLookingUp}
        error={error || lookupError || undefined}
        className={className}
      />
      
      {/* Status indicator */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {isLookingUp && (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        )}
        {!isLookingUp && lookupSuccess && (
          <Check className="h-4 w-4 text-green-500" />
        )}
        {!isLookingUp && lookupError && (
          <AlertCircle className="h-4 w-4 text-yellow-500" />
        )}
      </div>
      
      {/* Help text */}
      {lookupSuccess && !error && (
        <p className="mt-1 text-xs text-green-600">
          Pronađeno! Podaci su automatski popunjeni.
        </p>
      )}
      {lookupError && !error && (
        <p className="mt-1 text-xs text-yellow-600">
          {lookupError}
        </p>
      )}
    </div>
  )
}
