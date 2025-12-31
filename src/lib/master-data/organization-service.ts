import type { TransactionClient } from "@/lib/db"
import { normalizeAddress, normalizeName, normalizeOptionalName } from "@/lib/people/normalization"

export type OrganizationSeed = {
  name: string
  oib?: string | null
  vatNumber?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
  country?: string | null
}

export type OrganizationUpsertResult = {
  organizationId: string
  addressId: string | null
}

const DEFAULT_COUNTRY = "HR"

function normalizeOrganizationSeed(input: OrganizationSeed) {
  const { display, normalized } = normalizeName(input.name)

  return {
    legalName: display,
    normalizedLegalName: normalized,
    oib: normalizeOptionalName(input.oib),
    vatNumber: normalizeOptionalName(input.vatNumber),
    email: normalizeOptionalName(input.email),
    phone: normalizeOptionalName(input.phone),
    addressLine1: normalizeAddress(input.address),
    city: normalizeAddress(input.city),
    postalCode: normalizeAddress(input.postalCode),
    country: normalizeOptionalName(input.country)?.toUpperCase() ?? DEFAULT_COUNTRY,
  }
}

async function findOrganizationByTaxId(
  tx: TransactionClient,
  companyId: string,
  type: "OIB" | "VAT",
  value: string
) {
  const taxIdentity = await tx.taxIdentity.findFirst({
    where: {
      companyId,
      type,
      value,
      organizationId: { not: null },
    },
    select: { organizationId: true },
  })

  if (!taxIdentity?.organizationId) return null

  return tx.organization.findFirst({
    where: { id: taxIdentity.organizationId, companyId },
  })
}

async function upsertAddress(
  tx: TransactionClient,
  companyId: string,
  input: ReturnType<typeof normalizeOrganizationSeed>
) {
  if (!input.addressLine1 || !input.city) {
    return null
  }

  const existing = await tx.address.findFirst({
    where: {
      companyId,
      line1: input.addressLine1,
      line2: null,
      city: input.city,
      postalCode: input.postalCode,
      country: input.country,
    },
    select: { id: true },
  })

  if (existing) {
    return existing.id
  }

  const created = await tx.address.create({
    data: {
      companyId,
      line1: input.addressLine1,
      line2: null,
      city: input.city,
      postalCode: input.postalCode,
      country: input.country,
    },
    select: { id: true },
  })

  return created.id
}

async function upsertTaxIdentity(
  tx: TransactionClient,
  companyId: string,
  organizationId: string,
  type: "OIB" | "VAT",
  value: string,
  country: string
) {
  await tx.taxIdentity.upsert({
    where: {
      companyId_type_value: {
        companyId,
        type,
        value,
      },
    },
    create: {
      companyId,
      organizationId,
      type,
      value,
      country,
    },
    update: {
      organizationId,
      country,
    },
  })
}

export async function upsertOrganizationFromContact(
  tx: TransactionClient,
  companyId: string,
  input: OrganizationSeed,
  existingOrganizationId?: string | null
): Promise<OrganizationUpsertResult> {
  const normalized = normalizeOrganizationSeed(input)

  let organization = existingOrganizationId
    ? await tx.organization.findFirst({
        where: { id: existingOrganizationId, companyId },
      })
    : null

  if (!organization && normalized.oib) {
    organization = await findOrganizationByTaxId(tx, companyId, "OIB", normalized.oib)
  }

  if (!organization && normalized.vatNumber) {
    organization = await findOrganizationByTaxId(tx, companyId, "VAT", normalized.vatNumber)
  }

  if (!organization) {
    organization = await tx.organization.findFirst({
      where: { companyId, normalizedLegalName: normalized.normalizedLegalName },
    })
  }

  if (!organization) {
    organization = await tx.organization.create({
      data: {
        companyId,
        legalName: normalized.legalName,
        normalizedLegalName: normalized.normalizedLegalName,
        email: normalized.email,
        phone: normalized.phone,
      },
    })
  } else {
    organization = await tx.organization.update({
      where: { id: organization.id },
      data: {
        legalName: normalized.legalName,
        normalizedLegalName: normalized.normalizedLegalName,
        email: normalized.email,
        phone: normalized.phone,
      },
    })
  }

  const addressId = await upsertAddress(tx, companyId, normalized)

  if (addressId && organization.primaryAddressId !== addressId) {
    await tx.organization.update({
      where: { id: organization.id },
      data: { primaryAddressId: addressId },
    })
  }

  if (normalized.oib) {
    await upsertTaxIdentity(
      tx,
      companyId,
      organization.id,
      "OIB",
      normalized.oib,
      normalized.country
    )
  }

  if (normalized.vatNumber) {
    await upsertTaxIdentity(
      tx,
      companyId,
      organization.id,
      "VAT",
      normalized.vatNumber,
      normalized.country
    )
  }

  return { organizationId: organization.id, addressId }
}
