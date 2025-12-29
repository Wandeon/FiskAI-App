"use client"

import { useCallback, useState, useRef } from "react"
import { useDropzone } from "react-dropzone"
import { UploadCloud, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ACCEPTED_FILE_TYPES } from "@/lib/import/detect-document-type"
import { DocumentScanner } from "@/components/import/document-scanner"

interface CompactDropzoneProps {
  onFilesDropped: (files: File[]) => void
  disabled?: boolean
  bankAccounts: { id: string; name: string; iban: string }[]
  selectedAccountId: string
  onAccountChange: (accountId: string) => void
}

export function CompactDropzone({
  onFilesDropped,
  disabled,
  bankAccounts,
  selectedAccountId,
  onAccountChange,
}: CompactDropzoneProps) {
  const [scannerOpen, setScannerOpen] = useState(false)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFilesDropped(acceptedFiles)
      }
    },
    [onFilesDropped]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    disabled,
    multiple: true,
  })

  const handleScanCapture = useCallback(
    (file: File) => {
      setScannerOpen(false)
      setCapturedFile(null)
      onFilesDropped([file])
    },
    [onFilesDropped]
  )

  const handleCameraCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCapturedFile(file)
      setScannerOpen(true)
    }
    // Reset input so same file can be selected again
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ""
    }
  }, [])

  return (
    <div
      {...getRootProps()}
      className={`
        flex items-center gap-4 px-4 py-3 rounded-xl border-2 border-dashed transition-all cursor-pointer
        ${
          isDragActive
            ? "border-focus bg-info-bg"
            : "border-default bg-gradient-to-r from-slate-50 to-white hover:border-strong"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input {...getInputProps()} />

      {/* Hidden camera input - triggers native camera directly */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        className="hidden"
      />

      <div
        className={`
        flex-shrink-0 p-2 rounded-full transition-colors
        ${isDragActive ? "bg-info-bg" : "bg-surface-2"}
      `}
      >
        <UploadCloud className={`h-5 w-5 ${isDragActive ? "text-link" : "text-tertiary"}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {isDragActive ? "Ispustite ovdje..." : "Povucite dokumente ovdje"}
        </p>
        <p className="text-xs text-tertiary truncate">PDF, XML, CSV, slike</p>
      </div>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {bankAccounts.length > 0 && (
          <select
            value={selectedAccountId}
            onChange={(e) => onAccountChange(e.target.value)}
            className="text-sm border border-default rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-border-focus focus:border-focus hidden sm:block"
            onClick={(e) => e.stopPropagation()}
          >
            {bankAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        )}

        {/* Camera button - visible on mobile, directly opens camera */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation()
            cameraInputRef.current?.click()
          }}
          className="sm:hidden"
        >
          <Camera className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation()
            // Trigger file dialog
            const input = document.querySelector('input[type="file"]') as HTMLInputElement
            input?.click()
          }}
        >
          <span className="hidden sm:inline">Odaberi</span>
          <UploadCloud className="h-4 w-4 sm:hidden" />
        </Button>
      </div>

      {/* Document Scanner Modal - shows after camera capture */}
      {scannerOpen && capturedFile && (
        <DocumentScanner
          onCapture={handleScanCapture}
          onClose={() => {
            setScannerOpen(false)
            setCapturedFile(null)
          }}
          initialFile={capturedFile}
        />
      )}
    </div>
  )
}
