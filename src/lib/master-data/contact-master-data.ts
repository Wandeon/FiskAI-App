import { db } from "@/lib/db"
import { upsertOrganizationFromContact } from "@/lib/master-data/organization-service"

export async function ensureOrganizationForContact(
  companyId: string,
  contactId: string
): Promise<string | null> {
  const contact = await db.contact.findFirst({
    where: { id: contactId, companyId },
    select: {
      id: true,
      name: true,
      oib: true,
      vatNumber: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      postalCode: true,
      country: true,
      organizationId: true,
    },
  })

  if (!contact) {
    return null
  }

  if (contact.organizationId) {
    return contact.organizationId
  }

  return db.$transaction(async (tx) => {
    const { organizationId } = await upsertOrganizationFromContact(tx, companyId, {
      name: contact.name,
      oib: contact.oib,
      vatNumber: contact.vatNumber,
      email: contact.email,
      phone: contact.phone,
      address: contact.address,
      city: contact.city,
      postalCode: contact.postalCode,
      country: contact.country,
    })

    await tx.contact.update({
      where: { id: contact.id },
      data: { organizationId },
    })

    return organizationId
  })
}
