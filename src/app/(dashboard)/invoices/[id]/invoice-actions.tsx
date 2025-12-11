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

  return (
    <div className="flex gap-2">
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
