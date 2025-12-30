"use server"

import { z } from "zod"
import { db, getTenantContext } from "@/lib/db"
import {
  requireAuth,
  requireCompanyWithContext,
  requireCompanyWithPermission,
} from "@/lib/auth-utils"
import { contactSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"

export async function createContact(formData: z.infer<typeof contactSchema>) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
    const validatedFields = contactSchema.safeParse(formData)

    if (!validatedFields.success) {
      return { error: "Invalid fields", details: validatedFields.error.flatten() }
    }

    const context = getTenantContext()
    if (!context) {
      return { error: "No tenant context" }
    }

    // Check for existing OIB within the same company
    if (validatedFields.data.oib) {
      const existingContact = await db.contact.findFirst({
        where: { oib: validatedFields.data.oib },
      })
      if (existingContact) {
        return {
          error: "Kontakt s ovim OIB-om već postoji",
          existingContact: { id: existingContact.id, name: existingContact.name },
        }
      }
    }

    const contact = await db.contact.create({
      data: {
        ...validatedFields.data,
        companyId: context.companyId,
        oib: validatedFields.data.oib || null,
        vatNumber: validatedFields.data.vatNumber || null,
        address: validatedFields.data.address || null,
        city: validatedFields.data.city || null,
        postalCode: validatedFields.data.postalCode || null,
        email: validatedFields.data.email || null,
        phone: validatedFields.data.phone || null,
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

    // Check for OIB conflicts with other contacts (exclude current contact)
    if (validatedFields.data.oib) {
      const conflictingContact = await db.contact.findFirst({
        where: {
          oib: validatedFields.data.oib,
          id: { not: contactId },
        },
      })
      if (conflictingContact) {
        return {
          error: "Kontakt s ovim OIB-om već postoji",
          existingContact: { id: conflictingContact.id, name: conflictingContact.name },
        }
      }
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

export async function getContacts(
  type?: "CUSTOMER" | "SUPPLIER" | "BOTH",
  options?: { page?: number; limit?: number }
) {
  const user = await requireAuth()
  const { page = 1, limit = 50 } = options ?? {}

  return requireCompanyWithContext(user.id!, async () => {
    return db.contact.findMany({
      where: {
        ...(type && { type }),
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    })
  })
}

/**
 * Escapes SQL LIKE pattern characters (% and _) to prevent
 * unintended wildcard matching in search queries.
 */
function escapeSqlLikePattern(str: string): string {
  return str.replace(/[%_]/g, "\\$&")
}

/**
 * Sanitizes search query input by:
 * 1. Limiting length to prevent performance issues
 * 2. Trimming whitespace
 * 3. Escaping SQL LIKE wildcards
 */
function sanitizeSearchQuery(query: string, maxLength: number = 100): string {
  return escapeSqlLikePattern(query.slice(0, maxLength).trim())
}

export async function searchContacts(query: string) {
  const user = await requireAuth()

  // Sanitize the search query to prevent SQL LIKE pattern exploitation
  const sanitizedQuery = sanitizeSearchQuery(query)

  // Require minimum 2 characters for search
  if (sanitizedQuery.length < 2) {
    return []
  }

  return requireCompanyWithContext(user.id!, async () => {
    return db.contact.findMany({
      where: {
        OR: [
          { name: { contains: sanitizedQuery, mode: "insensitive" } },
          { oib: { contains: sanitizedQuery } },
          { email: { contains: sanitizedQuery, mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { name: "asc" },
    })
  })
}
