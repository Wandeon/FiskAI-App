import { NextResponse } from "next/server"
import { getCurrentCompany, getCurrentUser } from "@/lib/auth-utils"
import { db, runWithTenant } from "@/lib/db"
import { personSchema } from "@/lib/validations/person"
import { requirePermission } from "@/lib/rbac"
import {
  buildPersonSnapshot,
  normalizePersonInput,
  type PersonWithRoles,
} from "@/lib/people/person-service"
import { applyPersonRoles } from "@/lib/people/person-role-service"
import { Prisma, PersonEventType } from "@prisma/client"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await getCurrentCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "No company found" }, { status: 404 })
  }

  await requirePermission(user.id!, company.id, "person:read")

  const people = await runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
    return db.person.findMany({
      where: { companyId: company.id },
      include: {
        contactRoles: true,
        employeeRoles: true,
        directorRoles: true,
      },
      orderBy: { createdAt: "desc" },
    })
  })

  return NextResponse.json({ data: people })
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await getCurrentCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "No company found" }, { status: 404 })
  }

  await requirePermission(user.id!, company.id, "person:create")

  try {
    const body = await request.json()
    const parsed = personSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      )
    }

    const normalized = normalizePersonInput(parsed.data)

    const person = await runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
      return db.$transaction(async (tx) => {
        const created = await tx.person.create({
          data: {
            companyId: company.id,
            fullName: normalized.fullName,
            normalizedFullName: normalized.normalizedFullName,
            firstName: normalized.firstName,
            lastName: normalized.lastName,
            oib: normalized.oib,
            email: normalized.email,
            phone: normalized.phone,
            iban: normalized.iban,
            addressLine1: normalized.addressLine1,
            addressLine2: normalized.addressLine2,
            city: normalized.city,
            postalCode: normalized.postalCode,
            country: normalized.country,
          },
        })

        const roleEvents = await applyPersonRoles({
          tx,
          companyId: company.id,
          personId: created.id,
          roles: normalized.roles,
          existingRoles: {
            contactRoles: [],
            employeeRoles: [],
            directorRoles: [],
          },
        })

        const withRoles = (await tx.person.findUnique({
          where: { id: created.id },
          include: { contactRoles: true, employeeRoles: true, directorRoles: true },
        })) as PersonWithRoles

        await tx.personSnapshot.create({
          data: {
            companyId: company.id,
            personId: created.id,
            action: "CREATE",
            data: buildPersonSnapshot(withRoles),
            capturedByUserId: user.id,
          },
        })

        await tx.personEvent.create({
          data: {
            companyId: company.id,
            personId: created.id,
            eventType: "PERSON_CREATED",
            payload: {
              personId: created.id,
              fullName: created.fullName,
              oib: created.oib,
            },
          },
        })

        if (roleEvents.length > 0) {
          await tx.personEvent.createMany({
            data: roleEvents.map((event) => ({
              companyId: company.id,
              personId: created.id,
              eventType: event.type as PersonEventType,
              payload: event.payload,
            })),
          })
        }

        return withRoles
      })
    })

    return NextResponse.json({ data: person }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Duplicate person detected" }, { status: 409 })
    }

    if (error instanceof Error && error.message.includes("Invalid IBAN")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Failed to create person", error)
    return NextResponse.json({ error: "Failed to create person" }, { status: 500 })
  }
}
