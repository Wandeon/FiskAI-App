"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { X, Check, RotateCcw, Wand2, Loader2 } from "lucide-react"

interface DocumentScannerProps {
  onCapture: (file: File) => void
  onClose: () => void
  initialFile?: File
}

type FilterType = "original" | "enhanced" | "bw"

export function DocumentScanner({ onCapture, onClose, initialFile }: DocumentScannerProps) {
  const [image, setImage] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [filter, setFilter] = useState<FilterType>("enhanced")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const originalImageRef = useRef<HTMLImageElement | null>(null)

  // Load initial file when component mounts
  useEffect(() => {
    if (initialFile) {
      setProcessing(true)
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          originalImageRef.current = img
          setImage(event.target?.result as string)
          setProcessing(false)
        }
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(initialFile)
    }
  }, [initialFile])

  // Apply filter to canvas
  useEffect(() => {
    if (!image || !canvasRef.current || !originalImageRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = originalImageRef.current

    // Set canvas size to match image (max 1200px for performance)
    const maxSize = 1200
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
    canvas.width = img.width * scale
    canvas.height = img.height * scale

    // Draw original image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    if (filter === "original") return

    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    if (filter === "enhanced") {
      // Enhanced: Increase contrast and brightness for document look
      const contrast = 1.4
      const brightness = 20
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness))
        data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness))
        data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness))
      }
    } else if (filter === "bw") {
      // Black & White with adaptive thresholding simulation
      // First convert to grayscale
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
      }

      // Apply simple threshold with local contrast
      const threshold = 180
      for (let i = 0; i < data.length; i += 4) {
        const val = data[i] > threshold ? 255 : 0
        data[i] = val
        data[i + 1] = val
        data[i + 2] = val
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }, [image, filter])

  const handleConfirm = useCallback(async () => {
    if (!canvasRef.current) return

    setProcessing(true)

    canvasRef.current.toBlob(
      async (blob) => {
        if (!blob) {
          setProcessing(false)
          return
        }

        // Create file from blob with applied filter
        const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" })
        onCapture(file)
      },
      "image/jpeg",
      0.9
    )
  }, [onCapture])

  // If we have initialFile but no image yet, show loading
  // If we have image, show the preview with filters
  // No more empty "open camera" screen - camera is triggered from parent

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80 safe-area-top">
        <button onClick={onClose} className="text-white p-2">
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-white font-medium">Pregled slike</h2>
        <div className="w-10" />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        {processing && (
          <div className="flex flex-col items-center gap-4 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Obrada...</p>
          </div>
        )}

        {image && !processing && (
          <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded-lg" />
        )}
      </div>

      {/* Filter options */}
      {image && !processing && (
        <div className="p-4 bg-black/80">
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setFilter("original")}
              className={`px-4 py-2 rounded-full text-sm ${
                filter === "original" ? "bg-surface text-black" : "bg-surface/20 text-white"
              }`}
            >
              Original
            </button>
            <button
              onClick={() => setFilter("enhanced")}
              className={`px-4 py-2 rounded-full text-sm flex items-center gap-1 ${
                filter === "enhanced" ? "bg-surface text-black" : "bg-surface/20 text-white"
              }`}
            >
              <Wand2 className="h-4 w-4" />
              Poboljšano
            </button>
            <button
              onClick={() => setFilter("bw")}
              className={`px-4 py-2 rounded-full text-sm ${
                filter === "bw" ? "bg-surface text-black" : "bg-surface/20 text-white"
              }`}
            >
              C/B
            </button>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      {image && !processing && (
        <div className="p-4 pb-8 bg-black/80 safe-area-bottom">
          <div className="flex justify-center gap-8">
            <button onClick={onClose} className="flex flex-col items-center gap-1 text-white">
              <div className="w-12 h-12 rounded-full bg-surface/20 flex items-center justify-center">
                <RotateCcw className="h-6 w-6" />
              </div>
              <span className="text-xs">Ponovi</span>
            </button>
            <button
              onClick={handleConfirm}
              disabled={processing}
              className="flex flex-col items-center gap-1 text-white"
            >
              <div className="w-16 h-16 rounded-full bg-success flex items-center justify-center">
                <Check className="h-8 w-8" />
              </div>
              <span className="text-xs">Potvrdi</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
