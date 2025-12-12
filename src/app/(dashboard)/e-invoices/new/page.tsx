import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireCompany } from "@/lib/auth-utils"
import { getContacts } from "@/app/actions/contact"
import { getProducts } from "@/app/actions/product"
import { InvoiceForm } from "./invoice-form"
import { deriveCapabilities } from "@/lib/capabilities"
import { previewNextInvoiceNumber } from "@/lib/invoice-numbering"
import type { Product } from "@prisma/client"

export default async function NewEInvoicePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const company = await requireCompany(session.user.id)
  const [contacts, products, nextInvoiceNumber] = await Promise.all([
    getContacts("CUSTOMER"),
    getProducts(),
    previewNextInvoiceNumber(company.id),
  ])

  const capabilities = deriveCapabilities(company)

  const plainProducts = products.map((p: Product) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    description: p.description,
    unit: p.unit,
    price: p.price.toNumber(),
    vatRate: p.vatRate.toNumber(),
    vatCategory: p.vatCategory,
  }))

  return (
    <InvoiceForm
      contacts={contacts}
      products={plainProducts}
      company={company}
      capabilities={capabilities}
      nextInvoiceNumber={nextInvoiceNumber.invoiceNumber}
    />
  )
}
