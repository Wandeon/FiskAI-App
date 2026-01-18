"use client"

import { useState, useCallback } from "react"
import { Check, AlertTriangle, FileText, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { DocumentUpload } from "./DocumentUpload"
import { StepIndicator } from "./StepIndicator"
import { validateOib } from "@/lib/validations/oib"

/**
 * Data source for tracking provenance
 */
type DataSource = "manual" | "document"

/**
 * Parsed data from document or manual entry
 */
export interface Step1FormData {
  oib: string
  companyName: string
  address: string
  foundingDate: string
}

/**
 * Field with source tracking
 */
interface FieldWithSource<T> {
  value: T
  source: DataSource
}

interface OnboardingStep1IdentityProps {
  initialData?: Partial<Step1FormData>
  onNext: (data: Step1FormData) => void
  onBack?: () => void
  isFirstStep?: boolean
}

/**
 * Step 1: Identity - Proof + Parsing + Confirm
 *
 * Two modes:
 * 1. Document Upload - User uploads Obrtnica, system parses data (placeholder)
 * 2. Manual Entry - User types data directly
 */
export function OnboardingStep1Identity({
  initialData,
  onNext,
  onBack,
  isFirstStep = true,
}: OnboardingStep1IdentityProps) {
  // Mode: 'upload' | 'manual' | 'parsed'
  const [mode, setMode] = useState<"upload" | "manual" | "parsed">("upload")

  // Selected document
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Form data with source tracking
  const [oib, setOib] = useState<FieldWithSource<string>>({
    value: initialData?.oib || "",
    source: "manual",
  })
  const [companyName, setCompanyName] = useState<FieldWithSource<string>>({
    value: initialData?.companyName || "",
    source: "manual",
  })
  const [address, setAddress] = useState<FieldWithSource<string>>({
    value: initialData?.address || "",
    source: "manual",
  })
  const [foundingDate, setFoundingDate] = useState<FieldWithSource<string>>({
    value: initialData?.foundingDate || "",
    source: "manual",
  })

  // Validation state
  const [oibValidation, setOibValidation] = useState<{
    isValid: boolean
    message: string
  } | null>(null)

  // Validate OIB on change
  const handleOibChange = useCallback((value: string) => {
    const cleanValue = value.replace(/\D/g, "").slice(0, 11)
    setOib({ value: cleanValue, source: "manual" })

    if (cleanValue.length === 0) {
      setOibValidation(null)
    } else if (cleanValue.length < 11) {
      setOibValidation({
        isValid: false,
        message: `OIB mora imati 11 znamenki (${cleanValue.length}/11)`,
      })
    } else if (!validateOib(cleanValue)) {
      setOibValidation({
        isValid: false,
        message: "Neispravan OIB - kontrolna znamenka ne odgovara",
      })
    } else {
      setOibValidation({
        isValid: true,
        message: "Checksum OK",
      })
    }
  }, [])

  // Handle file selection (placeholder - triggers manual entry after delay)
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file)
    setIsProcessing(true)

    // Simulate document parsing (placeholder)
    // In the future, this will call an OCR API
    setTimeout(() => {
      setIsProcessing(false)
      // For now, prompt user to enter manually
      // In future: setMode("parsed") with extracted data
      setMode("manual")
    }, 2000)
  }, [])

  // Handle file clear
  const handleFileClear = useCallback(() => {
    setSelectedFile(null)
    setMode("upload")
  }, [])

  // Handle document change (reset to upload mode)
  const handleChangeDocument = useCallback(() => {
    setSelectedFile(null)
    setMode("upload")
    // Reset source tracking
    setOib((prev) => ({ ...prev, source: "manual" }))
    setCompanyName((prev) => ({ ...prev, source: "manual" }))
    setAddress((prev) => ({ ...prev, source: "manual" }))
    setFoundingDate((prev) => ({ ...prev, source: "manual" }))
  }, [])

  // Check if form is valid
  const isFormValid =
    oib.value.length === 11 &&
    validateOib(oib.value) &&
    companyName.value.trim().length > 0 &&
    address.value.trim().length > 0 &&
    foundingDate.value.trim().length > 0

  // Handle form submission
  const handleSubmit = useCallback(() => {
    if (!isFormValid) return

    onNext({
      oib: oib.value,
      companyName: companyName.value,
      address: address.value,
      foundingDate: foundingDate.value,
    })
  }, [isFormValid, oib.value, companyName.value, address.value, foundingDate.value, onNext])

  // Render source badge
  const renderSourceBadge = (source: DataSource) => {
    if (source === "document") {
      return (
        <span className="text-body-xs text-success-text flex items-center gap-1">
          <FileText className="h-3 w-3" />
          Izvor: dokument
        </span>
      )
    }
    return null
  }

  // Render OIB validation status
  const renderOibStatus = () => {
    if (!oibValidation) return null

    if (oibValidation.isValid) {
      return (
        <span className="text-body-xs text-success-text flex items-center gap-1">
          <Check className="h-3 w-3" />
          {oibValidation.message}
        </span>
      )
    }

    return (
      <span className="text-body-xs text-warning-text flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        {oibValidation.message}
      </span>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <StepIndicator currentStep={1} completedSteps={[]} />

      {/* Document upload section (only in upload mode) */}
      {mode === "upload" && (
        <>
          <DocumentUpload
            onFileSelect={handleFileSelect}
            onFileClear={handleFileClear}
            selectedFile={selectedFile}
            isProcessing={isProcessing}
            processingMessage="Prepoznajem podatke iz dokumenta..."
            className="mb-6"
          />

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface px-4 text-body-sm text-muted">ili unesite ručno</span>
            </div>
          </div>
        </>
      )}

      {/* Parsed data header (only in parsed mode) */}
      {mode === "parsed" && selectedFile && (
        <Card padding="sm" className="mb-6 bg-success-bg border-success">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-success" />
              <span className="text-body-base font-medium text-success-text">
                Podaci prepoznati
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-body-sm text-secondary">Izvor: {selectedFile.name}</span>
              <Button type="button" variant="ghost" size="sm" onClick={handleChangeDocument}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Promijeni dokument
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Form fields */}
      <div className="space-y-6">
        {/* OIB Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="oib" className="text-body-sm font-medium text-foreground">
              OIB *
            </label>
            {mode === "parsed" && renderSourceBadge(oib.source)}
          </div>
          <div className="flex items-center gap-3">
            <Input
              id="oib"
              type="text"
              inputMode="numeric"
              value={oib.value}
              onChange={(e) => handleOibChange(e.target.value)}
              placeholder="12345678901"
              maxLength={11}
              className="w-40"
              error={oibValidation && !oibValidation.isValid ? true : undefined}
              aria-describedby="oib-status"
            />
            <div id="oib-status">{renderOibStatus()}</div>
          </div>
          <p className="mt-1 text-body-xs text-muted">Osobni identifikacijski broj (11 znamenki)</p>
        </div>

        {/* Company Name Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="companyName" className="text-body-sm font-medium text-foreground">
              Naziv obrta *
            </label>
            {mode === "parsed" && renderSourceBadge(companyName.source)}
          </div>
          <Input
            id="companyName"
            type="text"
            value={companyName.value}
            onChange={(e) => setCompanyName({ value: e.target.value, source: "manual" })}
            placeholder="Obrt za IT usluge"
            className="max-w-md"
          />
        </div>

        {/* Founding Date and Address - side by side on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Founding Date */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="foundingDate" className="text-body-sm font-medium text-foreground">
                Datum osnivanja *
              </label>
              {mode === "parsed" && renderSourceBadge(foundingDate.source)}
            </div>
            <Input
              id="foundingDate"
              type="text"
              value={foundingDate.value}
              onChange={(e) => setFoundingDate({ value: e.target.value, source: "manual" })}
              placeholder="DD.MM.YYYY"
              className="w-32"
            />
          </div>

          {/* Address */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="address" className="text-body-sm font-medium text-foreground">
                Adresa *
              </label>
              {mode === "parsed" && renderSourceBadge(address.source)}
            </div>
            <Input
              id="address"
              type="text"
              value={address.value}
              onChange={(e) => setAddress({ value: e.target.value, source: "manual" })}
              placeholder="Ilica 1, 10000 Zagreb"
              className="w-full"
            />
          </div>
        </div>

        {/* Confirmation warning (only in parsed mode) */}
        {mode === "parsed" && (
          <div className="flex items-start gap-2 p-4 rounded-lg bg-warning-bg border border-warning">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-body-sm text-warning-text">Provjerite i potvrdite podatke</p>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-8">
        <Button type="button" variant="outline" onClick={onBack} disabled={isFirstStep}>
          Natrag
        </Button>
        <Button type="button" variant="primary" onClick={handleSubmit} disabled={!isFormValid}>
          {mode === "parsed" ? "Potvrđujem, dalje →" : "Dalje →"}
        </Button>
      </div>
    </div>
  )
}
