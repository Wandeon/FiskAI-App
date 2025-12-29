"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal, ModalFooter } from "@/components/ui/modal"
import { toast } from "@/lib/toast"
import { bulkAssignDevices } from "@/lib/premises/bulk-actions"

interface BulkDevicesDialogProps {
  companyId: string
  premisesId: string
  premisesName: string
  isOpen: boolean
  onClose: () => void
}

export function BulkDevicesDialog({
  companyId,
  premisesId,
  premisesName,
  isOpen,
  onClose,
}: BulkDevicesDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const count = parseInt(formData.get("count") as string, 10)
    const namePrefix = formData.get("namePrefix") as string
    const startCode = parseInt(formData.get("startCode") as string, 10) || 1

    const result = await bulkAssignDevices(companyId, premisesId, count, namePrefix, startCode)

    setIsLoading(false)

    if (result.success) {
      const data = result.data as { created: number }
      toast.success(`Uspjesno kreirano ${data.created} naplatnih uredaja`)
      router.refresh()
      onClose()
    } else {
      toast.error(result.error || "Greska pri stvaranju naplatnih uredaja")
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dodaj vise naplatnih uredaja"
      description={`Kreiraj vise naplatnih uredaja za prostor "${premisesName}"`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="bulk-count">Broj uredaja</Label>
          <Input
            id="bulk-count"
            name="count"
            type="number"
            min="1"
            max="50"
            required
            placeholder="npr. 5"
            defaultValue="5"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Koliko naplatnih uredaja zelite kreirati (max 50)
          </p>
        </div>

        <div>
          <Label htmlFor="bulk-prefix">Prefiks naziva</Label>
          <Input
            id="bulk-prefix"
            name="namePrefix"
            required
            placeholder="npr. Blagajna"
            defaultValue="Blagajna"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Uredaji ce biti nazvani: Blagajna 1, Blagajna 2, itd.
          </p>
        </div>

        <div>
          <Label htmlFor="bulk-start">Pocetni kod</Label>
          <Input
            id="bulk-start"
            name="startCode"
            type="number"
            min="1"
            placeholder="1"
            defaultValue="1"
            className="font-mono"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Od kojeg koda poceti (preskace vec postojece kodove)
          </p>
        </div>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Odustani
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Kreiranje..." : "Kreiraj uredaje"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
