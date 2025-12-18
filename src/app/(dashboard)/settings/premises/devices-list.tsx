"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/lib/toast"
import { createDevice } from "@/app/actions/premises"
import type { PaymentDevice } from "@prisma/client"

interface DevicesListProps {
  premisesId: string
  companyId: string
  devices: PaymentDevice[]
}

export function DevicesList({ premisesId, companyId, devices }: DevicesListProps) {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleAddDevice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await createDevice({
      companyId,
      businessPremisesId: premisesId,
      code: parseInt(formData.get("code") as string, 10),
      name: formData.get("name") as string,
      isDefault: formData.get("isDefault") === "on",
    })

    setIsLoading(false)

    if (result.success) {
      toast.success("Naplatni uređaj je uspješno dodan")
      setIsAdding(false)
      router.refresh()
    } else {
      toast.error(result.error || "Greška pri dodavanju naplatnog uređaja")
    }
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">Naplatni uređaji</h4>
        {!isAdding && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            + Dodaj uređaj
          </Button>
        )}
      </div>

      {devices.length === 0 && !isAdding ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
          <p className="text-sm text-gray-500">
            Nema naplatnih uređaja. Svaki poslovni prostor treba barem jedan naplatni uređaj za
            izdavanje računa.
          </p>
          <button
            onClick={() => setIsAdding(true)}
            className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            + Dodaj prvi uređaj
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm bg-[var(--surface)] px-2 py-0.5 rounded border">
                  {device.code}
                </span>
                <span className="text-sm">{device.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {device.isDefault && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                    Zadani
                  </span>
                )}
                {!device.isActive && (
                  <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                    Neaktivan
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAddDevice} className="mt-2 p-3 bg-gray-50 rounded">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Input
                name="code"
                type="number"
                min="1"
                required
                placeholder="Kod (npr. 1)"
                className="font-mono"
              />
            </div>
            <div>
              <Input name="name" required placeholder="Naziv (npr. Blagajna 1)" />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="isDefault" className="rounded" />
                Zadani
              </label>
              <Button type="submit" size="sm" disabled={isLoading}>
                {isLoading ? "..." : "Spremi"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                Odustani
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
