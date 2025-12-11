"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { deleteProduct } from "@/app/actions/product"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "@/lib/toast"

interface DeleteProductButtonProps {
  productId: string
  productName: string
}

export function DeleteProductButton({ productId, productName }: DeleteProductButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deleteProduct(productId)

    if (result?.error) {
      toast.error("Greška", result.error)
      setLoading(false)
      return
    }

    toast.success("Proizvod obrisan")
    setIsOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={loading}
      >
        Obriši
      </Button>

      <ConfirmDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        title="Obriši proizvod"
        description={`Jeste li sigurni da želite obrisati proizvod "${productName}"? Ova akcija se ne može poništiti.`}
        confirmLabel="Obriši proizvod"
        cancelLabel="Odustani"
        variant="danger"
        loading={loading}
      />
    </>
  )
}
