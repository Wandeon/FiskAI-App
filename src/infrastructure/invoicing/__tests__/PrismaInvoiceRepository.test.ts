// src/infrastructure/invoicing/__tests__/PrismaInvoiceRepository.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { Prisma, EInvoiceStatus, PrismaClient } from "@prisma/client"
import { Invoice, InvoiceId, InvoiceStatus, InvoiceLine } from "@/domain/invoicing"
import { Money, Quantity, VatRate } from "@/domain/shared"
import { TenantScopedContext } from "../../shared/TenantScopedContext"
import { TenantScopeMismatchError } from "../../shared/TenantScopeMismatchError"
import { PrismaInvoiceRepository } from "../PrismaInvoiceRepository"

// Create mock Prisma client
const mockPrisma = {
  eInvoice: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  eInvoiceLine: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
} as unknown as PrismaClient

// Mock the security events module
vi.mock("@/lib/audit/security-events", () => ({
  logSecurityEvent: vi.fn(),
}))

describe("PrismaInvoiceRepository", () => {
  let repository: PrismaInvoiceRepository
  let ctx: TenantScopedContext
  const testCompanyId = "company-123"
  const testUserId = "user-456"
  const testCorrelationId = "corr-789"

  beforeEach(() => {
    ctx = new TenantScopedContext(
      {
        companyId: testCompanyId,
        userId: testUserId,
        correlationId: testCorrelationId,
      },
      mockPrisma
    )
    repository = new PrismaInvoiceRepository(ctx)
    vi.clearAllMocks()
  })

  describe("save", () => {
    it("saves a new draft invoice", async () => {
      const invoice = Invoice.create("buyer-123", testCompanyId)
      ;(mockPrisma.eInvoice.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: invoice.id.toString(),
      })
      ;(mockPrisma.eInvoiceLine.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({})

      await repository.save(invoice)

      expect(mockPrisma.eInvoice.upsert).toHaveBeenCalledTimes(1)
      expect(mockPrisma.eInvoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: invoice.id.toString() },
          create: expect.objectContaining({
            buyerId: "buyer-123",
            // sellerId is null when it equals companyId (domain sellerId represents tenant, not Contact)
            sellerId: null,
            companyId: testCompanyId,
            status: EInvoiceStatus.DRAFT,
          }),
        })
      )
    })

    it("throws TenantScopeMismatchError when invoice companyId does not match context", async () => {
      const invoice = Invoice.create("buyer-123", "different-company")

      await expect(repository.save(invoice)).rejects.toThrow(TenantScopeMismatchError)
    })

    it("saves invoice with lines", async () => {
      const invoice = Invoice.create("buyer-123", testCompanyId)
      const line = InvoiceLine.create({
        description: "Test product",
        quantity: Quantity.of(2),
        unitPrice: Money.fromString("100.00"),
        vatRate: VatRate.standard("25"),
      })
      invoice.addLine(line)
      ;(mockPrisma.eInvoice.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: invoice.id.toString(),
      })
      ;(mockPrisma.eInvoiceLine.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
      ;(mockPrisma.eInvoiceLine.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({})

      await repository.save(invoice)

      expect(mockPrisma.eInvoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            lines: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({
                  description: "Test product",
                }),
              ]),
            }),
          }),
        })
      )
    })

    it("uses DRAFT- prefix for invoice number when not yet issued", async () => {
      const invoice = Invoice.create("buyer-123", testCompanyId)

      ;(mockPrisma.eInvoice.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: invoice.id.toString(),
      })
      ;(mockPrisma.eInvoiceLine.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({})

      await repository.save(invoice)

      expect(mockPrisma.eInvoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            invoiceNumber: expect.stringContaining("DRAFT-"),
          }),
        })
      )
    })

    it("maps CANCELED status to REJECTED for database", async () => {
      const invoice = Invoice.create("buyer-123", testCompanyId)
      invoice.cancel()
      ;(mockPrisma.eInvoice.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: invoice.id.toString(),
      })
      ;(mockPrisma.eInvoiceLine.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({})

      await repository.save(invoice)

      expect(mockPrisma.eInvoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: EInvoiceStatus.REJECTED,
          }),
        })
      )
    })

    it("deletes old lines and creates new ones on update", async () => {
      const invoice = Invoice.create("buyer-123", testCompanyId)
      const line = InvoiceLine.create({
        description: "Updated product",
        quantity: Quantity.of(1),
        unitPrice: Money.fromString("50.00"),
        vatRate: VatRate.standard("25"),
      })
      invoice.addLine(line)
      ;(mockPrisma.eInvoice.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: invoice.id.toString(),
      })
      ;(mockPrisma.eInvoiceLine.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
      ;(mockPrisma.eInvoiceLine.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({})

      await repository.save(invoice)

      expect(mockPrisma.eInvoiceLine.deleteMany).toHaveBeenCalledWith({
        where: { eInvoiceId: invoice.id.toString() },
      })
      expect(mockPrisma.eInvoiceLine.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              eInvoiceId: invoice.id.toString(),
              description: "Updated product",
            }),
          ]),
        })
      )
    })
  })

  describe("findById", () => {
    it("returns null when invoice not found", async () => {
      const id = InvoiceId.fromString("non-existent-id")
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await repository.findById(id)

      expect(result).toBeNull()
      expect(mockPrisma.eInvoice.findFirst).toHaveBeenCalledWith({
        where: {
          id: "non-existent-id",
          companyId: testCompanyId,
        },
        include: { lines: true },
      })
    })

    it("reconstitutes invoice from database record", async () => {
      const id = InvoiceId.fromString("inv-123")
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "inv-123",
        companyId: testCompanyId,
        sellerId: testCompanyId,
        buyerId: "buyer-789",
        invoiceNumber: "1-1-1",
        issueDate: new Date("2024-01-15"),
        dueDate: new Date("2024-02-15"),
        status: EInvoiceStatus.DRAFT,
        jir: null,
        zki: null,
        fiscalizedAt: null,
        lines: [],
      })

      const result = await repository.findById(id)

      expect(result).not.toBeNull()
      expect(result!.id.toString()).toBe("inv-123")
      expect(result!.buyerId).toBe("buyer-789")
      expect(result!.sellerId).toBe(testCompanyId)
      expect(result!.status).toBe(InvoiceStatus.DRAFT)
    })

    it("reconstitutes invoice with lines", async () => {
      const id = InvoiceId.fromString("inv-123")
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "inv-123",
        companyId: testCompanyId,
        sellerId: testCompanyId,
        buyerId: "buyer-789",
        invoiceNumber: "1-1-1",
        issueDate: new Date("2024-01-15"),
        dueDate: new Date("2024-02-15"),
        status: EInvoiceStatus.FISCALIZED,
        jir: "JIR-123",
        zki: "ZKI-456",
        fiscalizedAt: new Date("2024-01-15"),
        lines: [
          {
            id: "line-1",
            description: "Product A",
            quantity: new Prisma.Decimal("2"),
            unitPrice: new Prisma.Decimal("100.00"),
            netAmount: new Prisma.Decimal("200.00"),
            vatRate: new Prisma.Decimal("0.25"),
            vatAmount: new Prisma.Decimal("50.00"),
          },
        ],
      })

      const result = await repository.findById(id)

      expect(result).not.toBeNull()
      const lines = result!.getLines()
      expect(lines).toHaveLength(1)
      expect(lines[0].description).toBe("Product A")
      expect(lines[0].quantity.toNumber()).toBe(2)
    })

    it("maps REJECTED status to CANCELED", async () => {
      const id = InvoiceId.fromString("inv-123")
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "inv-123",
        companyId: testCompanyId,
        sellerId: testCompanyId,
        buyerId: "buyer-789",
        invoiceNumber: "DRAFT-inv-123",
        issueDate: new Date("2024-01-15"),
        dueDate: null,
        status: EInvoiceStatus.REJECTED,
        jir: null,
        zki: null,
        fiscalizedAt: null,
        lines: [],
      })

      const result = await repository.findById(id)

      expect(result!.status).toBe(InvoiceStatus.CANCELED)
    })

    it("maps ERROR status to DRAFT as fallback", async () => {
      const id = InvoiceId.fromString("inv-123")
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "inv-123",
        companyId: testCompanyId,
        sellerId: testCompanyId,
        buyerId: "buyer-789",
        invoiceNumber: "DRAFT-inv-123",
        issueDate: new Date("2024-01-15"),
        dueDate: null,
        status: EInvoiceStatus.ERROR,
        jir: null,
        zki: null,
        fiscalizedAt: null,
        lines: [],
      })

      const result = await repository.findById(id)

      expect(result!.status).toBe(InvoiceStatus.DRAFT)
    })

    it("handles DRAFT- prefix in invoice number", async () => {
      const id = InvoiceId.fromString("inv-123")
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "inv-123",
        companyId: testCompanyId,
        sellerId: testCompanyId,
        buyerId: "buyer-789",
        invoiceNumber: "DRAFT-inv-123",
        issueDate: new Date("2024-01-15"),
        dueDate: null,
        status: EInvoiceStatus.DRAFT,
        jir: null,
        zki: null,
        fiscalizedAt: null,
        lines: [],
      })

      const result = await repository.findById(id)

      expect(result!.invoiceNumber).toBeUndefined()
    })
  })

  describe("findByNumber", () => {
    it("returns null when invoice not found", async () => {
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await repository.findByNumber("1-1-1")

      expect(result).toBeNull()
      expect(mockPrisma.eInvoice.findFirst).toHaveBeenCalledWith({
        where: {
          invoiceNumber: "1-1-1",
          companyId: testCompanyId,
        },
        include: { lines: true },
      })
    })

    it("returns invoice when found by number and company", async () => {
      ;(mockPrisma.eInvoice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "inv-123",
        companyId: testCompanyId,
        sellerId: testCompanyId,
        buyerId: "buyer-789",
        invoiceNumber: "1-1-1",
        issueDate: new Date("2024-01-15"),
        dueDate: new Date("2024-02-15"),
        status: EInvoiceStatus.FISCALIZED,
        jir: "JIR-123",
        zki: "ZKI-456",
        fiscalizedAt: new Date("2024-01-15"),
        lines: [],
      })

      const result = await repository.findByNumber("1-1-1")

      expect(result).not.toBeNull()
      expect(result!.invoiceNumber?.format()).toBe("1-1-1")
    })
  })

  describe("nextSequenceNumber", () => {
    it("returns count + 1 for sequence number", async () => {
      ;(mockPrisma.eInvoice.count as ReturnType<typeof vi.fn>).mockResolvedValue(42)

      const result = await repository.nextSequenceNumber(1, 1)

      expect(result).toBe(43)
    })

    it("returns 1 when no invoices exist", async () => {
      ;(mockPrisma.eInvoice.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

      const result = await repository.nextSequenceNumber(1, 1)

      expect(result).toBe(1)
    })

    it("excludes DRAFT invoices from count", async () => {
      ;(mockPrisma.eInvoice.count as ReturnType<typeof vi.fn>).mockResolvedValue(5)

      await repository.nextSequenceNumber(1, 1)

      expect(mockPrisma.eInvoice.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: testCompanyId,
            invoiceNumber: { not: { startsWith: "DRAFT-" } },
          }),
        })
      )
    })

    it("filters by current year", async () => {
      ;(mockPrisma.eInvoice.count as ReturnType<typeof vi.fn>).mockResolvedValue(10)
      const currentYear = new Date().getFullYear()

      await repository.nextSequenceNumber(1, 1)

      expect(mockPrisma.eInvoice.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            issueDate: {
              gte: new Date(currentYear, 0, 1),
              lt: new Date(currentYear + 1, 0, 1),
            },
          }),
        })
      )
    })
  })
})
