"use server"

import { auth } from "@/lib/auth"
import { prisma, Prisma } from "@fiskai/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"

const { Decimal } = Prisma

const productSchema = z.object({
  name: z.string().min(2, "Naziv mora imati najmanje 2 znaka"),
  description: z.string().optional().or(z.literal("")),
  sku: z.string().optional().or(z.literal("")),
  price: z.number().min(0, "Cijena ne može biti negativna"),
  unit: z.string().default("PCE"),
  vatRate: z.number().int().min(0).max(25),
  vatCategory: z.enum(["S", "R", "AA", "Z", "E"]).default("S"),
  isActive: z.boolean().default(true),
})

export type ProductInput = z.infer<typeof productSchema>

async function getCompanyId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Niste prijavljeni")

  const member = await prisma.companyMember.findFirst({
    where: { userId: session.user.id },
  })
  if (!member) throw new Error("Nemate pristup tvrtki")

  return member.companyId
}

export async function getProducts(params?: {
  search?: string
  status?: "ALL" | "ACTIVE" | "INACTIVE"
}) {
  const companyId = await getCompanyId()
  const { search = "", status = "ALL" } = params || {}

  const where = {
    companyId,
    ...(status === "ACTIVE" && { isActive: true }),
    ...(status === "INACTIVE" && { isActive: false }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { sku: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { name: "asc" },
  })

  // Convert Decimal to number for client
  return products.map((p) => ({
    ...p,
    price: Number(p.price),
  }))
}

export async function getProduct(id: string) {
  const companyId = await getCompanyId()
  const product = await prisma.product.findFirst({
    where: { id, companyId },
  })
  if (!product) return null
  return { ...product, price: Number(product.price) }
}

export async function createProduct(input: ProductInput) {
  try {
    const companyId = await getCompanyId()
    const parsed = productSchema.safeParse(input)

    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Neispravni podaci" }
    }

    const product = await prisma.product.create({
      data: {
        companyId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        sku: parsed.data.sku || null,
        price: new Decimal(parsed.data.price),
        unit: parsed.data.unit,
        vatRate: parsed.data.vatRate,
        vatCategory: parsed.data.vatCategory,
        isActive: parsed.data.isActive,
      },
    })

    revalidatePath("/products")
    return { success: true, productId: product.id }
  } catch (error) {
    console.error("Create product error:", error)
    return { success: false, error: "Greška pri stvaranju proizvoda" }
  }
}

export async function updateProduct(id: string, input: ProductInput) {
  try {
    const companyId = await getCompanyId()
    const parsed = productSchema.safeParse(input)

    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Neispravni podaci" }
    }

    await prisma.product.update({
      where: { id, companyId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        sku: parsed.data.sku || null,
        price: new Decimal(parsed.data.price),
        unit: parsed.data.unit,
        vatRate: parsed.data.vatRate,
        vatCategory: parsed.data.vatCategory,
        isActive: parsed.data.isActive,
      },
    })

    revalidatePath("/products")
    return { success: true }
  } catch (error) {
    console.error("Update product error:", error)
    return { success: false, error: "Greška pri ažuriranju proizvoda" }
  }
}

export async function deleteProduct(id: string) {
  try {
    const companyId = await getCompanyId()
    await prisma.product.delete({
      where: { id, companyId },
    })
    revalidatePath("/products")
    return { success: true }
  } catch (error) {
    console.error("Delete product error:", error)
    return { success: false, error: "Greška pri brisanju proizvoda" }
  }
}

export async function updateProductInline(id: string, data: { price?: number; isActive?: boolean }) {
  try {
    const companyId = await getCompanyId()
    await prisma.product.update({
      where: { id, companyId },
      data: {
        ...(data.price !== undefined && { price: new Decimal(data.price) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
    revalidatePath("/products")
    return { success: true }
  } catch (error) {
    console.error("Update product inline error:", error)
    return { success: false, error: "Greška pri ažuriranju" }
  }
}
