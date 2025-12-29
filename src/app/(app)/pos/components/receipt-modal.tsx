// src/app/(dashboard)/pos/components/receipt-modal.tsx
"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Modal, ModalFooter } from "@/components/ui/modal"
import type { ProcessPosSaleResult } from "@/types/pos"
import { generateFiscalQRCode, type FiscalQRData } from "@/lib/fiscal/qr-generator"
import {
  WebUSBPrinter,
  BrowserPrintFallback,
  type ThermalPrinter,
} from "@/lib/pos/thermal-printer"
import {
  generateEscPosReceipt,
  generateHtmlReceipt,
  extractReceiptData,
} from "@/lib/pos/receipt-formatter"

interface Props {
  isOpen: boolean
  result: ProcessPosSaleResult
  companyInfo?: {
    name: string
    address?: string
    oib: string
  }
  onNewSale: () => void
  onClose: () => void
}

export function ReceiptModal({ isOpen, result, companyInfo, onNewSale, onClose }: Props) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [printer, setPrinter] = useState<ThermalPrinter | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [printerConnected, setPrinterConnected] = useState(false)

  // Default company info if not provided (memoized to avoid useCallback dependency issues)
  const company = useMemo(
    () => companyInfo ?? { name: "FiskAI Demo", oib: "00000000000" },
    [companyInfo]
  )

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  // Connect to USB thermal printer
  const connectUsbPrinter = useCallback(async () => {
    setPrintError(null)
    try {
      const usbPrinter = new WebUSBPrinter(80)
      const connected = await usbPrinter.connect()
      if (connected) {
        setPrinter(usbPrinter)
        setPrinterConnected(true)
        return true
      }
      return false
    } catch (error) {
      console.error("USB printer connection failed:", error)
      setPrintError("Povezivanje USB pisaca nije uspjelo")
      return false
    }
  }, [])

  // Print to thermal printer
  const printThermal = useCallback(async () => {
    if (!result.invoice) return

    setIsPrinting(true)
    setPrintError(null)

    try {
      const receiptData = extractReceiptData(result, company, qrCodeDataUrl ?? undefined)

      if (printer && printerConnected) {
        // Print to connected thermal printer
        const escPosData = generateEscPosReceipt(receiptData, printer.getPaperWidth())
        await printer.print(escPosData)
      } else {
        // Fallback to browser print with thermal receipt styling
        const browserPrinter = new BrowserPrintFallback(80)
        const html = generateHtmlReceipt(receiptData, 80)
        browserPrinter.printHtml(html)
      }
    } catch (error) {
      console.error("Print failed:", error)
      setPrintError(error instanceof Error ? error.message : "Ispis nije uspio")
    } finally {
      setIsPrinting(false)
    }
  }, [result, company, qrCodeDataUrl, printer, printerConnected])

  // Generate QR code when fiscalization data is available
  useEffect(() => {
    async function generateQR() {
      if (!result.jir || !result.zki || !result.invoice || !result.issuerOib) {
        setQrCodeDataUrl(null)
        return
      }

      // Skip QR for demo JIRs
      if (result.jir.startsWith("DEMO")) {
        setQrCodeDataUrl(null)
        return
      }

      try {
        const qrData: FiscalQRData = {
          jir: result.jir,
          zki: result.zki,
          invoiceNumber: result.invoice.invoiceNumber,
          issuerOib: result.issuerOib,
          amount: result.invoice.totalAmount,
          dateTime: new Date(result.invoice.issueDate),
        }
        const dataUrl = await generateFiscalQRCode(qrData)
        setQrCodeDataUrl(dataUrl)
      } catch (error) {
        console.error("Failed to generate QR code:", error)
        setQrCodeDataUrl(null)
      }
    }

    if (isOpen) {
      generateQR()
    }
  }, [isOpen, result])

  // Legacy PDF print (opens in new window)
  function handlePdfPrint() {
    if (result.pdfUrl) {
      window.open(result.pdfUrl, "_blank")
    }
  }

  // Disconnect printer on unmount
  useEffect(() => {
    return () => {
      if (printer) {
        printer.disconnect()
      }
    }
  }, [printer])

  return (
    <Modal isOpen={isOpen} title="Prodaja zavrsena" onClose={onClose}>
      <div className="text-center space-y-6 py-4">
        {/* Success icon */}
        <div className="text-6xl text-success">&#10003;</div>

        {/* Invoice info */}
        <div>
          <p className="text-sm text-muted-foreground">Broj racuna</p>
          <p className="text-xl font-mono font-bold">{result.invoice?.invoiceNumber}</p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Ukupno</p>
          <p className="text-3xl font-bold">{formatPrice(result.invoice?.totalAmount || 0)}</p>
        </div>

        {/* Fiscalization Status */}
        <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Status fiskalizacije</h4>

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
                <Badge variant="warning">Demo: {result.jir}</Badge>
              ) : (
                <code className="text-xs font-mono text-success bg-background px-2 py-1 rounded">
                  {result.jir}
                </code>
              )}
            </div>
          )}

          {!result.jir && (
            <p className="text-sm text-warning flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-warning border-t-transparent rounded-full animate-spin" />
              Fiskalizacija u tijeku...
            </p>
          )}
        </div>

        {/* QR Code for fiscal verification */}
        {qrCodeDataUrl && (
          <div className="bg-card rounded-lg p-4 inline-block mx-auto">
            <Image
              src={qrCodeDataUrl}
              alt="QR kod za provjeru racuna"
              width={128}
              height={128}
              className="mx-auto"
            />
            <p className="text-xs text-muted-foreground mt-2">Skenirajte za provjeru racuna</p>
          </div>
        )}
      </div>

      <ModalFooter>
        <div className="w-full space-y-3">
          {/* Print error message */}
          {printError && (
            <p className="text-sm text-destructive text-center">{printError}</p>
          )}

          {/* Thermal printer connection */}
          <div className="flex items-center justify-center gap-2 text-sm">
            {printerConnected ? (
              <Badge variant="success">USB pisac povezan</Badge>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={connectUsbPrinter}
                className="text-muted-foreground"
              >
                Povezi USB termal pisac
              </Button>
            )}
          </div>

          {/* Print buttons */}
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={printThermal}
              disabled={isPrinting}
            >
              {isPrinting ? "Ispisuje..." : printerConnected ? "Ispisi termal" : "Ispisi racun"}
            </Button>
            {result.pdfUrl && (
              <Button variant="ghost" onClick={handlePdfPrint}>
                PDF
              </Button>
            )}
            <Button onClick={onNewSale}>Nova prodaja</Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  )
}
