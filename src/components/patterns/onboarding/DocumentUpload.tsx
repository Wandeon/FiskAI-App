"use client"

import { useState, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { FileText, Upload, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DocumentUploadProps {
  onFileSelect: (file: File) => void
  onFileClear: () => void
  selectedFile: File | null
  isProcessing?: boolean
  processingMessage?: string
  acceptedTypes?: string[]
  className?: string
}

const DEFAULT_ACCEPTED_TYPES = [".pdf", ".jpg", ".jpeg", ".png"]

/**
 * Document upload dropzone for Obrtnica (business license)
 * Supports drag & drop and file selection
 */
export function DocumentUpload({
  onFileSelect,
  onFileClear,
  selectedFile,
  isProcessing = false,
  processingMessage = "Obrađujem dokument...",
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  className,
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const acceptedTypesString = acceptedTypes.join(",")
  const displayTypes = acceptedTypes.map((t) => t.replace(".", "").toUpperCase()).join(", ")

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        // Validate file type
        const ext = `.${file.name.split(".").pop()?.toLowerCase()}`
        if (acceptedTypes.includes(ext)) {
          onFileSelect(file)
        }
      }
    },
    [acceptedTypes, onFileSelect]
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        onFileSelect(files[0])
      }
    },
    [onFileSelect]
  )

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  // Processing state
  if (isProcessing) {
    return (
      <div
        className={cn(
          "rounded-lg border-2 border-dashed border-border bg-surface-1 p-8",
          className
        )}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <Loader2 className="h-8 w-8 animate-spin text-interactive mb-4" />
          <p className="text-body-base text-foreground font-medium">{processingMessage}</p>
          <p className="text-body-sm text-secondary mt-1">Molimo pričekajte...</p>
        </div>
      </div>
    )
  }

  // File selected state
  if (selectedFile) {
    return (
      <div className={cn("rounded-lg border-2 border-success bg-success-bg p-6", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <FileText className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-body-base font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-body-sm text-secondary">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onFileClear}
            aria-label="Ukloni dokument"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // Default dropzone state
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "rounded-lg border-2 border-dashed p-8 transition-colors",
        isDragging
          ? "border-interactive bg-info-bg"
          : "border-border bg-surface-1 hover:border-interactive/50",
        className
      )}
    >
      <div className="flex flex-col items-center justify-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 mb-4">
          <FileText className="h-6 w-6 text-muted" />
        </div>

        <h3 className="text-body-base font-medium text-foreground mb-1">Učitaj Obrtnicu</h3>

        <p className="text-body-sm text-secondary mb-4">Automatski ćemo prepoznati vaše podatke.</p>

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={handleButtonClick}>
            <Upload className="h-4 w-4 mr-2" />
            Odaberi datoteku
          </Button>
          <span className="text-body-sm text-muted">ili povuci ovdje</span>
        </div>

        <p className="text-body-xs text-muted mt-4">Podržani: {displayTypes}</p>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypesString}
          onChange={handleFileInputChange}
          className="sr-only"
          aria-label="Odaberi datoteku za učitavanje"
        />
      </div>
    </div>
  )
}
