import { notFound } from "next/navigation"
import { getProduct } from "../../actions"
import { ProductForm } from "@/components/products/ProductForm"

interface EditProductPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params

  const product = await getProduct(id)

  if (!product) {
    notFound()
  }

  const initialData = {
    id: product.id,
    name: product.name,
    description: product.description || "",
    sku: product.sku || "",
    price: product.price,
    unit: product.unit,
    vatRate: product.vatRate,
    vatCategory: product.vatCategory as "S" | "R" | "AA" | "Z" | "E",
    isActive: product.isActive,
  }

  return <ProductForm mode="edit" initialData={initialData} />
}
