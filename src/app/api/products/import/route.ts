import { NextResponse } from "next/server"
import { requireAuth, requireCompanyWithContext } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { sanitizeCsvValue } from "@/lib/csv-sanitize"

const rowSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  unit: z.string().optional(),
  price: z.number().optional(),
  vatRate: z.number().optional(),
  vatCategory: z.string().optional(),
})

const importSchema = z.object({
  rows: z.array(rowSchema).max(500),
})

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async () => {
      const body = await request.json()
      const parsed = importSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: "Neispravni podaci" }, { status: 400 })
      }

      const rows = parsed.data.rows.filter((row) => row.name.trim().length > 0)
      if (rows.length === 0) {
        return NextResponse.json({ error: "Prazan CSV" }, { status: 400 })
      }

      await db.$transaction(
        rows.map((row) =>
          db.product.create({
            data: {
              // companyId auto-applied by tenant isolation extension
              // Sanitize string values to prevent CSV formula injection (fixes #858)
              name: sanitizeCsvValue(row.name),
              sku: row.sku ? sanitizeCsvValue(row.sku) : null,
              unit: row.unit ? sanitizeCsvValue(row.unit) : "kom",
              price: row.price ?? 0,
              vatRate: row.vatRate ?? 25,
              vatCategory: row.vatCategory ? sanitizeCsvValue(row.vatCategory) : "S",
              description: null,
              isActive: true,
            },
          })
        )
      )

      revalidatePath("/products")
      return NextResponse.json({ success: true, created: rows.length })
    })
  } catch (error) {
    console.error("Import failed", error)
    return NextResponse.json({ error: "Greška pri uvozu" }, { status: 500 })
  }
}
