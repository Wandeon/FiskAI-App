import { db } from "@/lib/db"
import { IntegrationKind, IntegrationEnv, IntegrationStatus, Prisma } from "@prisma/client"
import { encryptSecretEnvelope, decryptSecretEnvelope, hasSecretEnvelope } from "./vault"
import type { EInvoiceSecrets, FiscalizationSecrets } from "./types"

export interface CreateIntegrationAccountInput {
  companyId: string
  kind: IntegrationKind
  environment: IntegrationEnv
  secrets: EInvoiceSecrets | FiscalizationSecrets
  providerConfig?: Prisma.JsonValue
}

export interface IntegrationAccountWithSecrets {
  id: string
  companyId: string
  kind: IntegrationKind
  environment: IntegrationEnv
  status: IntegrationStatus
  providerConfig: Prisma.JsonValue | null
  secrets: EInvoiceSecrets | FiscalizationSecrets
  createdAt: Date
  updatedAt: Date
  rotatedAt: Date | null
  lastUsedAt: Date | null
}

/**
 * Creates a new IntegrationAccount with encrypted secrets.
 */
export async function createIntegrationAccount(
  input: CreateIntegrationAccountInput
): Promise<
  { id: string; secretEnvelope: string; status: string } & Omit<
    CreateIntegrationAccountInput,
    "secrets"
  >
> {
  const { envelope, keyVersion } = encryptSecretEnvelope(input.secrets)

  const account = await db.integrationAccount.create({
    data: {
      companyId: input.companyId,
      kind: input.kind,
      environment: input.environment,
      status: "ACTIVE",
      providerConfig: input.providerConfig ?? Prisma.JsonNull,
      secretEnvelope: envelope,
      secretKeyVersion: keyVersion,
    },
  })

  if (!account.secretEnvelope) {
    throw new Error(
      `Failed to create integration account: secretEnvelope is null for account ${account.id}`
    )
  }

  return {
    id: account.id,
    companyId: account.companyId,
    kind: account.kind,
    environment: account.environment,
    status: account.status,
    providerConfig: account.providerConfig,
    secretEnvelope: account.secretEnvelope,
  }
}

/**
 * Finds an active IntegrationAccount and decrypts its secrets.
 * Returns null if not found or not active.
 */
export async function findIntegrationAccount(
  companyId: string,
  kind: IntegrationKind,
  environment: IntegrationEnv
): Promise<IntegrationAccountWithSecrets | null> {
  const account = await db.integrationAccount.findUnique({
    where: {
      companyId_kind_environment: { companyId, kind, environment },
    },
  })

  if (!account || account.status !== "ACTIVE") {
    return null
  }

  if (!hasSecretEnvelope(account)) {
    return null
  }

  const secrets = decryptSecretEnvelope<EInvoiceSecrets | FiscalizationSecrets>(
    account.secretEnvelope,
    account.secretKeyVersion
  )

  return {
    id: account.id,
    companyId: account.companyId,
    kind: account.kind,
    environment: account.environment,
    status: account.status,
    providerConfig: account.providerConfig,
    secrets,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    rotatedAt: account.rotatedAt,
    lastUsedAt: account.lastUsedAt,
  }
}

/**
 * Finds an active IntegrationAccount by ID and decrypts its secrets.
 * Returns null if not found, not active, or missing secret envelope.
 *
 * Note: This function filters by status=ACTIVE for consistency with findIntegrationAccount.
 * If you need to retrieve disabled accounts, query the database directly.
 */
export async function findIntegrationAccountById(
  id: string
): Promise<IntegrationAccountWithSecrets | null> {
  const account = await db.integrationAccount.findUnique({
    where: { id },
  })

  if (!account || account.status !== "ACTIVE" || !hasSecretEnvelope(account)) {
    return null
  }

  const secrets = decryptSecretEnvelope<EInvoiceSecrets | FiscalizationSecrets>(
    account.secretEnvelope,
    account.secretKeyVersion
  )

  return {
    id: account.id,
    companyId: account.companyId,
    kind: account.kind,
    environment: account.environment,
    status: account.status,
    providerConfig: account.providerConfig,
    secrets,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    rotatedAt: account.rotatedAt,
    lastUsedAt: account.lastUsedAt,
  }
}

/**
 * Updates secrets (key rotation).
 */
export async function updateIntegrationAccountSecrets(
  id: string,
  secrets: EInvoiceSecrets | FiscalizationSecrets
): Promise<{ id: string; secretEnvelope: string; rotatedAt: Date }> {
  const { envelope, keyVersion } = encryptSecretEnvelope(secrets)

  const account = await db.integrationAccount.update({
    where: { id },
    data: {
      secretEnvelope: envelope,
      secretKeyVersion: keyVersion,
      rotatedAt: new Date(),
    },
  })

  if (!account.secretEnvelope) {
    throw new Error(
      `Failed to update integration account secrets: secretEnvelope is null for account ${account.id}`
    )
  }

  if (!account.rotatedAt) {
    throw new Error(
      `Failed to update integration account secrets: rotatedAt is null for account ${account.id}`
    )
  }

  return {
    id: account.id,
    secretEnvelope: account.secretEnvelope,
    rotatedAt: account.rotatedAt,
  }
}

/**
 * Disables an IntegrationAccount.
 */
export async function disableIntegrationAccount(id: string): Promise<void> {
  await db.integrationAccount.update({
    where: { id },
    data: { status: "DISABLED" },
  })
}

/**
 * Updates lastUsedAt timestamp.
 */
export async function touchIntegrationAccount(id: string): Promise<void> {
  await db.integrationAccount.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  })
}
