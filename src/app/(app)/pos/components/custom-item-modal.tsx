"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal, ModalFooter } from "@/components/ui/modal"

interface Props {
  onClose: () => void
  onAdd: (item: { description: string; unitPrice: number; vatRate: number }) => void
}

const VAT_RATES = [
  { value: 25, label: "25% (standard)" },
  { value: 13, label: "13% (sniženi)" },
  { value: 5, label: "5% (sniženi)" },
  { value: 0, label: "0% (oslobođeno)" },
]

export function CustomItemModal({ onClose, onAdd }: Props) {
  const [description, setDescription] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [vatRate, setVatRate] = useState(25)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const price = parseFloat(unitPrice)
    if (!description.trim() || isNaN(price) || price <= 0) return

    onAdd({
      description: description.trim(),
      unitPrice: price,
      vatRate,
    })
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Prilagođena stavka" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Opis</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Npr. Konzultacije"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Cijena (EUR)</label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">PDV stopa</label>
          <select
            value={vatRate}
            onChange={(e) => setVatRate(Number(e.target.value))}
            className="w-full border rounded-md px-3 py-2"
          >
            {VAT_RATES.map((rate) => (
              <option key={rate.value} value={rate.value}>
                {rate.label}
              </option>
            ))}
          </select>
        </div>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Odustani
          </Button>
          <Button type="submit" disabled={!description.trim() || !unitPrice}>
            Dodaj
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
