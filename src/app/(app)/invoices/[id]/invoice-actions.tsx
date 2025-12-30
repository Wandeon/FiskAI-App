"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import {
  convertToInvoice,
  createCreditNote,
  deleteInvoice,
  sendInvoiceEmail,
} from "@/app/actions/invoice"
import type { EInvoice, Contact } from "@prisma/client"

interface InvoiceActionsProps {
  invoice: EInvoice & { buyer: Contact | null }
}

export function InvoiceActions({ invoice }: InvoiceActionsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [isCreatingCreditNote, setIsCreatingCreditNote] = useState(false)

  const canConvert = invoice.type === "QUOTE" || invoice.type === "PROFORMA"
  const canDelete = invoice.status === "DRAFT"
  const canSendEmail =
    invoice.buyer?.email && ["FISCALIZED", "SENT", "DELIVERED"].includes(invoice.status)
  const canCreateCreditNote =
    invoice.status !== "DRAFT" && invoice.type === "INVOICE" && invoice.direction === "OUTBOUND"

  async function handleConvert() {
    if (!confirm("Pretvoriti ovaj dokument u račun?")) return
    setIsLoading(true)

    const result = await convertToInvoice(invoice.id)
    setIsLoading(false)

    if (result.success) {
      toast.success("Dokument je pretvoren u račun")
      router.push(`/invoices/${result.data?.id}`)
    } else {
      toast.error(result.error || "Greška pri pretvaranju")
    }
  }

  async function handleDelete() {
    if (!confirm("Jeste li sigurni da želite obrisati ovaj dokument?")) return
    setIsLoading(true)

    const result = await deleteInvoice(invoice.id)
    setIsLoading(false)

    if (result.success) {
      toast.success("Dokument je obrisan")
      router.push("/invoices")
    } else {
      toast.error(result.error || "Greška pri brisanju")
    }
  }

  async function handleDownloadPDF() {
    setIsDownloading(true)

    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`)

      if (!response.ok) {
        throw new Error("Failed to download PDF")
      }

      const blob = await response.blob()

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `racun-${invoice.invoiceNumber.replace(/\//g, "-")}.pdf`
      document.body.appendChild(a)
      a.click()

      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("PDF preuzet")
    } catch (error) {
      console.error("PDF download error:", error)
      toast.error("Greška pri preuzimanju PDF-a")
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleSendEmail() {
    if (!confirm(`Poslati račun na e-mail adresu ${invoice.buyer?.email}?`)) return
    setIsSendingEmail(true)

    const result = await sendInvoiceEmail(invoice.id)
    setIsSendingEmail(false)

    if (result.success) {
      toast.success("E-mail uspješno poslan")
      router.refresh()
    } else {
      toast.error(result.error || "Greška pri slanju e-maila")
    }
  }

  async function handleCreateCreditNote() {
    if (!confirm("Kreirati storno (kreditnu notu) za ovaj račun?")) return
    setIsCreatingCreditNote(true)

    const result = await createCreditNote(invoice.id)
    setIsCreatingCreditNote(false)

    if (result.success) {
      toast.success("Storno je kreiran")
      router.push(`/invoices/${result.data?.id}`)
    } else {
      toast.error(result.error || "Greška pri kreiranju storna")
    }
  }

  return (
    <div className="flex gap-2">
      <Button onClick={handleDownloadPDF} disabled={isDownloading} variant="outline">
        {isDownloading ? "Preuzimanje..." : "Preuzmi PDF"}
      </Button>

      {canSendEmail && (
        <Button onClick={handleSendEmail} disabled={isSendingEmail} variant="outline">
          {isSendingEmail ? "Šaljem..." : "Pošalji e-mailom"}
        </Button>
      )}

      {canCreateCreditNote && (
        <Button onClick={handleCreateCreditNote} disabled={isCreatingCreditNote} variant="outline">
          {isCreatingCreditNote ? "Kreiram storno..." : "Storno"}
        </Button>
      )}

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
