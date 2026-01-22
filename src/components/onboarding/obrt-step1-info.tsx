"use client"

import { useState, useCallback } from "react"
import { Check, AlertTriangle, ArrowRight, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DocumentUpload } from "@/components/patterns/onboarding/DocumentUpload"
import { validateOib } from "@/lib/validations/oib"

/**
 * Data source for tracking provenance
 */
type DataSource = "manual" | "document"

/**
 * Form data for Obrt Step 1
 */
export interface ObrtStep1FormData {
  oib: string
  companyName: string
  address: string
  foundingDate: string
}

/**
 * Field with source tracking for audit purposes
 */
interface FieldWithSource<T> {
  value: T
  source: DataSource
}

interface ObrtStep1InfoProps {
  initialData?: Partial<ObrtStep1FormData>
  onNext: (data: ObrtStep1FormData) => void
  onBack?: () => void
  isSubmitting?: boolean
}

/**
 * Obrt Step 1: Document-First Info Collection
 *
 * This component implements the document-first approach:
 * 1. User can upload Obrtnica (business license) for OCR
 * 2. Manual fields are ALWAYS visible regardless of upload state
 * 3. OCR results are suggestions - user must confirm
 * 4. Document upload is optional - user can fill manually
 */
export function ObrtStep1Info({
  initialData,
  onNext,
  onBack,
  isSubmitting = false,
}: ObrtStep1InfoProps) {
  // Selected document
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrCompleted, setOcrCompleted] = useState(false)

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

  // Handle file selection - triggers OCR processing
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file)
    setIsProcessing(true)
    setOcrCompleted(false)

    // Simulate OCR processing (placeholder)
    // In production, this would call an OCR API
    // For now, we simulate the delay and show the form fields
    setTimeout(() => {
      setIsProcessing(false)
      // OCR didn't extract anything - user continues with manual entry
      // In future: populate fields from OCR results here
      // Example:
      // setOib({ value: ocrResult.oib, source: "document" })
      // setCompanyName({ value: ocrResult.name, source: "document" })
      setOcrCompleted(true)
    }, 2000)
  }, [])

  // Handle file clear
  const handleFileClear = useCallback(() => {
    setSelectedFile(null)
    setIsProcessing(false)
    setOcrCompleted(false)
  }, [])

  // Check if form is valid
  const isFormValid =
    oib.value.length === 11 &&
    validateOib(oib.value) &&
    companyName.value.trim().length > 0 &&
    address.value.trim().length > 0

  // Handle form submission
  const handleSubmit = useCallback(() => {
    if (!isFormValid || isSubmitting) return

    onNext({
      oib: oib.value,
      companyName: companyName.value,
      address: address.value,
      foundingDate: foundingDate.value,
    })
  }, [
    isFormValid,
    isSubmitting,
    oib.value,
    companyName.value,
    address.value,
    foundingDate.value,
    onNext,
  ])

  // Render OIB validation status
  const renderOibStatus = () => {
    if (!oibValidation) return null

    if (oibValidation.isValid) {
      return (
        <span className="text-body-xs text-success flex items-center gap-1">
          <Check className="h-3 w-3" />
          {oibValidation.message}
        </span>
      )
    }

    return (
      <span className="text-body-xs text-warning flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        {oibValidation.message}
      </span>
    )
  }

  // Render source badge for OCR-extracted fields
  const renderSourceBadge = (source: DataSource) => {
    if (source === "document") {
      return (
        <span className="text-body-xs text-success flex items-center gap-1 bg-success/10 px-2 py-0.5 rounded">
          Iz dokumenta
        </span>
      )
    }
    return null
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-2">Korak 1: Podaci o obrtu</h2>
        <p className="text-secondary">
          Učitajte Obrtnicu za automatsko prepoznavanje ili unesite podatke ručno
        </p>
      </div>

      {/* Document Upload Section */}
      <div className="mb-8">
        <DocumentUpload
          onFileSelect={handleFileSelect}
          onFileClear={handleFileClear}
          selectedFile={selectedFile}
          isProcessing={isProcessing}
          processingMessage="Prepoznajem podatke iz dokumenta..."
        />
      </div>

      {/* Divider */}
      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-surface px-4 text-body-sm text-muted">ili unesite ručno</span>
        </div>
      </div>

      {/* OCR completion notice */}
      {ocrCompleted && selectedFile && (
        <div className="mb-6 p-4 rounded-lg bg-info-bg border border-info">
          <p className="text-body-sm text-info-text">
            Dokument je učitan. Provjerite i dopunite podatke u nastavku.
          </p>
        </div>
      )}

      {/* Form Fields - ALWAYS VISIBLE */}
      <div className="space-y-6">
        {/* OIB Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="oib" className="text-body-sm font-medium text-foreground">
              OIB *
            </label>
            {renderSourceBadge(oib.source)}
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
              className="w-44"
              error={oibValidation && !oibValidation.isValid ? true : undefined}
              aria-describedby="oib-status"
              disabled={isProcessing}
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
            {renderSourceBadge(companyName.source)}
          </div>
          <Input
            id="companyName"
            type="text"
            value={companyName.value}
            onChange={(e) => setCompanyName({ value: e.target.value, source: "manual" })}
            placeholder="npr. Obrt za IT usluge Ivan Horvat"
            className="max-w-md"
            disabled={isProcessing}
          />
        </div>

        {/* Address Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="address" className="text-body-sm font-medium text-foreground">
              Adresa *
            </label>
            {renderSourceBadge(address.source)}
          </div>
          <Input
            id="address"
            type="text"
            value={address.value}
            onChange={(e) => setAddress({ value: e.target.value, source: "manual" })}
            placeholder="npr. Ilica 1, 10000 Zagreb"
            className="max-w-lg"
            disabled={isProcessing}
          />
        </div>

        {/* Founding Date Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="foundingDate" className="text-body-sm font-medium text-foreground">
              Datum osnivanja
            </label>
            {renderSourceBadge(foundingDate.source)}
          </div>
          <Input
            id="foundingDate"
            type="text"
            value={foundingDate.value}
            onChange={(e) => setFoundingDate({ value: e.target.value, source: "manual" })}
            placeholder="DD.MM.YYYY"
            className="w-36"
            disabled={isProcessing}
          />
          <p className="mt-1 text-body-xs text-muted">Opcionalno - datum iz Obrtnice</p>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-10">
        {onBack ? (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting || isProcessing}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Natrag
          </Button>
        ) : (
          <div />
        )}
        <Button
          type="button"
          variant="primary"
          onClick={handleSubmit}
          disabled={!isFormValid || isSubmitting || isProcessing}
        >
          {isSubmitting ? (
            "Spremam..."
          ) : (
            <>
              Dalje
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
