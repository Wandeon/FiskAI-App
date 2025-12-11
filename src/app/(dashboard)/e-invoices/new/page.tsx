import { getContacts } from "@/app/actions/contact"
import { getProducts } from "@/app/actions/product"
import { InvoiceForm } from "./invoice-form"

export default async function NewEInvoicePage() {
  const [contacts, products] = await Promise.all([
    getContacts("CUSTOMER"),
    getProducts(),
  ])

  return <InvoiceForm contacts={contacts} products={products} />
}
