import { notFound } from "next/navigation"
import { getContact } from "../../actions"
import { ContactForm } from "@/components/contacts/ContactForm"

interface EditContactPageProps {
  params: Promise<{ id: string }>
}

export default async function EditContactPage({ params }: EditContactPageProps) {
  const { id } = await params

  const contact = await getContact(id)

  if (!contact) {
    notFound()
  }

  const initialData = {
    id: contact.id,
    type: contact.type,
    name: contact.name,
    oib: contact.oib || "",
    email: contact.email || "",
    phone: contact.phone || "",
    address: contact.address || "",
    city: contact.city || "",
    zipCode: contact.zipCode || "",
    country: contact.country || "HR",
  }

  return <ContactForm mode="edit" initialData={initialData} />
}
