"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Camera, Upload, X, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AIFeedback } from "@/components/ai/ai-feedback"
import { ExtractedReceipt } from "@/lib/ai/types"

interface ExtractedReceiptWithUrl extends ExtractedReceipt {
  receiptUrl?: string
}

interface ReceiptScannerWithFeedbackProps {
  onExtracted: (data: ExtractedReceiptWithUrl) => void
  onCancel?: () => void
  entityId?: string // Optional: if you want to track feedback for a specific entity
}

export function ReceiptScannerWithFeedback({
  onExtracted,
  onCancel,
  entityId,
}: ReceiptScannerWithFeedbackProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedReceiptWithUrl | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const processImage = async (file: File) => {
    setIsProcessing(true)
    setError(null)
    setCurrentFile(file)

    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Convert to base64 for API
      const base64 = await fileToBase64(file)

      // Call extraction API
      const response = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Extraction failed")
      }

      if (result.success && result.data) {
        // Upload the receipt image to R2 storage
        let receiptUrl: string | undefined
        try {
          const formData = new FormData()
          formData.append("file", file)

          const uploadResponse = await fetch("/api/receipts/upload", {
            method: "POST",
            body: formData,
          })

          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json()
            receiptUrl = uploadResult.receiptUrl
          }
        } catch (uploadError) {
          console.warn("Receipt upload failed:", uploadError)
        }

        const extractedWithUrl = { ...result.data, receiptUrl }
        setExtractedData(extractedWithUrl)
        setShowFeedback(true)
      } else {
        throw new Error(result.error || "Failed to extract data")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed")
    } finally {
      setIsProcessing(false)
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void processImage(file)
    }
  }

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void processImage(file)
    }
  }

  const handleCancel = () => {
    setPreview(null)
    setError(null)
    setIsProcessing(false)
    setCurrentFile(null)
    setExtractedData(null)
    setShowFeedback(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (cameraInputRef.current) cameraInputRef.current.value = ""
    onCancel?.()
  }

  const handleConfirm = () => {
    if (extractedData) {
      onExtracted(extractedData)
    }
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Skeniraj račun</h3>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {preview && (
          <div className="relative">
            <Image
              src={preview}
              alt="Receipt preview"
              width={800}
              height={600}
              className="w-full h-auto rounded-lg border object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Obrađujem...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 bg-danger-bg text-danger-text rounded-lg">
            <p className="text-sm font-medium">Greška</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Show AI Feedback after successful extraction */}
        {showFeedback && extractedData && entityId && (
          <AIFeedback
            entityType="expense"
            entityId={entityId}
            operation="ocr_receipt"
            confidence={extractedData.confidence}
            onFeedbackSubmitted={() => {
              console.log("Feedback submitted for receipt extraction")
            }}
          />
        )}

        {!preview && !isProcessing && (
          <div className="grid gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Camera className="h-4 w-4 mr-2" />
              Fotografiraj
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCameraCapture}
            />

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Učitaj sliku
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {preview && !isProcessing && !error && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>
              Poništi
            </Button>
            <Button type="button" className="flex-1" onClick={handleConfirm}>
              <Check className="h-4 w-4 mr-2" />
              Potvrdi
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
