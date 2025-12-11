"use client"

import { Combobox, ComboboxOption } from "@/components/ui/combobox"
import { Product } from "@prisma/client"

interface ProductPickerProps {
  products: Product[]
  onSelect: (product: Product) => void
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
