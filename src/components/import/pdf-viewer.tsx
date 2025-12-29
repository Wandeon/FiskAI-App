"use client"

import { useState } from "react"
import { Loader2, FileText, ExternalLink, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PdfViewerProps {
  url: string
  className?: string
}

export function PdfViewer({ url, className = "" }: PdfViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Add parameters to hide browser PDF toolbar
  const cleanUrl = `${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-surface-2 ${className}`}>
        <FileText className="h-12 w-12 text-muted mb-2" />
        <p className="text-danger-icon mb-4">Greška pri učitavanju PDF-a</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-link hover:text-link"
        >
          <ExternalLink className="h-4 w-4" />
          Otvori u novom prozoru
        </a>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* PDF Display using browser's native viewer (toolbar hidden) */}
      <div className="flex-1 relative bg-surface-2">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-2 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-tertiary" />
          </div>
        )}
        <embed
          src={cleanUrl}
          type="application/pdf"
          className="w-full h-full"
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  )
}

interface ImageViewerProps {
  url: string
  className?: string
}

export function ImageViewer({ url, className = "" }: ImageViewerProps) {
  const [scale, setScale] = useState<number>(1.0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<boolean>(false)

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3.0))
  }

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5))
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-full bg-surface-2 ${className}`}>
        <FileText className="h-12 w-12 text-muted mb-2" />
        <p className="text-danger-icon mb-4">Greška pri učitavanju slike</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-link hover:text-link"
        >
          <ExternalLink className="h-4 w-4" />
          Otvori u novom prozoru
        </a>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-end p-2 border-b bg-surface-1 gap-2">
        <Button variant="outline" size="sm" onClick={zoomOut} disabled={loading}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-sm">{Math.round(scale * 100)}%</span>
        <Button variant="outline" size="sm" onClick={zoomIn} disabled={loading}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Image Display */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-surface-2 p-4 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-2 z-10">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Učitavanje slike...</span>
            </div>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Document"
          style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
          className={`max-w-full max-h-full object-contain transition-transform ${loading ? "opacity-0" : "opacity-100"}`}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false)
            setError(true)
          }}
        />
      </div>
    </div>
  )
}
