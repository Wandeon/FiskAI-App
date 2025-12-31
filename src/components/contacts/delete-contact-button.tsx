"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { deleteContact } from "@/lib/actions/contact"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface DeleteContactButtonProps {
  contactId: string
  contactName: string
}

export function DeleteContactButton({ contactId, contactName }: DeleteContactButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      await deleteContact(contactId)
      setIsOpen(false)
    })
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-button p-2 text-[var(--muted)] hover:bg-danger-50 hover:text-danger-600 transition-colors"
        title="Obriši"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        title="Obriši kontakt"
        description={`Jeste li sigurni da želite obrisati kontakt "${contactName}"? Ova radnja se ne može poništiti.`}
        confirmLabel="Obriši"
        cancelLabel="Odustani"
        variant="danger"
        loading={isPending}
      />
    </>
  )
}
