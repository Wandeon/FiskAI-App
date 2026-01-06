#!/usr/bin/env npx tsx
/**
 * Phase 5 Remediation: Provision IntegrationAccounts
 *
 * Creates IntegrationAccount records for companies with e-invoice activity.
 * Supports --dry-run (default) and --apply modes.
 */

import { db } from "@/lib/db"
import { IntegrationKind, IntegrationEnv, IntegrationStatus } from "@prisma/client"
import { randomUUID } from "crypto"

interface ProvisioningTarget {
  companyId: string
  companyName: string
  kind: IntegrationKind
  environment: IntegrationEnv
  reason: string
}

// Map provider strings to IntegrationKind
function mapProviderToKind(provider: string | null): IntegrationKind | null {
  if (!provider) return null
  switch (provider.toLowerCase()) {
    case "eposlovanje":
      return IntegrationKind.EINVOICE_EPOSLOVANJE
    case "fina":
      return IntegrationKind.EINVOICE_FINA
    case "ie-racuni":
    case "ieracuni":
      return IntegrationKind.EINVOICE_IE_RACUNI
    case "mock":
      // Mock provider - for testing, use eposlovanje kind in TEST environment
      return IntegrationKind.EINVOICE_EPOSLOVANJE
    default:
      return null
  }
}

async function identifyTargets(): Promise<ProvisioningTarget[]> {
  const targets: ProvisioningTarget[] = []

  // Get companies with e-invoice entitlement or e-invoice provider set
  const companies = await db.company.findMany({
    select: {
      id: true,
      name: true,
      eInvoiceProvider: true,
      entitlements: true,
      fiscalEnabled: true,
    },
  })

  // Get companies with EInvoice activity (even without entitlement)
  const companiesWithEinvoices = await db.eInvoice.groupBy({
    by: ["companyId"],
    _count: true,
  })
  const companyEinvoiceCounts = new Map(companiesWithEinvoices.map((c) => [c.companyId, c._count]))

  for (const company of companies) {
    const entitlements = company.entitlements as string[] | null
    const hasEinvoiceEntitlement =
      entitlements?.includes("e-invoicing") || entitlements?.includes("eInvoicing")
    const hasEinvoiceActivity = (companyEinvoiceCounts.get(company.id) || 0) > 0

    // Determine if this company needs an IntegrationAccount
    if (hasEinvoiceEntitlement || hasEinvoiceActivity || company.eInvoiceProvider) {
      const kind = mapProviderToKind(company.eInvoiceProvider)

      if (!kind) {
        // If no provider set but has activity, check EInvoice records for provider hint
        if (hasEinvoiceActivity && !company.eInvoiceProvider) {
          // Default to EPOSLOVANJE as that's the primary provider
          targets.push({
            companyId: company.id,
            companyName: company.name,
            kind: IntegrationKind.EINVOICE_EPOSLOVANJE,
            environment: IntegrationEnv.PROD,
            reason: "Has EInvoice activity, defaulting to EPOSLOVANJE",
          })
        }
        continue
      }

      // Determine environment based on provider config
      // If provider is "mock", use TEST, otherwise PROD
      const environment =
        company.eInvoiceProvider?.toLowerCase() === "mock"
          ? IntegrationEnv.TEST
          : IntegrationEnv.PROD

      targets.push({
        companyId: company.id,
        companyName: company.name,
        kind,
        environment,
        reason: hasEinvoiceEntitlement
          ? "Has e-invoice entitlement"
          : hasEinvoiceActivity
            ? "Has EInvoice activity"
            : "Has e-invoice provider configured",
      })
    }

    // Check for fiscalization need
    if (company.fiscalEnabled) {
      targets.push({
        companyId: company.id,
        companyName: company.name,
        kind: IntegrationKind.FISCALIZATION_CIS,
        environment: IntegrationEnv.PROD,
        reason: "Has fiscalization enabled",
      })
    }
  }

  return targets
}

async function checkExisting(
  targets: ProvisioningTarget[]
): Promise<{ toCreate: ProvisioningTarget[]; existing: string[] }> {
  const toCreate: ProvisioningTarget[] = []
  const existing: string[] = []

  for (const target of targets) {
    const existingAccount = await db.integrationAccount.findFirst({
      where: {
        companyId: target.companyId,
        kind: target.kind,
        environment: target.environment,
      },
    })

    if (existingAccount) {
      existing.push(
        `${target.companyName} (${target.companyId}): ${target.kind} ${target.environment} - already exists (${existingAccount.id})`
      )
    } else {
      toCreate.push(target)
    }
  }

  return { toCreate, existing }
}

async function provision(apply: boolean) {
  console.log("=".repeat(60))
  console.log("PHASE 5: INTEGRATION ACCOUNT PROVISIONING")
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`)
  console.log("Timestamp:", new Date().toISOString())
  console.log("=".repeat(60))

  // Identify targets
  console.log("\n=== IDENTIFYING TARGETS ===")
  const targets = await identifyTargets()
  console.log(`Found ${targets.length} provisioning targets`)

  for (const t of targets) {
    console.log(`  ${t.companyName} (${t.companyId}): ${t.kind} ${t.environment}`)
    console.log(`    Reason: ${t.reason}`)
  }

  // Check for existing accounts
  console.log("\n=== CHECKING EXISTING ACCOUNTS ===")
  const { toCreate, existing } = await checkExisting(targets)

  if (existing.length > 0) {
    console.log("Already exist (skipping):")
    for (const e of existing) {
      console.log(`  ${e}`)
    }
  }

  if (toCreate.length === 0) {
    console.log("\nNo new IntegrationAccounts to create.")
    await db.$disconnect()
    return
  }

  console.log(`\nWill create ${toCreate.length} new IntegrationAccounts:`)
  for (const t of toCreate) {
    console.log(`  ${t.companyName}: ${t.kind} ${t.environment}`)
  }

  if (!apply) {
    console.log("\n[DRY-RUN] No changes made. Run with --apply to create accounts.")
    await db.$disconnect()
    return
  }

  // Create accounts
  console.log("\n=== CREATING INTEGRATION ACCOUNTS ===")
  const created: Array<{ id: string; companyId: string; kind: string; environment: string }> = []

  for (const target of toCreate) {
    try {
      // For now, create with minimal config - secrets will be encrypted when API keys are added
      const account = await db.integrationAccount.create({
        data: {
          companyId: target.companyId,
          kind: target.kind,
          environment: target.environment,
          status: IntegrationStatus.ACTIVE,
          // providerConfig and secretEnvelope omitted - will use global env vars
          // and be populated when company-specific keys are added
        },
      })

      created.push({
        id: account.id,
        companyId: account.companyId,
        kind: account.kind,
        environment: account.environment,
      })

      console.log(`  ✓ Created ${account.id} for ${target.companyName}`)
    } catch (error) {
      console.error(`  ✗ Failed to create for ${target.companyName}:`, error)
    }
  }

  console.log("\n=== PROVISIONING SUMMARY ===")
  console.log(`Created: ${created.length}`)
  console.log(`Skipped (existing): ${existing.length}`)
  console.log(`Total targets: ${targets.length}`)

  if (created.length > 0) {
    console.log("\nCreated accounts:")
    console.table(created)
  }

  await db.$disconnect()
}

// Parse args
const args = process.argv.slice(2)
const apply = args.includes("--apply")

provision(apply).catch(async (error) => {
  console.error("Provisioning failed:", error)
  await db.$disconnect()
  process.exit(1)
})
