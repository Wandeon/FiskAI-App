#!/usr/bin/env npx tsx
/**
 * Phase 5 Remediation: Final Audit
 */

import { db } from "@/lib/db"

async function finalAudit() {
  console.log("=".repeat(60))
  console.log("PHASE 5 REMEDIATION: FINAL AUDIT")
  console.log("Timestamp:", new Date().toISOString())
  console.log("=".repeat(60))

  const findings: string[] = []

  // 1. Check EInvoices
  console.log("\n=== 1. EINVOICE INTEGRITY ===")
  const einvoicesWithoutIA = await db.eInvoice.count({
    where: { integrationAccountId: null },
  })
  const totalEinvoices = await db.eInvoice.count()
  console.log("Total EInvoices:", totalEinvoices)
  console.log("EInvoices without integrationAccountId:", einvoicesWithoutIA)

  if (einvoicesWithoutIA > 0) {
    findings.push(`BLOCKING: ${einvoicesWithoutIA} EInvoices lack integrationAccountId`)
  } else {
    console.log("✅ All EInvoices have integrationAccountId")
  }

  // 2. Check IntegrationAccounts
  console.log("\n=== 2. INTEGRATION ACCOUNTS ===")
  const accounts = await db.integrationAccount.findMany({
    include: {
      company: { select: { name: true } },
      _count: { select: { eInvoices: true } },
    },
  })
  console.log("Total IntegrationAccounts:", accounts.length)

  for (const acc of accounts) {
    console.log(
      `  ${acc.id} | ${acc.company.name} | ${acc.kind} ${acc.environment} | EInvoices: ${acc._count.eInvoices}`
    )
  }

  if (accounts.length === 0) {
    findings.push("BLOCKING: No IntegrationAccounts exist")
  }

  // 3. Check companies with EInvoice activity but no IntegrationAccount
  console.log("\n=== 3. COMPANIES WITHOUT INTEGRATION ACCOUNT ===")
  const companiesWithEinvoices = await db.eInvoice.findMany({
    select: { companyId: true },
    distinct: ["companyId"],
  })
  const companyIds = companiesWithEinvoices.map((e) => e.companyId)

  const accountCompanyIds = new Set(accounts.map((a) => a.companyId))
  const companiesWithoutAccount = companyIds.filter((id) => !accountCompanyIds.has(id))

  if (companiesWithoutAccount.length > 0) {
    console.log(
      "Companies with EInvoice but no IntegrationAccount:",
      companiesWithoutAccount.length
    )
    for (const cid of companiesWithoutAccount) {
      console.log(`  - ${cid}`)
    }
    findings.push(
      `BLOCKING: ${companiesWithoutAccount.length} companies have EInvoices but no IntegrationAccount`
    )
  } else {
    console.log("✅ All companies with EInvoice activity have IntegrationAccount")
  }

  // 4. Check FK constraint
  console.log("\n=== 4. FK CONSTRAINT ===")
  const fkResult = (await db.$queryRaw`
    SELECT
      tc.constraint_name,
      ccu.table_schema as to_schema,
      ccu.table_name as to_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'EInvoice'
      AND ccu.column_name = 'id'
      AND tc.constraint_name = 'EInvoice_integrationAccountId_fkey'
  `) as Array<{ constraint_name: string; to_schema: string; to_table: string }>

  if (fkResult.length > 0) {
    const fk = fkResult[0]
    console.log(`FK constraint: ${fk.constraint_name} -> ${fk.to_schema}.${fk.to_table}`)
    if (fk.to_schema !== "public") {
      findings.push(`BLOCKING: FK references ${fk.to_schema}.integration_account instead of public`)
    } else {
      console.log("✅ FK correctly references public.integration_account")
    }
  } else {
    findings.push("BLOCKING: FK constraint not found")
  }

  // 5. EInvoice status distribution
  console.log("\n=== 5. EINVOICE STATUS DISTRIBUTION ===")
  const statusDist = await db.eInvoice.groupBy({
    by: ["status"],
    _count: true,
  })
  for (const s of statusDist) {
    console.log(`  ${s.status}: ${s._count}`)
  }

  // 6. EInvoice by IntegrationAccount
  console.log("\n=== 6. EINVOICES BY INTEGRATION ACCOUNT ===")
  const byAccount = await db.eInvoice.groupBy({
    by: ["integrationAccountId"],
    _count: true,
  })
  for (const b of byAccount) {
    const acc = accounts.find((a) => a.id === b.integrationAccountId)
    console.log(`  ${b.integrationAccountId} (${acc?.company.name || "unknown"}): ${b._count}`)
  }

  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("AUDIT SUMMARY")
  console.log("=".repeat(60))

  if (findings.length === 0) {
    console.log("✅ PASS: No blocking findings")
    console.log("\nPhase 5 remediation is complete.")
    console.log("System is ready for SHADOW mode monitoring.")
  } else {
    console.log("❌ FAIL: Blocking findings detected:")
    for (const f of findings) {
      console.log(`  - ${f}`)
    }
  }

  await db.$disconnect()
  return findings
}

finalAudit().catch(async (error) => {
  console.error("Audit failed:", error)
  await db.$disconnect()
  process.exit(1)
})
