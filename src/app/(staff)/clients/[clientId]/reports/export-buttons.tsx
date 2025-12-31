"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface ExportButtonsProps {
  clientId: string
}

type ExportType = "invoices" | "expenses" | "all"

export function ExportButtons({ clientId }: ExportButtonsProps) {
  const [loading, setLoading] = useState<ExportType | null>(null)

  const handleExport = async (exportType: ExportType) => {
    setLoading(exportType)
    try {
      const params = new URLSearchParams({
        clientIds: clientId,
        exportType: exportType === "all" ? "all" : exportType,
        format: exportType === "all" ? "combined" : "csv",
      })

      const response = await fetch("/api/staff/bulk-export?" + params.toString())

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Export failed")
      }

      const contentDisposition = response.headers.get("Content-Disposition")
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/)
      const filename =
        filenameMatch?.[1] || "export-" + exportType + (exportType === "all" ? ".zip" : ".csv")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Export completed", {
        description: filename + " has been downloaded.",
      })
    } catch (error) {
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "An error occurred during export.",
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => handleExport("invoices")}
        disabled={loading !== null}
      >
        {loading === "invoices" ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        Export Invoices (CSV)
      </Button>
      <Button
        variant="outline"
        onClick={() => handleExport("expenses")}
        disabled={loading !== null}
      >
        {loading === "expenses" ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        Export Documents (ZIP)
      </Button>
      <Button variant="outline" onClick={() => handleExport("all")} disabled={loading !== null}>
        {loading === "all" ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        Full Data Export
      </Button>
    </>
  )
}
