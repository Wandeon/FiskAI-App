"use server"

import { z } from "zod"
import { db, getTenantContext } from "@/lib/db"
import {
  requireAuth,
  requireCompanyWithContext,
  requireCompanyWithPermission,
} from "@/lib/auth-utils"
import { contactSchema } from "@/lib/validations"
import { upsertOrganizationFromContact } from "@/lib/master-data/organization-service"
import { revalidatePath } from "next/cache"

export async function createContact(formData: z.infer<typeof contactSchema>) {
  const user = await requireAuth()

  return requireCompanyWithPermission(user.id!, "contact:create", async () => {
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

    const contact = await db.$transaction(async (tx) => {
      const { organizationId } = await upsertOrganizationFromContact(tx, context.companyId, {
        name: validatedFields.data.name,
        oib: validatedFields.data.oib,
        vatNumber: validatedFields.data.vatNumber,
        email: validatedFields.data.email,
        phone: validatedFields.data.phone,
        address: validatedFields.data.address,
        city: validatedFields.data.city,
        postalCode: validatedFields.data.postalCode,
        country: validatedFields.data.country,
      })

      return tx.contact.create({
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
          organizationId,
        },
      })
    })

    revalidatePath("/contacts")
    return { success: "Contact created", data: contact }
  })
}

export async function updateContact(contactId: string, formData: z.infer<typeof contactSchema>) {
  const user = await requireAuth()

  return requireCompanyWithPermission(user.id!, "contact:update", async () => {
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

    const contact = await db.$transaction(async (tx) => {
      const { organizationId } = await upsertOrganizationFromContact(
        tx,
        existingContact.companyId,
        {
          name: validatedFields.data.name,
          oib: validatedFields.data.oib,
          vatNumber: validatedFields.data.vatNumber,
          email: validatedFields.data.email,
          phone: validatedFields.data.phone,
          address: validatedFields.data.address,
          city: validatedFields.data.city,
          postalCode: validatedFields.data.postalCode,
          country: validatedFields.data.country,
        },
        existingContact.organizationId
      )

      return tx.contact.update({
        where: { id: contactId },
        data: {
          ...validatedFields.data,
          organizationId,
        },
      })
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

    // Check for related invoices (as buyer or seller)
    const invoiceCount = await db.eInvoice.count({
      where: {
        OR: [{ buyerId: contactId }, { sellerId: contactId }],
      },
    })

    if (invoiceCount > 0) {
      return {
        error: `Nije moguće obrisati kontakt koji je referenciran u ${invoiceCount} račun${invoiceCount === 1 ? "u" : "a"}. Brisanje bi narušilo integritet podataka i fiskalne zahtjeve za čuvanjem podataka.`,
      }
    }

    // Check for related expenses
    const expenseCount = await db.expense.count({
      where: { vendorId: contactId },
    })

    if (expenseCount > 0) {
      return {
        error: `Nije moguće obrisati kontakt koji je referenciran u ${expenseCount} trošk${expenseCount === 1 ? "u" : "a"}. Brisanje bi narušilo integritet podataka i fiskalne zahtjeve za čuvanjem podataka.`,
      }
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

  return requireCompanyWithPermission(user.id!, "contact:read", async () => {
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

  return requireCompanyWithPermission(user.id!, "contact:read", async () => {
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
