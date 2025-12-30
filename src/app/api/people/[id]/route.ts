import { NextResponse } from "next/server"
import { getCurrentCompany, getCurrentUser } from "@/lib/auth-utils"
import { db, runWithTenant } from "@/lib/db"
import { personSchema } from "@/lib/validations/person"
import { requirePermission } from "@/lib/rbac"
import {
  buildPersonSnapshot,
  normalizePersonUpdate,
  type PersonWithRoles,
} from "@/lib/people/person-service"
import { applyPersonRoles } from "@/lib/people/person-role-service"
import { Prisma } from "@prisma/client"

const updateSchema = personSchema.partial()

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await getCurrentCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "No company found" }, { status: 404 })
  }

  await requirePermission(user.id!, company.id, "person:read")

  const { id } = await context.params

  const person = await runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
    return db.person.findFirst({
      where: { id, companyId: company.id },
      include: { contactRoles: true, employeeRoles: true, directorRoles: true },
    })
  })

  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 })
  }

  return NextResponse.json({ data: person })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await getCurrentCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "No company found" }, { status: 404 })
  }

  await requirePermission(user.id!, company.id, "person:update")

  const { id } = await context.params

  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      )
    }

    const person = await runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
      return db.$transaction(async (tx) => {
        const existing = (await tx.person.findFirst({
          where: { id, companyId: company.id },
          include: { contactRoles: true, employeeRoles: true, directorRoles: true },
        })) as PersonWithRoles | null

        if (!existing) {
          return null
        }

        const normalized = normalizePersonUpdate(parsed.data, existing)

        const roleEvents = await applyPersonRoles({
          tx,
          companyId: company.id,
          personId: existing.id,
          roles: normalized.roles,
          existingRoles: {
            contactRoles: existing.contactRoles,
            employeeRoles: existing.employeeRoles,
            directorRoles: existing.directorRoles,
          },
        })

        await tx.personSnapshot.create({
          data: {
            companyId: company.id,
            personId: existing.id,
            action: "UPDATE",
            data: buildPersonSnapshot(existing),
            capturedByUserId: user.id,
          },
        })

        await tx.person.update({
          where: { id: existing.id },
          data: {
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

        await tx.personEvent.create({
          data: {
            companyId: company.id,
            personId: existing.id,
            eventType: "PERSON_UPDATED",
            payload: {
              personId: existing.id,
              fullName: normalized.fullName,
              oib: normalized.oib,
            },
          },
        })

        if (roleEvents.length > 0) {
          await tx.personEvent.createMany({
            data: roleEvents.map((event) => ({
              companyId: company.id,
              personId: existing.id,
              eventType: event.type,
              payload: event.payload,
            })),
          })
        }

        return (await tx.person.findUnique({
          where: { id: existing.id },
          include: { contactRoles: true, employeeRoles: true, directorRoles: true },
        })) as PersonWithRoles
      })
    })

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 })
    }

    return NextResponse.json({ data: person })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Duplicate person detected" }, { status: 409 })
    }

    if (error instanceof Error && error.message.includes("Invalid IBAN")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Failed to update person", error)
    return NextResponse.json({ error: "Failed to update person" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await getCurrentCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "No company found" }, { status: 404 })
  }

  await requirePermission(user.id!, company.id, "person:delete")

  const { id } = await context.params

  const deleted = await runWithTenant({ companyId: company.id, userId: user.id! }, async () => {
    return db.$transaction(async (tx) => {
      const existing = (await tx.person.findFirst({
        where: { id, companyId: company.id },
        include: { contactRoles: true, employeeRoles: true, directorRoles: true },
      })) as PersonWithRoles | null

      if (!existing) {
        return null
      }

      await tx.personSnapshot.create({
        data: {
          companyId: company.id,
          personId: existing.id,
          action: "DELETE",
          data: buildPersonSnapshot(existing),
          capturedByUserId: user.id,
        },
      })

      await tx.person.delete({ where: { id: existing.id } })

      await tx.personEvent.create({
        data: {
          companyId: company.id,
          personId: existing.id,
          eventType: "PERSON_DELETED",
          payload: { personId: existing.id },
        },
      })

      return existing
    })
  })

  if (!deleted) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 })
  }

  return NextResponse.json({ data: deleted })
}
