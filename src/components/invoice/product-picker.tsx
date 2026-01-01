"use client"

import { Combobox, ComboboxOption } from "@/components/ui/combobox"

// Local type for product data (containment: removed @prisma/client import)
interface ProductData {
  id: string
  name: string
  sku: string | null
  unitPrice: number | null
  vatRate: number | null
  unit: string | null
  description: string | null
}

interface ProductPickerProps {
  products: ProductData[]
  onSelect: (product: ProductData) => void
}

export function ProductPicker({ products, onSelect }: ProductPickerProps) {
  const options: ComboboxOption[] = products.map((product) => ({
    value: product.id,
    label: product.name,
    description: product.sku ? `SKU: ${product.sku}` : undefined,
  }))

  const handleChange = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (product) {
      onSelect(product)
    }
  }

  return (
    <Combobox
      id="product-picker"
      options={options}
      value=""
      onChange={handleChange}
      placeholder="Dodaj proizvod..."
      emptyMessage="Nema proizvoda"
      className="max-w-xs"
    />
  )
}
