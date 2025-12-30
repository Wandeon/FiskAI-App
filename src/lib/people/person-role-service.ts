import type {
  PersonContactRole,
  PersonDirectorRole,
  PersonEmployeeRole,
  Prisma,
} from "@prisma/client"
import type { PersonInput } from "@/lib/validations/person"

export type ExistingPersonRoles = {
  contactRoles: PersonContactRole[]
  employeeRoles: PersonEmployeeRole[]
  directorRoles: PersonDirectorRole[]
}

type ApplyPersonRolesInput = {
  tx: Prisma.TransactionClient
  companyId: string
  personId: string
  roles?: PersonInput["roles"]
  existingRoles: ExistingPersonRoles
}

export async function applyPersonRoles({
  tx,
  companyId,
  personId,
  roles,
  existingRoles,
}: ApplyPersonRolesInput) {
  const roleEvents: Array<{ type: Prisma.PersonEventType; payload: Record<string, unknown> }> = []

  if (roles === undefined) {
    return roleEvents
  }

  const contactInput = roles?.contact
  if (contactInput === null) {
    if (existingRoles.contactRoles.length > 0) {
      await tx.personContactRole.delete({
        where: { companyId_personId: { companyId, personId } },
      })
      roleEvents.push({ type: "CONTACT_ROLE_REMOVED", payload: { personId } })
    }
  } else if (contactInput) {
    if (existingRoles.contactRoles.length === 0) {
      roleEvents.push({ type: "CONTACT_ROLE_ASSIGNED", payload: { role: contactInput } })
    }
    await tx.personContactRole.upsert({
      where: { companyId_personId: { companyId, personId } },
      create: {
        companyId,
        personId,
        type: contactInput.type,
        paymentTermsDays: contactInput.paymentTermsDays ?? 15,
        notes: contactInput.notes ?? null,
      },
      update: {
        type: contactInput.type,
        paymentTermsDays: contactInput.paymentTermsDays ?? 15,
        notes: contactInput.notes ?? null,
      },
    })
  }

  const employeeInput = roles?.employee
  if (employeeInput === null) {
    if (existingRoles.employeeRoles.length > 0) {
      await tx.personEmployeeRole.delete({
        where: { companyId_personId: { companyId, personId } },
      })
      roleEvents.push({ type: "EMPLOYEE_ROLE_REMOVED", payload: { personId } })
    }
  } else if (employeeInput) {
    if (existingRoles.employeeRoles.length === 0) {
      roleEvents.push({ type: "EMPLOYEE_ROLE_ASSIGNED", payload: { role: employeeInput } })
    }
    await tx.personEmployeeRole.upsert({
      where: { companyId_personId: { companyId, personId } },
      create: {
        companyId,
        personId,
        jobTitle: employeeInput.jobTitle ?? null,
        startDate: employeeInput.startDate ?? null,
        endDate: employeeInput.endDate ?? null,
      },
      update: {
        jobTitle: employeeInput.jobTitle ?? null,
        startDate: employeeInput.startDate ?? null,
        endDate: employeeInput.endDate ?? null,
      },
    })
  }

  const directorInput = roles?.director
  if (directorInput === null) {
    if (existingRoles.directorRoles.length > 0) {
      await tx.personDirectorRole.delete({
        where: { companyId_personId: { companyId, personId } },
      })
      roleEvents.push({ type: "DIRECTOR_ROLE_REMOVED", payload: { personId } })
    }
  } else if (directorInput) {
    if (existingRoles.directorRoles.length === 0) {
      roleEvents.push({ type: "DIRECTOR_ROLE_ASSIGNED", payload: { role: directorInput } })
    }
    await tx.personDirectorRole.upsert({
      where: { companyId_personId: { companyId, personId } },
      create: {
        companyId,
        personId,
        appointmentDate: directorInput.appointmentDate ?? null,
        resignationDate: directorInput.resignationDate ?? null,
      },
      update: {
        appointmentDate: directorInput.appointmentDate ?? null,
        resignationDate: directorInput.resignationDate ?? null,
      },
    })
  }

  return roleEvents
}
