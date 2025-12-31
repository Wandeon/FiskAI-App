"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ACCEPTED_FILE_TYPES } from "@/lib/import/detect-document-type"

interface SmartDropzoneProps {
  onFilesDropped: (files: File[]) => void
  disabled?: boolean
}

export function SmartDropzone({ onFilesDropped, disabled }: SmartDropzoneProps) {
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

  return (
    <div
      {...getRootProps()}
      className={`
        relative rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer
        ${
          isDragActive
            ? "border-focus bg-info-bg"
            : "border-default bg-gradient-to-br from-surface-1 to-white hover:border-strong"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div
          className={`
          rounded-full p-4 transition-colors
          ${isDragActive ? "bg-info-bg" : "bg-surface-2"}
        `}
        >
          <UploadCloud className={`h-10 w-10 ${isDragActive ? "text-link" : "text-tertiary"}`} />
        </div>

        <div>
          <p className="text-lg font-semibold text-foreground">
            {isDragActive ? "Ispustite datoteke ovdje" : "Povucite dokumente ovdje"}
          </p>
          <p className="mt-1 text-sm text-tertiary">PDF, XML, CSV, JPG, PNG</p>
          <p className="text-xs text-muted mt-1">Bankovni izvodi, računi, troškovi</p>
        </div>

        <Button type="button" variant="outline" disabled={disabled}>
          Odaberi datoteke
        </Button>
      </div>
    </div>
  )
}
