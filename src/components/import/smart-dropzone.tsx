'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ACCEPTED_FILE_TYPES } from '@/lib/import/detect-document-type'

interface SmartDropzoneProps {
  onFilesDropped: (files: File[]) => void
  disabled?: boolean
}

export function SmartDropzone({ onFilesDropped, disabled }: SmartDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFilesDropped(acceptedFiles)
    }
  }, [onFilesDropped])

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
        ${isDragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gradient-to-br from-slate-50 to-white hover:border-gray-400'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className={`
          rounded-full p-4 transition-colors
          ${isDragActive ? 'bg-blue-100' : 'bg-gray-100'}
        `}>
          <UploadCloud className={`h-10 w-10 ${isDragActive ? 'text-blue-600' : 'text-gray-500'}`} />
        </div>

        <div>
          <p className="text-lg font-semibold text-gray-900">
            {isDragActive ? 'Ispustite datoteke ovdje' : 'Povucite dokumente ovdje'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            PDF, XML, CSV, JPG, PNG
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Bankovni izvodi, računi, troškovi
          </p>
        </div>

        <Button type="button" variant="outline" disabled={disabled}>
          Odaberi datoteke
        </Button>
      </div>
    </div>
  )
}
