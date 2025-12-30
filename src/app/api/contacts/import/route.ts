import { NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { upsertOrganizationFromContact } from "@/lib/master-data/organization-service"

const rowSchema = z.object({
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
  name: z.string().min(1),
  oib: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  paymentTermsDays: z.number().int().min(0).max(365).optional(),
})

const importSchema = z.object({
  rows: z.array(rowSchema).max(500),
})

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)

    if (!company) {
      return NextResponse.json({ error: "No company found" }, { status: 404 })
    }

    const body = await request.json()
    const parsed = importSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Neispravni podaci" }, { status: 400 })
    }

    const rows = parsed.data.rows.filter((row) => row.name.trim().length > 0)
    if (rows.length === 0) {
      return NextResponse.json({ error: "Prazan CSV" }, { status: 400 })
    }

    // Check for duplicate OIBs within the import
    const oibs = rows.map((r) => r.oib).filter(Boolean) as string[]
    const duplicateOibs = oibs.filter((oib, i) => oibs.indexOf(oib) !== i)
    if (duplicateOibs.length > 0) {
      return NextResponse.json(
        { error: `Duplikat OIB u CSV-u: ${duplicateOibs[0]}` },
        { status: 400 }
      )
    }

    // Check for existing OIBs in database
    if (oibs.length > 0) {
      const existingContacts = await db.contact.findMany({
        where: {
          companyId: company.id,
          oib: { in: oibs },
        },
        select: { oib: true },
      })
      if (existingContacts.length > 0) {
        return NextResponse.json(
          { error: `Kontakt s OIB-om ${existingContacts[0].oib} vec postoji` },
          { status: 400 }
        )
      }
    }

    await db.$transaction(async (tx) => {
      for (const row of rows) {
        const { organizationId } = await upsertOrganizationFromContact(tx, company.id, {
          name: row.name,
          oib: row.oib,
          email: row.email,
          phone: row.phone,
          address: row.address,
          city: row.city,
          postalCode: row.postalCode,
          country: row.country,
        })

        await tx.contact.create({
          data: {
            companyId: company.id,
            type: row.type,
            name: row.name,
            oib: row.oib || null,
            email: row.email || null,
            phone: row.phone || null,
            address: row.address || null,
            city: row.city || null,
            postalCode: row.postalCode || null,
            country: row.country || "HR",
            paymentTermsDays: row.paymentTermsDays ?? 15,
            organizationId,
          },
        })
      }
    })

    revalidatePath("/contacts")
    return NextResponse.json({ success: true, created: rows.length })
  } catch (error) {
    console.error("Import failed", error)
    return NextResponse.json({ error: "Greska pri uvozu" }, { status: 500 })
  }
}
