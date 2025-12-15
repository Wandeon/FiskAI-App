export interface ExtractedReceipt {
  vendor: string
  vendorOib?: string
  date: string
  items: ExtractedItem[]
  subtotal: number
  vatAmount: number
  total: number
  paymentMethod?: 'cash' | 'card' | 'transfer'
  currency: string
  confidence: number // 0-1
}

export interface ExtractedItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
  vatRate?: number
}

export interface ExtractedInvoice extends ExtractedReceipt {
  invoiceNumber: string
  issueDate: string
  dueDate?: string
  buyerName?: string
  buyerOib?: string
}

export interface ExtractionResult<T> {
  success: boolean
  data?: T
  error?: string
  rawText?: string
}

export interface CategorySuggestion {
  categoryId: string
  categoryName: string
  confidence: number
  reason?: string // Human-readable explanation of why this category was suggested
}
