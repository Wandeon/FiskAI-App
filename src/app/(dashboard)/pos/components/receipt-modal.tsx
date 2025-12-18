// src/app/(dashboard)/pos/components/receipt-modal.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Modal, ModalFooter } from "@/components/ui/modal"
import type { ProcessPosSaleResult } from "@/types/pos"

interface Props {
  result: ProcessPosSaleResult
  onNewSale: () => void
  onClose: () => void
}

export function ReceiptModal({ result, onNewSale, onClose }: Props) {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  function handlePrint() {
    if (result.pdfUrl) {
      window.open(result.pdfUrl, "_blank")
    }
  }

  return (
    <Modal title="Prodaja završena" onClose={onClose}>
      <div className="text-center space-y-6 py-4">
        {/* Success icon */}
        <div className="text-6xl text-green-500">✓</div>

        {/* Invoice info */}
        <div>
          <p className="text-sm text-gray-500">Broj računa</p>
          <p className="text-xl font-mono font-bold">
            {result.invoice?.invoiceNumber}
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Ukupno</p>
          <p className="text-3xl font-bold">
            {formatPrice(result.invoice?.totalAmount || 0)}
          </p>
        </div>

        {/* Fiscalization Status */}
        <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Status fiskalizacije
          </h4>

          {result.zki && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">ZKI:</span>
              <code className="text-xs font-mono bg-background px-2 py-1 rounded">
                {result.zki.substring(0, 20)}...
              </code>
            </div>
          )}

          {result.jir && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">JIR:</span>
              {result.jir.startsWith("DEMO") ? (
                <Badge variant="warning" className="text-amber-700">
                  Demo: {result.jir}
                </Badge>
              ) : (
                <code className="text-xs font-mono text-green-600 bg-background px-2 py-1 rounded">
                  {result.jir}
                </code>
              )}
            </div>
          )}

          {!result.jir && (
            <p className="text-sm text-amber-600 flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
              Fiskalizacija u tijeku...
            </p>
          )}
        </div>
      </div>

      <ModalFooter>
        <Button variant="outline" onClick={handlePrint}>
          Ispiši račun
        </Button>
        <Button onClick={onNewSale}>Nova prodaja</Button>
      </ModalFooter>
    </Modal>
  )
}
