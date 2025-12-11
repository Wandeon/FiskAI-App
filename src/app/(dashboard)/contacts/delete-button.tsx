"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { deleteContact } from "@/app/actions/contact"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"

interface DeleteContactButtonProps {
  contactId: string
  contactName: string
}

export function DeleteContactButton({ contactId, contactName }: DeleteContactButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`Jeste li sigurni da želite obrisati kontakt "${contactName}"?`)) {
      return
    }

    setLoading(true)
    const result = await deleteContact(contactId)

    if (result?.error) {
      toast.error("Greška", result.error)
      setLoading(false)
      return
    }

    toast.success("Kontakt obrisan")
    router.refresh()
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
    >
      {loading ? "..." : "Obriši"}
    </Button>
  )
}
