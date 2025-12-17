// src/app/(dashboard)/pos/components/receipt-modal.tsx
"use client"

import { Button } from "@/components/ui/button"
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

        {/* Fiscal codes */}
        <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2">
          {result.jir && (
            <div>
              <span className="text-xs text-gray-500">JIR: </span>
              <span className="font-mono text-sm">{result.jir}</span>
            </div>
          )}
          {result.zki && (
            <div>
              <span className="text-xs text-gray-500">ZKI: </span>
              <span className="font-mono text-sm break-all">{result.zki}</span>
            </div>
          )}
          {!result.jir && (
            <p className="text-sm text-amber-600">
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
