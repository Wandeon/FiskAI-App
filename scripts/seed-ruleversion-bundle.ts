#!/usr/bin/env npx tsx
/**
 * Seed RuleVersion Bundle
 *
 * Populates RuleTable and RuleVersion tables with fiscal data from
 * src/lib/fiscal-data/data/*.ts
 *
 * PR#1306: Now seeds directly to regulatory schema (dbReg).
 * Core RuleVersion bundle has been removed.
 *
 * Usage:
 *   npx tsx scripts/seed-ruleversion-bundle.ts [--dry-run]
 *
 * Options:
 *   --dry-run  Preview what would be seeded without actually inserting
 *
 * Exit codes:
 *   0 = success
 *   1 = error
 */

import { createHash } from "crypto"
import type { Prisma } from "../src/generated/regulatory-client"
import { dbReg } from "../src/lib/db/regulatory"

// Import fiscal data
import { CONTRIBUTIONS } from "../src/lib/fiscal-data/data/contributions"
import { TAX_RATES } from "../src/lib/fiscal-data/data/tax-rates"
import { POSTAL_CODES } from "../src/lib/fiscal-data/data/postal-codes"

// Rule table definitions
const RULE_TABLES = [
  { key: "VAT", name: "PDV Rates", description: "VAT/PDV rate tables" },
  {
    key: "INCOME_TAX",
    name: "Income Tax Brackets",
    description: "Income tax (porez na dohodak) brackets and rates",
  },
  {
    key: "MUNICIPALITY_INCOME_TAX",
    name: "Municipality Surtax (Prirez)",
    description: "Municipal surtax rates by postal code",
  },
  {
    key: "CONTRIBUTIONS",
    name: "Contribution Rates",
    description: "MIO/HZZO contribution rates and bases",
  },
  { key: "PER_DIEM", name: "Per Diem Rates", description: "Travel allowance rates" },
  { key: "MILEAGE", name: "Mileage Rates", description: "Mileage reimbursement rates" },
  { key: "JOPPD_CODEBOOK", name: "JOPPD Codebook", description: "JOPPD form codes and limits" },
] as const

// Parse CLI args
const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")

function hashData(data: Record<string, unknown>): string {
  const normalized = JSON.stringify(data, Object.keys(data).sort())
  return createHash("sha256").update(normalized).digest("hex")
}

async function seedRuleTables(): Promise<Map<string, string>> {
  console.log("\n--- Seeding RuleTables ---\n")
  const tableIdMap = new Map<string, string>()

  for (const table of RULE_TABLES) {
    console.log(`  ${table.key}: "${table.name}"`)

    if (dryRun) {
      tableIdMap.set(table.key, `dry-run-${table.key}`)
      console.log(`    [DRY RUN] Would create/upsert table`)
      continue
    }

    const result = await dbReg.ruleTable.upsert({
      where: { key: table.key },
      create: {
        key: table.key,
        name: table.name,
        description: table.description,
      },
      update: {
        name: table.name,
        description: table.description,
      },
    })

    tableIdMap.set(table.key, result.id)
    console.log(`    ID: ${result.id}`)
  }

  return tableIdMap
}

async function seedRuleVersions(tableIdMap: Map<string, string>): Promise<number> {
  console.log("\n--- Seeding RuleVersions ---\n")
  let count = 0

  // 1. VAT Rates
  const vatTableId = tableIdMap.get("VAT")!
  const vatData = {
    year: TAX_RATES.vat.year,
    lastVerified: TAX_RATES.vat.lastVerified,
    source: TAX_RATES.vat.source,
    standard: TAX_RATES.vat.standard,
    reduced: TAX_RATES.vat.reduced,
  }

  console.log(`  VAT: ${vatData.year} (${vatData.reduced.length + 1} rates)`)
  if (!dryRun) {
    const vatHash = hashData(vatData)
    await dbReg.ruleVersion.upsert({
      where: {
        tableId_version: { tableId: vatTableId, version: `${vatData.year}.1` },
      },
      create: {
        tableId: vatTableId,
        version: `${vatData.year}.1`,
        effectiveFrom: new Date(`${vatData.year}-01-01`),
        data: vatData as unknown as Prisma.InputJsonValue,
        dataHash: vatHash,
      },
      update: {
        data: vatData as unknown as Prisma.InputJsonValue,
        dataHash: vatHash,
      },
    })
    count++
    console.log(`    Created/updated version ${vatData.year}.1`)
  }

  // 2. Income Tax Brackets
  const incomeTaxTableId = tableIdMap.get("INCOME_TAX")!
  const incomeTaxData = {
    year: TAX_RATES.income.year,
    lastVerified: TAX_RATES.income.lastVerified,
    source: TAX_RATES.income.source,
    personalAllowance: TAX_RATES.income.personalAllowance,
    brackets: TAX_RATES.income.brackets.map((b) => ({
      min: b.min,
      max: b.max === Infinity ? null : b.max,
      rate: b.rate,
      description: b.description,
    })),
  }

  console.log(`  INCOME_TAX: ${incomeTaxData.year} (${incomeTaxData.brackets.length} brackets)`)
  if (!dryRun) {
    const hash = hashData(incomeTaxData)
    await dbReg.ruleVersion.upsert({
      where: {
        tableId_version: { tableId: incomeTaxTableId, version: `${incomeTaxData.year}.1` },
      },
      create: {
        tableId: incomeTaxTableId,
        version: `${incomeTaxData.year}.1`,
        effectiveFrom: new Date(`${incomeTaxData.year}-01-01`),
        data: incomeTaxData as unknown as Prisma.InputJsonValue,
        dataHash: hash,
      },
      update: {
        data: incomeTaxData as unknown as Prisma.InputJsonValue,
        dataHash: hash,
      },
    })
    count++
    console.log(`    Created/updated version ${incomeTaxData.year}.1`)
  }

  // 3. Municipality Income Tax (Prirez)
  const municipalityTableId = tableIdMap.get("MUNICIPALITY_INCOME_TAX")!
  const prirezEntries = Object.entries(POSTAL_CODES)
    .filter(([, data]) => data.prirezRate && data.prirezRate > 0)
    .map(([postalCode, data]) => ({
      postalCode,
      city: data.city,
      municipality: data.municipality,
      county: data.county,
      prirezRate: data.prirezRate || 0,
    }))

  const municipalityData = {
    year: 2025,
    lastVerified: "2025-01-15",
    source: "https://www.porezna-uprava.hr/",
    entries: prirezEntries,
  }

  console.log(
    `  MUNICIPALITY_INCOME_TAX: ${municipalityData.year} (${prirezEntries.length} entries)`
  )
  if (!dryRun) {
    const hash = hashData(municipalityData)
    await dbReg.ruleVersion.upsert({
      where: {
        tableId_version: { tableId: municipalityTableId, version: `${municipalityData.year}.1` },
      },
      create: {
        tableId: municipalityTableId,
        version: `${municipalityData.year}.1`,
        effectiveFrom: new Date(`${municipalityData.year}-01-01`),
        data: municipalityData as unknown as Prisma.InputJsonValue,
        dataHash: hash,
      },
      update: {
        data: municipalityData as unknown as Prisma.InputJsonValue,
        dataHash: hash,
      },
    })
    count++
    console.log(`    Created/updated version ${municipalityData.year}.1`)
  }

  // 4. Contributions
  const contributionsTableId = tableIdMap.get("CONTRIBUTIONS")!
  const contributionsData = {
    year: CONTRIBUTIONS.year,
    lastVerified: CONTRIBUTIONS.lastVerified,
    source: CONTRIBUTIONS.source,
    rates: {
      MIO_I: CONTRIBUTIONS.rates.MIO_I,
      MIO_II: CONTRIBUTIONS.rates.MIO_II,
      HZZO: CONTRIBUTIONS.rates.HZZO,
    },
    base: CONTRIBUTIONS.base,
    monthly: CONTRIBUTIONS.monthly,
  }

  console.log(`  CONTRIBUTIONS: ${contributionsData.year}`)
  if (!dryRun) {
    const hash = hashData(contributionsData)
    await dbReg.ruleVersion.upsert({
      where: {
        tableId_version: { tableId: contributionsTableId, version: `${contributionsData.year}.1` },
      },
      create: {
        tableId: contributionsTableId,
        version: `${contributionsData.year}.1`,
        effectiveFrom: new Date(`${contributionsData.year}-01-01`),
        data: contributionsData as unknown as Prisma.InputJsonValue,
        dataHash: hash,
      },
      update: {
        data: contributionsData as unknown as Prisma.InputJsonValue,
        dataHash: hash,
      },
    })
    count++
    console.log(`    Created/updated version ${contributionsData.year}.1`)
  }

  // 5. Per Diem
  const perDiemTableId = tableIdMap.get("PER_DIEM")!
  const perDiemData = {
    year: 2025,
    lastVerified: "2025-01-15",
    source: "https://www.porezna-uprava.hr/",
    domestic: {
      rate: 26.55, // EUR per day (200 HRK)
      unit: "EUR/day",
    },
    foreign: {
      rate: null, // Country-specific
      unit: "EUR/day",
      note: "Foreign per diem varies by destination country",
    },
  }

  console.log(`  PER_DIEM: ${perDiemData.year}`)
  if (!dryRun) {
    const hash = hashData(perDiemData)
    await dbReg.ruleVersion.upsert({
      where: {
        tableId_version: { tableId: perDiemTableId, version: `${perDiemData.year}.1` },
      },
      create: {
        tableId: perDiemTableId,
        version: `${perDiemData.year}.1`,
        effectiveFrom: new Date(`${perDiemData.year}-01-01`),
        data: perDiemData as unknown as Prisma.InputJsonValue,
        dataHash: hash,
      },
      update: {
        data: perDiemData as unknown as Prisma.InputJsonValue,
        dataHash: hash,
      },
    })
    count++
    console.log(`    Created/updated version ${perDiemData.year}.1`)
  }

  // 6. Mileage
  const mileageTableId = tableIdMap.get("MILEAGE")!
  const mileageData = {
    year: 2025,
    lastVerified: "2025-01-15",
    source: "https://www.porezna-uprava.hr/",
    rate: 0.4, // EUR per km (3 HRK converted)
    unit: "EUR/km",
  }

  console.log(`  MILEAGE: ${mileageData.year}`)
  if (!dryRun) {
    const hash = hashData(mileageData)
    await dbReg.ruleVersion.upsert({
      where: {
        tableId_version: { tableId: mileageTableId, version: `${mileageData.year}.1` },
      },
      create: {
        tableId: mileageTableId,
        version: `${mileageData.year}.1`,
        effectiveFrom: new Date(`${mileageData.year}-01-01`),
        data: mileageData as unknown as Prisma.InputJsonValue,
        dataHash: hash,
      },
      update: {
        data: mileageData as unknown as Prisma.InputJsonValue,
        dataHash: hash,
      },
    })
    count++
    console.log(`    Created/updated version ${mileageData.year}.1`)
  }

  // 7. JOPPD Codebook
  const joppdTableId = tableIdMap.get("JOPPD_CODEBOOK")!
  const joppdData = {
    year: 2025,
    lastVerified: "2025-01-15",
    source: "https://www.porezna-uprava.hr/Dokumentacija%20obrazaca/JOPPD.pdf",
    entries: [
      // Common income types
      { code: "0001", label: "Plaća", maxAmount: null, unit: "EUR" },
      { code: "0002", label: "Naknada plaće", maxAmount: null, unit: "EUR" },
      { code: "0005", label: "Dohodak od samostalne djelatnosti", maxAmount: null, unit: "EUR" },
      { code: "0021", label: "Dividende i udjeli u dobiti", maxAmount: null, unit: "EUR" },
      // Travel allowances
      {
        code: "0301",
        label: "Dnevnica",
        maxAmount: 26.55,
        unit: "EUR/day",
        note: "Domestic per diem",
      },
      { code: "0302", label: "Kilometraža", maxAmount: 0.4, unit: "EUR/km" },
      // Common exemptions
      { code: "0701", label: "Dar djetetu", maxAmount: 133.0, unit: "EUR/year" },
      { code: "0702", label: "Prigodna nagrada", maxAmount: 500.0, unit: "EUR/year" },
    ],
  }

  console.log(`  JOPPD_CODEBOOK: ${joppdData.year} (${joppdData.entries.length} codes)`)
  if (!dryRun) {
    const hash = hashData(joppdData)
    await dbReg.ruleVersion.upsert({
      where: {
        tableId_version: { tableId: joppdTableId, version: `${joppdData.year}.1` },
      },
      create: {
        tableId: joppdTableId,
        version: `${joppdData.year}.1`,
        effectiveFrom: new Date(`${joppdData.year}-01-01`),
        data: joppdData as unknown as Prisma.InputJsonValue,
        dataHash: hash,
      },
      update: {
        data: joppdData as unknown as Prisma.InputJsonValue,
        dataHash: hash,
      },
    })
    count++
    console.log(`    Created/updated version ${joppdData.year}.1`)
  }

  return count
}

async function main() {
  console.log("\n=== Seed RuleVersion Bundle ===")
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`)

  const startTime = Date.now()

  try {
    // Check current state
    const existingTables = await dbReg.ruleTable.count()
    const existingVersions = await dbReg.ruleVersion.count()
    console.log(`\nCurrent state: ${existingTables} tables, ${existingVersions} versions`)

    // Seed tables
    const tableIdMap = await seedRuleTables()

    // Seed versions
    const versionCount = await seedRuleVersions(tableIdMap)

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log("\n=== Seeding Complete ===")
    console.log(`Duration: ${duration}s`)
    console.log(`Tables: ${tableIdMap.size}`)
    console.log(`Versions: ${versionCount}`)

    if (dryRun) {
      console.log("\n[DRY RUN] No changes made. Run without --dry-run to apply changes.")
    }

    // Verify
    if (!dryRun) {
      const finalTables = await dbReg.ruleTable.count()
      const finalVersions = await dbReg.ruleVersion.count()
      console.log(`\nFinal state: ${finalTables} tables, ${finalVersions} versions`)
    }

    await dbReg.$disconnect()
    process.exit(0)
  } catch (error) {
    console.error("\nSeed failed:", error)
    await dbReg.$disconnect()
    process.exit(1)
  }
}

void main()
