"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/lib/toast"
import { manualFiscalizeAction } from "@/app/actions/fiscal-certificate"
import { CheckCircle2, Clock, AlertCircle, XCircle, Send } from "lucide-react"
import type { EInvoice, FiscalRequest } from "@prisma/client"

interface FiscalStatusBadgeProps {
  invoice: EInvoice & {
    fiscalRequests?: FiscalRequest[]
  }
  hasCertificate: boolean
}

export function FiscalStatusBadge({ invoice, hasCertificate }: FiscalStatusBadgeProps) {
  const router = useRouter()
  const [isManualizing, setIsManualizing] = useState(false)

  const latestRequest = invoice.fiscalRequests?.[0]

  // If invoice has JIR, it's fiscalized
  if (invoice.jir) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="bg-success hover:bg-success">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Fiskalizirano
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          <div className="font-mono">JIR: {invoice.jir}</div>
          {invoice.zki && <div className="font-mono truncate max-w-xs">ZKI: {invoice.zki}</div>}
          {invoice.fiscalizedAt && (
            <div className="mt-1">
              Fiskalizirano: {new Date(invoice.fiscalizedAt).toLocaleString("hr-HR")}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Check fiscal request status
  if (latestRequest) {
    if (latestRequest.status === "QUEUED") {
      return (
        <div className="space-y-2">
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />U redu čekanja
          </Badge>
          <div className="text-xs text-muted-foreground">Čeka fiskalizaciju...</div>
        </div>
      )
    }

    if (latestRequest.status === "PROCESSING") {
      return (
        <div className="space-y-2">
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1 animate-spin" />
            Procesira se
          </Badge>
          <div className="text-xs text-muted-foreground">Fiskalizacija u tijeku...</div>
        </div>
      )
    }

    if (latestRequest.status === "FAILED" || latestRequest.status === "DEAD") {
      return (
        <div className="space-y-2">
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Neuspjela fiskalizacija
          </Badge>
          <div className="text-xs text-muted-foreground space-y-1">
            {latestRequest.errorMessage && (
              <div className="text-danger-text">Greška: {latestRequest.errorMessage}</div>
            )}
            {latestRequest.errorCode && (
              <div className="font-mono">Kod greške: {latestRequest.errorCode}</div>
            )}
            <div>
              Pokušaji: {latestRequest.attemptCount}/{latestRequest.maxAttempts}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualFiscalize}
            disabled={isManualizing}
          >
            {isManualizing ? "Slanje..." : "Pokušaj ponovno"}
          </Button>
        </div>
      )
    }
  }

  // No fiscalization yet - show manual button if conditions met
  const canManuallyFiscalize = hasCertificate && invoice.status !== "DRAFT" && !invoice.jir

  if (canManuallyFiscalize) {
    return (
      <div className="space-y-2">
        <Badge variant="outline">
          <AlertCircle className="w-3 h-3 mr-1" />
          Nije fiskalizirano
        </Badge>
        <Button
          size="sm"
          variant="default"
          onClick={handleManualFiscalize}
          disabled={isManualizing}
        >
          <Send className="w-4 h-4 mr-2" />
          {isManualizing ? "Slanje..." : "Fiskaliziraj"}
        </Button>
      </div>
    )
  }

  // No certificate or draft invoice
  if (!hasCertificate && invoice.status !== "DRAFT") {
    return (
      <div className="space-y-2">
        <Badge variant="outline">
          <AlertCircle className="w-3 h-3 mr-1" />
          Nije fiskalizirano
        </Badge>
        <div className="text-xs text-muted-foreground">Certifikat nije konfiguriran</div>
      </div>
    )
  }

  return null

  async function handleManualFiscalize() {
    if (!confirm("Fiskalizirati ovaj račun?")) return
    setIsManualizing(true)

    const result = await manualFiscalizeAction(invoice.id)
    setIsManualizing(false)

    if (result.success) {
      toast.success("Fiskalizacija je dodana u red čekanja")
      router.refresh()
    } else {
      toast.error(result.error || "Greška pri fiskalizaciji")
    }
  }
}
