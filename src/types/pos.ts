// src/types/pos.ts

export interface PosLineItem {
  productId?: string // From product grid (optional)
  description: string // Required for all items
  quantity: number
  unitPrice: number // In EUR (not cents)
  vatRate: number // 25, 13, 5, or 0
}

export interface ProcessPosSaleInput {
  items: PosLineItem[]
  paymentMethod: "CASH" | "CARD"
  stripePaymentIntentId?: string // Required if CARD
  buyerId?: string // Optional - anonymous sale OK
}

export interface ProcessPosSaleResult {
  success: boolean
  invoice?: {
    id: string
    invoiceNumber: string
    totalAmount: number
    issueDate: string // ISO string
    paymentMethod: "CASH" | "CARD"
    items: Array<{
      description: string
      quantity: number
      unitPrice: number
      totalPrice: number
      vatRate: number
    }>
  }
  issuerOib?: string
  operatorOib?: string
  jir?: string
  zki?: string
  pdfUrl?: string
  error?: string
}
