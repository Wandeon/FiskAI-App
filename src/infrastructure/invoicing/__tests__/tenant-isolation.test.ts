// src/infrastructure/invoicing/__tests__/tenant-isolation.test.ts
import { describe, test, before, after } from "node:test"
import assert from "node:assert/strict"
import { existsSync } from "fs"
import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { TenantScopedContext } from "../../shared/TenantScopedContext"
import { TenantScopeMismatchError } from "../../shared/TenantScopeMismatchError"
import { Invoice, InvoiceId } from "@/domain/invoicing"

// Load environment variables (same pattern as prisma.config.ts)
if (existsSync(".env.local")) {
  config({ path: ".env.local" })
} else if (existsSync(".env")) {
  config({ path: ".env" })
}

describe("Tenant Isolation", () => {
  let prisma: PrismaClient
  let pool: Pool
  const TENANT_A_ID = `test-tenant-a-${Date.now()}`
  const TENANT_B_ID = `test-tenant-b-${Date.now()}`

  before(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    prisma = new PrismaClient({ adapter })

    // Create test companies for isolation tests
    // Use unique OIBs based on timestamp to avoid conflicts
    const timestamp = Date.now().toString().slice(-9)
    await prisma.company.createMany({
      data: [
        {
          id: TENANT_A_ID,
          name: "Test Tenant A",
          oib: `9${timestamp}1`, // 11-digit OIB with unique suffix
          vatNumber: `HR9${timestamp}1`,
          address: "Test Address A",
          city: "Zagreb",
          postalCode: "10000",
          country: "HR",
        },
        {
          id: TENANT_B_ID,
          name: "Test Tenant B",
          oib: `9${timestamp}2`, // 11-digit OIB with unique suffix
          vatNumber: `HR9${timestamp}2`,
          address: "Test Address B",
          city: "Zagreb",
          postalCode: "10000",
          country: "HR",
        },
      ],
    })
  })

  after(async () => {
    // Clean up test invoices first (due to foreign key constraints)
    await prisma.eInvoice.deleteMany({
      where: { companyId: { in: [TENANT_A_ID, TENANT_B_ID] } },
    })
    // Clean up test companies
    await prisma.company.deleteMany({
      where: { id: { in: [TENANT_A_ID, TENANT_B_ID] } },
    })
    await prisma.$disconnect()
    await pool.end()
  })

  test("cannot save invoice for different tenant", async () => {
    const tenantAContext = new TenantScopedContext(
      { companyId: TENANT_A_ID, userId: "user-1", correlationId: "test-1" },
      prisma
    )

    // Create invoice belonging to tenant-b
    // In domain model: sellerId is used as companyId (tenant identifier)
    // The domain Invoice.companyId getter returns sellerId
    const invoiceForTenantB = Invoice.create("", TENANT_B_ID)

    await assert.rejects(
      async () => tenantAContext.invoices().save(invoiceForTenantB),
      TenantScopeMismatchError
    )
  })

  test("cannot read invoice from different tenant", async () => {
    const tenantBInvoiceId = `test-invoice-${Date.now()}`

    // Setup: Create invoice for tenant-b directly via prisma
    // Note: sellerId and buyerId are Contact references (nullable), not company IDs
    await prisma.eInvoice.create({
      data: {
        id: tenantBInvoiceId,
        companyId: TENANT_B_ID,
        direction: "OUTBOUND",
        // sellerId references Contact table, leave null for test
        // buyerId references Contact table, leave null for test
        invoiceNumber: "TEST-001",
        issueDate: new Date(),
        netAmount: 100,
        vatAmount: 25,
        totalAmount: 125,
        status: "DRAFT",
        type: "INVOICE",
      },
    })

    try {
      // Act: Tenant A tries to read tenant B's invoice
      const tenantAContext = new TenantScopedContext(
        { companyId: TENANT_A_ID, userId: "user-1", correlationId: "test-2" },
        prisma
      )

      const result = await tenantAContext
        .invoices()
        .findById(InvoiceId.fromString(tenantBInvoiceId))

      // Assert: Not found (not leaked)
      assert.strictEqual(result, null, "Should not be able to read other tenant's invoice")
    } finally {
      // Cleanup
      await prisma.eInvoice.delete({ where: { id: tenantBInvoiceId } })
    }
  })

  test("can save and read own tenant invoice", async () => {
    const tenantAContext = new TenantScopedContext(
      { companyId: TENANT_A_ID, userId: "user-1", correlationId: "test-3" },
      prisma
    )

    // Create invoice for tenant-a (sellerId = TENANT_A_ID means this invoice belongs to tenant A)
    // Empty string for buyerId since it's a Contact reference, not company ID
    const invoice = Invoice.create("", TENANT_A_ID)

    try {
      await tenantAContext.invoices().save(invoice)

      const retrieved = await tenantAContext.invoices().findById(invoice.id)
      assert.ok(retrieved, "Should be able to read own invoice")
      assert.strictEqual(retrieved.companyId, TENANT_A_ID)
    } finally {
      // Cleanup
      await prisma.eInvoice.delete({ where: { id: invoice.id.toString() } }).catch(() => {})
    }
  })
})
