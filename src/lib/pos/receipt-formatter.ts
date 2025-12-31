// src/lib/pos/receipt-formatter.ts
/**
 * Receipt Formatter for Thermal Printers
 * Generates ESC/POS commands and HTML for thermal receipt printing
 */

import { ESC_POS, PAPER_CONFIGS, encodeCP852, type PrinterPaperWidth } from "./thermal-printer"
import type { ProcessPosSaleResult } from "@/types/pos"

export interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  total: number
  vatRate?: number
}

export interface ReceiptData {
  // Company info
  companyName: string
  companyAddress?: string
  companyOib: string

  // Invoice info
  invoiceNumber: string
  issueDate: Date
  paymentMethod: string

  // Items
  items: ReceiptItem[]

  // Totals
  subtotal: number
  vatAmount: number
  total: number

  // Fiscalization
  zki?: string
  jir?: string
  operatorOib?: string

  // QR Code data URL (optional)
  qrCodeUrl?: string
}

/**
 * Format a price in Croatian format
 */
function formatPrice(amount: number): string {
  return new Intl.NumberFormat("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format date/time in Croatian format
 */
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

/**
 * Create a separator line
 */
function separatorLine(width: number, char = "-"): string {
  return char.repeat(width)
}

/**
 * Format item line with name on left, price on right
 */
function formatItemLine(name: string, price: string, width: number): string {
  const priceWidth = price.length
  const nameWidth = width - priceWidth - 1
  const truncatedName = name.length > nameWidth ? name.substring(0, nameWidth - 2) + ".." : name
  const padding = width - truncatedName.length - priceWidth
  return truncatedName + " ".repeat(padding) + price
}

/**
 * Generate ESC/POS command buffer for thermal receipt
 */
export function generateEscPosReceipt(
  data: ReceiptData,
  paperWidth: PrinterPaperWidth = 80
): Uint8Array {
  const config = PAPER_CONFIGS[paperWidth]
  const width = config.charsPerLine
  const commands: Uint8Array[] = []

  // Helper to add commands
  const add = (cmd: Uint8Array) => commands.push(cmd)
  const addText = (text: string) => commands.push(encodeCP852(text))
  const newLine = () => add(ESC_POS.LINE_FEED)

  // Initialize printer
  add(ESC_POS.INIT)

  // Company header - centered, double size
  add(ESC_POS.ALIGN_CENTER)
  add(ESC_POS.DOUBLE_SIZE)
  addText(data.companyName)
  newLine()

  add(ESC_POS.NORMAL_SIZE)
  if (data.companyAddress) {
    addText(data.companyAddress)
    newLine()
  }
  addText(`OIB: ${data.companyOib}`)
  newLine()
  newLine()

  // Separator
  add(ESC_POS.ALIGN_LEFT)
  addText(separatorLine(width, "="))
  newLine()

  // Invoice info
  addText(`Racun br: ${data.invoiceNumber}`)
  newLine()
  addText(`Datum: ${formatDateTime(data.issueDate)}`)
  newLine()
  addText(`Nacin placanja: ${data.paymentMethod}`)
  newLine()

  // Separator
  addText(separatorLine(width))
  newLine()

  // Items
  for (const item of data.items) {
    // Item name
    addText(item.name)
    newLine()

    // Quantity x price = total
    const qtyLine = `  ${item.quantity} x ${formatPrice(item.unitPrice)}`
    const totalStr = formatPrice(item.total) + " EUR"
    addText(formatItemLine(qtyLine, totalStr, width))
    newLine()
  }

  // Separator
  addText(separatorLine(width))
  newLine()

  // Totals
  addText(formatItemLine("Osnovica:", formatPrice(data.subtotal) + " EUR", width))
  newLine()
  addText(formatItemLine("PDV:", formatPrice(data.vatAmount) + " EUR", width))
  newLine()

  add(ESC_POS.BOLD_ON)
  add(ESC_POS.DOUBLE_HEIGHT)
  addText(formatItemLine("UKUPNO:", formatPrice(data.total) + " EUR", width))
  newLine()
  add(ESC_POS.NORMAL_SIZE)
  add(ESC_POS.BOLD_OFF)

  // Separator
  addText(separatorLine(width, "="))
  newLine()
  newLine()

  // Fiscalization data
  add(ESC_POS.ALIGN_LEFT)
  if (data.zki) {
    addText(`ZKI: ${data.zki}`)
    newLine()
  }
  if (data.jir) {
    if (data.jir.startsWith("DEMO")) {
      addText(`JIR: ${data.jir} (DEMO)`)
    } else {
      addText(`JIR: ${data.jir}`)
    }
    newLine()
  }
  if (data.operatorOib) {
    addText(`Operater OIB: ${data.operatorOib}`)
    newLine()
  }
  newLine()

  // Footer
  add(ESC_POS.ALIGN_CENTER)
  addText("Hvala na posjetu!")
  newLine()
  addText("www.fiskai.hr")
  newLine()

  // Feed and cut
  add(ESC_POS.FEED_LINES(4))
  add(ESC_POS.PARTIAL_CUT)

  // Combine all commands
  const totalLength = commands.reduce((sum, cmd) => sum + cmd.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const cmd of commands) {
    result.set(cmd, offset)
    offset += cmd.length
  }

  return result
}

/**
 * Generate HTML receipt for browser printing fallback
 */
export function generateHtmlReceipt(
  data: ReceiptData,
  _paperWidth: PrinterPaperWidth = 80
): string {
  const itemsHtml = data.items
    .map(
      (item) => `
      <div class="item">
        <div class="item-name">${escapeHtml(item.name)}</div>
        <div class="item-row">
          <span>${item.quantity} x ${formatPrice(item.unitPrice)}</span>
          <span>${formatPrice(item.total)} EUR</span>
        </div>
      </div>
    `
    )
    .join("")

  return `
    <div class="receipt">
      <div class="header center">
        <div class="company-name double bold">${escapeHtml(data.companyName)}</div>
        ${data.companyAddress ? `<div>${escapeHtml(data.companyAddress)}</div>` : ""}
        <div>OIB: ${data.companyOib}</div>
      </div>

      <div class="line"></div>

      <div class="invoice-info">
        <div>Racun br: ${data.invoiceNumber}</div>
        <div>Datum: ${formatDateTime(data.issueDate)}</div>
        <div>Nacin placanja: ${data.paymentMethod}</div>
      </div>

      <div class="line"></div>

      <div class="items">
        ${itemsHtml}
      </div>

      <div class="line"></div>

      <div class="totals">
        <div class="item-row">
          <span>Osnovica:</span>
          <span>${formatPrice(data.subtotal)} EUR</span>
        </div>
        <div class="item-row">
          <span>PDV:</span>
          <span>${formatPrice(data.vatAmount)} EUR</span>
        </div>
        <div class="item-row bold double">
          <span>UKUPNO:</span>
          <span>${formatPrice(data.total)} EUR</span>
        </div>
      </div>

      <div class="line thick"></div>

      <div class="fiscal-info">
        ${data.zki ? `<div>ZKI: ${data.zki}</div>` : ""}
        ${data.jir ? `<div>JIR: ${data.jir}${data.jir.startsWith("DEMO") ? " (DEMO)" : ""}</div>` : ""}
        ${data.operatorOib ? `<div>Operater OIB: ${data.operatorOib}</div>` : ""}
      </div>

      ${
        data.qrCodeUrl
          ? `
        <div class="qr-code center">
          <img src="${data.qrCodeUrl}" alt="QR kod" width="100" height="100" />
        </div>
      `
          : ""
      }

      <div class="footer center">
        <div>Hvala na posjetu!</div>
        <div>www.fiskai.hr</div>
      </div>
    </div>
  `
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char)
}

/**
 * Extract receipt data from POS sale result
 */
export function extractReceiptData(
  result: ProcessPosSaleResult,
  companyInfo: {
    name: string
    address?: string
    oib: string
  },
  qrCodeUrl?: string
): ReceiptData {
  const invoice = result.invoice
  if (!invoice) {
    throw new Error("No invoice data in sale result")
  }

  const items: ReceiptItem[] = invoice.items.map((item) => ({
    name: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.totalPrice,
    vatRate: item.vatRate,
  }))

  // Calculate VAT (assuming all items have same rate for simplicity)
  const vatRate = items[0]?.vatRate ?? 25
  const subtotal = invoice.totalAmount / (1 + vatRate / 100)
  const vatAmount = invoice.totalAmount - subtotal

  return {
    companyName: companyInfo.name,
    companyAddress: companyInfo.address,
    companyOib: companyInfo.oib,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: new Date(invoice.issueDate),
    paymentMethod: translatePaymentMethod(invoice.paymentMethod),
    items,
    subtotal,
    vatAmount,
    total: invoice.totalAmount,
    zki: result.zki,
    jir: result.jir,
    operatorOib: result.operatorOib,
    qrCodeUrl,
  }
}

/**
 * Translate payment method to Croatian
 */
function translatePaymentMethod(method: string): string {
  const translations: Record<string, string> = {
    CASH: "Gotovina",
    CARD: "Kartica",
    TRANSFER: "Virman",
    OTHER: "Ostalo",
  }
  return translations[method] || method
}
