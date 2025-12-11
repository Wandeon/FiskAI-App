'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { convertToInvoice, deleteInvoice } from '@/app/actions/invoice'
import type { EInvoice } from '@prisma/client'

interface InvoiceActionsProps {
  invoice: EInvoice
}

export function InvoiceActions({ invoice }: InvoiceActionsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const canConvert = invoice.type === 'QUOTE' || invoice.type === 'PROFORMA'
  const canDelete = invoice.status === 'DRAFT'

  async function handleConvert() {
    if (!confirm('Pretvoriti ovaj dokument u račun?')) return
    setIsLoading(true)

    const result = await convertToInvoice(invoice.id)
    setIsLoading(false)

    if (result.success) {
      toast.success('Dokument je pretvoren u račun')
      router.push(`/invoices/${result.data?.id}`)
    } else {
      toast.error(result.error || 'Greška pri pretvaranju')
    }
  }

  async function handleDelete() {
    if (!confirm('Jeste li sigurni da želite obrisati ovaj dokument?')) return
    setIsLoading(true)

    const result = await deleteInvoice(invoice.id)
    setIsLoading(false)

    if (result.success) {
      toast.success('Dokument je obrisan')
      router.push('/invoices')
    } else {
      toast.error(result.error || 'Greška pri brisanju')
    }
  }

  async function handleDownloadPDF() {
    setIsDownloading(true)
    
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`)
      
      if (!response.ok) {
        throw new Error('Failed to download PDF')
      }
      
      // Get the blob from response
      const blob = await response.blob()
      
      // Create a download link and trigger download
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `racun-${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      
      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('PDF preuzet')
    } catch (error) {
      console.error('PDF download error:', error)
      toast.error('Greška pri preuzimanju PDF-a')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button 
        onClick={handleDownloadPDF} 
        disabled={isDownloading}
        variant="outline"
      >
        {isDownloading ? 'Preuzimanje...' : 'Preuzmi PDF'}
      </Button>
      
      {canConvert && (
        <Button onClick={handleConvert} disabled={isLoading}>
          Pretvori u račun
        </Button>
      )}
      
      {canDelete && (
        <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
          Obriši
        </Button>
      )}
    </div>
  )
}
