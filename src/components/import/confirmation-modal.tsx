'use client'

import dynamic from 'next/dynamic'
import { X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TransactionEditor, ExtractedTransaction } from './transaction-editor'
import { InvoiceEditor, ExtractedInvoice } from './invoice-editor'

// Dynamic import PDF/Image viewers to avoid SSR issues with pdfjs-dist
const PdfViewer = dynamic(
  () => import('./pdf-viewer').then((mod) => mod.PdfViewer),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full">Učitavanje...</div> }
)

const ImageViewer = dynamic(
  () => import('./pdf-viewer').then((mod) => mod.ImageViewer),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full">Učitavanje...</div> }
)

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onDiscard: () => void
  filename: string
  fileType: 'PDF' | 'IMAGE'
  fileUrl: string
  documentType: 'BANK_STATEMENT' | 'INVOICE'
  onDocumentTypeChange?: (type: 'BANK_STATEMENT' | 'INVOICE') => void
  // Bank statement props
  transactions?: ExtractedTransaction[]
  openingBalance?: number
  closingBalance?: number
  mathValid?: boolean
  onTransactionsChange?: (transactions: ExtractedTransaction[]) => void
  selectedBankAccount?: string
  onBankAccountChange?: (accountId: string) => void
  bankAccounts?: Array<{ id: string; name: string; iban: string }>
  // Invoice props
  invoiceData?: ExtractedInvoice
  onInvoiceDataChange?: (data: ExtractedInvoice) => void
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  onDiscard,
  filename,
  fileType,
  fileUrl,
  documentType,
  onDocumentTypeChange,
  transactions = [],
  openingBalance,
  closingBalance,
  mathValid = true,
  onTransactionsChange = () => {},
  selectedBankAccount,
  onBankAccountChange,
  bankAccounts = [],
  invoiceData,
  onInvoiceDataChange,
}: ConfirmationModalProps) {
  // Determine if confirm should be disabled
  const isInvoiceValid = invoiceData?.mathValid !== false
  const isBankStatementValid = mathValid
  const canConfirm = documentType === 'INVOICE' ? isInvoiceValid : isBankStatementValid
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-[90vw] h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">{filename}</h2>
            <select
              value={documentType}
              onChange={(e) => onDocumentTypeChange?.(e.target.value as 'BANK_STATEMENT' | 'INVOICE')}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="BANK_STATEMENT">Bankovni izvod</option>
              <option value="INVOICE">Račun</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onDiscard}>
              Odbaci
            </Button>
            <Button onClick={onConfirm} disabled={!canConfirm}>
              Potvrdi
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Math Validation Warning - Bank Statement */}
        {documentType === 'BANK_STATEMENT' && !mathValid && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-800">Provjera salda nije uspjela</h3>
                <p className="text-sm text-red-700">
                  Izračunati završni saldo ne odgovara navedenom završnom saldu.
                  Pregledajte transakcije prije potvrđivanja.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Math Validation Warning - Invoice */}
        {documentType === 'INVOICE' && invoiceData && !invoiceData.mathValid && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 m-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-yellow-800">Provjera iznosa</h3>
                <p className="text-sm text-yellow-700">
                  Zbroj stavki ne odgovara ukupnom iznosu na računu.
                  Pregledajte i ispravite stavke prije potvrđivanja.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bank Account Context Bar */}
        {documentType === 'BANK_STATEMENT' && bankAccounts.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-b">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Bankovni račun:</label>
              <select
                value={selectedBankAccount || ''}
                onChange={(e) => onBankAccountChange?.(e.target.value)}
                className="border rounded px-3 py-1 text-sm"
              >
                <option value="">Odaberi račun...</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} - {account.iban}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Main Content - Side by Side */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side - Document Viewer */}
          <div className="w-1/2 border-r">
            {fileType === 'PDF' ? (
              <PdfViewer url={fileUrl} className="h-full" />
            ) : (
              <ImageViewer url={fileUrl} className="h-full" />
            )}
          </div>

          {/* Right Side - Transaction Editor or Invoice Editor */}
          <div className="w-1/2 overflow-hidden">
            {documentType === 'BANK_STATEMENT' ? (
              <TransactionEditor
                transactions={transactions}
                openingBalance={openingBalance}
                closingBalance={closingBalance}
                mathValid={mathValid}
                onChange={onTransactionsChange}
              />
            ) : invoiceData ? (
              <InvoiceEditor
                data={invoiceData}
                onChange={onInvoiceDataChange || (() => {})}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Učitavanje...</h3>
                  <p className="text-sm">Podaci računa se obrađuju</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
