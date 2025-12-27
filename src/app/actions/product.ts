"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import {
  requireAuth,
  requireCompanyWithContext,
  requireCompanyWithPermission,
} from "@/lib/auth-utils"
import { productSchema } from "@/lib/validations"
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

  return requireCompanyWithContext(user.id!, async (company) => {
    const validatedFields = productSchema.safeParse(formData)

    if (!validatedFields.success) {
      return { error: "Neispravni podaci", details: validatedFields.error.flatten() }
    }

    const product = await db.product.create({
      data: {
        ...validatedFields.data,
        companyId: company.id,
      },
    })

    revalidatePath("/products")
    return { success: "Proizvod kreiran", data: product }
  })
}

export async function updateProduct(productId: string, formData: z.infer<typeof productSchema>) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
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

    const product = await db.product.update({
      where: { id: productId },
      data: validatedFields.data,
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

  return requireCompanyWithContext(user.id!, async () => {
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

    const product = await db.product.update({
      where: { id: productId },
      data: validated.data,
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

    await db.product.delete({
      where: { id: productId },
    })

    revalidatePath("/products")
    return { success: "Proizvod obrisan" }
  })
}

export async function getProducts(activeOnly: boolean = false) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
    return db.product.findMany({
      where: {
        ...(activeOnly && { isActive: true }),
      },
      orderBy: { name: "asc" },
    })
  })
}

export async function searchProducts(query: string) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async () => {
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
