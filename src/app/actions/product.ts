"use server"

import { z } from "zod"
import { db, getTenantContext } from "@/lib/db"
import {
  requireAuth,
  requireCompanyWithContext,
  requireCompanyWithPermission,
} from "@/lib/auth-utils"
import { productSchema, getVatRateFromCategory } from "@/lib/validations"
import { revalidatePath } from "next/cache"

const productInlineSchema = productSchema.pick({
  name: true,
  sku: true,
  description: true,
  unit: true,
  price: true,
  vatRate: true,
  vatCategory: true,
  isActive: true,
})

export async function createProduct(formData: z.infer<typeof productSchema>) {
  const user = await requireAuth()

  return requireCompanyWithPermission(user.id!, "product:create", async () => {
    const validatedFields = productSchema.safeParse(formData)

    if (!validatedFields.success) {
      return { error: "Neispravni podaci", details: validatedFields.error.flatten() }
    }

    const context = getTenantContext()
    if (!context) {
      return { error: "Nedostaje kontekst tvrtke" }
    }

    // Derive vatRate from vatCategory to ensure consistency
    const vatRate = getVatRateFromCategory(validatedFields.data.vatCategory)

    const product = await db.product.create({
      data: {
        ...validatedFields.data,
        vatRate,
        companyId: context.companyId,
        description: validatedFields.data.description || null,
        sku: validatedFields.data.sku || null,
      },
    })

    revalidatePath("/products")
    return { success: "Proizvod kreiran", data: product }
  })
}

export async function updateProduct(productId: string, formData: z.infer<typeof productSchema>) {
  const user = await requireAuth()

  return requireCompanyWithPermission(user.id!, "product:update", async () => {
    const existingProduct = await db.product.findFirst({
      where: { id: productId },
    })

    if (!existingProduct) {
      return { error: "Proizvod nije pronađen" }
    }

    const validatedFields = productSchema.safeParse(formData)

    if (!validatedFields.success) {
      return { error: "Neispravni podaci", details: validatedFields.error.flatten() }
    }

    // Derive vatRate from vatCategory to ensure consistency
    const vatRate = getVatRateFromCategory(validatedFields.data.vatCategory)

    const product = await db.product.update({
      where: { id: productId },
      data: {
        ...validatedFields.data,
        vatRate,
      },
    })

    revalidatePath("/products")
    return { success: "Proizvod ažuriran", data: product }
  })
}

export async function updateProductInline(
  productId: string,
  partial: Partial<z.infer<typeof productInlineSchema>>
) {
  const user = await requireAuth()

  return requireCompanyWithPermission(user.id!, "product:update", async () => {
    const existing = await db.product.findFirst({
      where: { id: productId },
    })

    if (!existing) {
      return { error: "Proizvod nije pronađen" }
    }

    const merged = {
      name: existing.name,
      sku: existing.sku,
      description: existing.description,
      unit: existing.unit,
      price: existing.price,
      vatRate: existing.vatRate,
      vatCategory: existing.vatCategory,
      isActive: existing.isActive,
      ...partial,
    }

    const validated = productInlineSchema.safeParse(merged)
    if (!validated.success) {
      return { error: "Neispravni podaci", details: validated.error.flatten() }
    }

    // Derive vatRate from vatCategory to ensure consistency
    const vatRate = getVatRateFromCategory(validated.data.vatCategory)

    const product = await db.product.update({
      where: { id: productId },
      data: {
        ...validated.data,
        vatRate,
      },
    })

    revalidatePath("/products")
    return { success: "Proizvod ažuriran", data: product }
  })
}

export async function deleteProduct(productId: string) {
  const user = await requireAuth()

  return requireCompanyWithPermission(user.id!, "product:delete", async () => {
    const product = await db.product.findFirst({
      where: { id: productId },
    })

    if (!product) {
      return { error: "Proizvod nije pronađen" }
    }

    // Note: Products are not directly referenced in invoice lines (data is stored inline for fiscal compliance).
    // However, we prevent deletion of products that may have historical usage.
    // Check if the product was created more than 24 hours ago - if so, it may have been used in invoices.
    const createdMoreThan24HoursAgo =
      new Date(product.createdAt).getTime() < Date.now() - 24 * 60 * 60 * 1000

    if (createdMoreThan24HoursAgo) {
      return {
        error:
          "Nije moguće obrisati proizvod koji postoji duže od 24 sata. Proizvod bi mogao biti korišten u računima. Umjesto brisanja, deaktivirajte proizvod.",
      }
    }

    await db.product.delete({
      where: { id: productId },
    })

    revalidatePath("/products")
    return { success: "Proizvod obrisan" }
  })
}

export async function getProducts(
  activeOnly: boolean = false,
  options?: { page?: number; limit?: number }
) {
  const user = await requireAuth()
  const { page = 1, limit = 50 } = options ?? {}

  return requireCompanyWithPermission(user.id!, "product:read", async () => {
    return db.product.findMany({
      where: {
        ...(activeOnly && { isActive: true }),
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    })
  })
}

export async function searchProducts(query: string) {
  const user = await requireAuth()

  return requireCompanyWithPermission(user.id!, "product:read", async () => {
    return db.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { sku: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 10,
      orderBy: { name: "asc" },
    })
  })
}
