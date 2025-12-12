"use client"

import { useState, useCallback, useEffect } from "react"
import { Input } from "./input"
import { Loader2, Check, AlertCircle, Search } from "lucide-react"
import { Button } from "./button"
import { cn } from "@/lib/utils"

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
  const [progress, setProgress] = useState<string | null>(null)
  const [lastLookupValue, setLastLookupValue] = useState<string | null>(null)

  const performLookup = useCallback(async (oib: string) => {
    setIsLookingUp(true)
    setLookupSuccess(false)
    setLookupError(null)
    setProgress("Provjeravam VIES…")

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
        setProgress("Pronađeno preko VIES/Sudskog registra")
        
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
        setProgress(null)
        
        if (onLookupError) {
          onLookupError(result.error || "Greška pri pretrazi")
        }
      }
    } catch {
      setLookupSuccess(false)
      setLookupError("Greška pri povezivanju s API-jem")
      setProgress(null)
      
      if (onLookupError) {
        onLookupError("Greška pri povezivanju s API-jem")
      }
    } finally {
      setIsLookingUp(false)
    }
  }, [onLookupSuccess, onLookupError])

  const handleLookup = () => {
    if (!/^\d{11}$/.test(value)) {
      setLookupError("OIB mora imati 11 znamenki")
      setLookupSuccess(false)
      return
    }
    setLastLookupValue(value)
    performLookup(value)
  }

  // Auto-fetch when 11 digits are present and we haven't already tried this value
  useEffect(() => {
    if (
      value &&
      value.length === 11 &&
      !isLookingUp &&
      value !== lastLookupValue &&
      /^\d{11}$/.test(value)
    ) {
      setLastLookupValue(value)
      performLookup(value)
    }
  }, [isLookingUp, lastLookupValue, performLookup, value])

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="12345678901"
            maxLength={11}
            disabled={disabled || isLookingUp}
            error={error || lookupError || undefined}
            className="pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isLookingUp && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
            {!isLookingUp && lookupSuccess && <Check className="h-4 w-4 text-green-500" />}
            {!isLookingUp && lookupError && <AlertCircle className="h-4 w-4 text-yellow-500" />}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleLookup}
          disabled={disabled || isLookingUp}
          className="shrink-0 h-10 min-h-0"
        >
          {isLookingUp ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Tražim...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Dohvati podatke
            </>
          )}
        </Button>
      </div>

      {progress && (
        <p className="text-xs text-blue-700">• {progress} (VIES → Sudski registar)</p>
      )}
      {lookupSuccess && !error && (
        <p className="text-xs text-green-600">Pronađeno! Podaci su automatski popunjeni.</p>
      )}
      {lookupError && !error && (
        <p className="text-xs text-yellow-600">{lookupError}</p>
      )}
    </div>
  )
}
