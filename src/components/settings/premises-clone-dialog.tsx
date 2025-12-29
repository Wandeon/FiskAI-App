"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal, ModalFooter } from "@/components/ui/modal"
import { toast } from "@/lib/toast"
import { clonePremises } from "@/lib/premises/bulk-actions"

interface PremisesCloneDialogProps {
  premisesId: string
  premisesName: string
  isOpen: boolean
  onClose: () => void
}

export function PremisesCloneDialog({
  premisesId,
  premisesName,
  isOpen,
  onClose,
}: PremisesCloneDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const newCode = parseInt(formData.get("code") as string, 10)
    const newName = formData.get("name") as string

    const result = await clonePremises(premisesId, newCode, newName)

    setIsLoading(false)

    if (result.success) {
      const data = result.data as { devicesCloned: number }
      toast.success(
        `Poslovni prostor kloniran uspjesno${data.devicesCloned > 0 ? ` (${data.devicesCloned} uredaja)` : ""}`
      )
      router.refresh()
      onClose()
    } else {
      toast.error(result.error || "Greska pri kloniranju poslovnog prostora")
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kloniraj poslovni prostor"
      description={`Kreiraj kopiju prostora "${premisesName}" sa svim naplatnim uredajima`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="clone-code">Novi kod</Label>
          <Input
            id="clone-code"
            name="code"
            type="number"
            min="1"
            required
            placeholder="npr. 2"
            className="font-mono"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Jedinstveni numericki kod za novi poslovni prostor
          </p>
        </div>

        <div>
          <Label htmlFor="clone-name">Novi naziv</Label>
          <Input
            id="clone-name"
            name="name"
            required
            placeholder={`${premisesName} (kopija)`}
            defaultValue={`${premisesName} (kopija)`}
          />
        </div>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Odustani
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Kloniranje..." : "Kloniraj"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
