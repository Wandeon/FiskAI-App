"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import {
  requireAuth,
  requireCompanyWithContext,
  requireCompanyWithPermission,
} from "@/lib/auth-utils"
import { contactSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"

export async function createContact(formData: z.infer<typeof contactSchema>) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async (company) => {
    const validatedFields = contactSchema.safeParse(formData)

    if (!validatedFields.success) {
      return { error: "Invalid fields", details: validatedFields.error.flatten() }
    }

    const contact = await db.contact.create({
      data: {
        ...validatedFields.data,
        companyId: company.id,
      },
    })

    revalidatePath("/contacts")
    return { success: "Contact created", data: contact }
  })
}

export async function updateContact(contactId: string, formData: z.infer<typeof contactSchema>) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
    // Verify contact belongs to company (automatically filtered by tenant context)
    const existingContact = await db.contact.findFirst({
      where: { id: contactId },
    })

    if (!existingContact) {
      return { error: "Contact not found" }
    }

    const validatedFields = contactSchema.safeParse(formData)

    if (!validatedFields.success) {
      return { error: "Invalid fields", details: validatedFields.error.flatten() }
    }

    const contact = await db.contact.update({
      where: { id: contactId },
      data: validatedFields.data,
    })

    revalidatePath("/contacts")
    return { success: "Contact updated", data: contact }
  })
}

export async function deleteContact(contactId: string) {
  const user = await requireAuth()

  return requireCompanyWithPermission(user.id!, "contact:delete", async () => {
    const contact = await db.contact.findFirst({
      where: { id: contactId },
    })

    if (!contact) {
      return { error: "Contact not found" }
    }

    await db.contact.delete({
      where: { id: contactId },
    })

    revalidatePath("/contacts")
    return { success: "Contact deleted" }
  })
}

export async function getContacts(type?: "CUSTOMER" | "SUPPLIER" | "BOTH") {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
    return db.contact.findMany({
      where: {
        ...(type && { type }),
      },
      orderBy: { name: "asc" },
    })
  })
}

export async function searchContacts(query: string) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
    return db.contact.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { oib: { contains: query } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { name: "asc" },
    })
  })
}
