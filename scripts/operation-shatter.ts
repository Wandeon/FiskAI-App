import crypto from "node:crypto"
import path from "node:path"
import { promises as fs } from "node:fs"

import pdfParse from "pdf-parse"
import { Prisma } from "@prisma/client"

import { db, dbReg, runWithTenant } from "@/lib/db"
import { runWithContext } from "@/lib/context"
import { runWithAuditContext } from "@/lib/audit-context"
import {
  AccountingPeriodLockedError,
  InvoiceImmutabilityError,
  JoppdImmutabilityError,
} from "@/lib/prisma-extensions"

import { getNextInvoiceNumber } from "@/lib/invoice-numbering"
import { buildVatLineTotals } from "@/lib/vat/output-calculator"
import { emitAssetCandidates } from "@/lib/fixed-assets/asset-candidates"
import { convertFixedAssetCandidateToAsset } from "@/lib/fixed-assets/conversion"
import { runMonthClose } from "@/lib/month-close/service"
import { importParsedBankTransactions } from "@/lib/banking/import/import-parsed"
import { runAutoMatchTransactions } from "@/lib/banking/reconciliation-service"
import { createPayout } from "@/lib/payroll/payout-create"
import { lockPayout, reportPayout } from "@/lib/payroll/payout-service"
import { computeDirectorSalaryPayroll } from "@/lib/payroll/director-salary"
import { createRuleVersion, getEffectiveRuleVersion } from "@/lib/fiscal-rules/service"
import { calculateVatInputAmounts, evaluateVatInputRules } from "@/lib/vat/input-vat"

const Decimal = Prisma.Decimal

type ProcessRef = {
  file: string
  fn: string
}

type EvidenceRow = {
  model: string
  id: string
  fields: Record<string, unknown>
}

type ArtifactEvidence = {
  id: string
  type: string
  fileName: string
  checksum: string
  storageKey: string
  generatorVersion: string | null
  inputHash: string | null
}

type StepOutput = {
  step: string
  input: Record<string, unknown>
  process: ProcessRef[]
  evidence: {
    rows: EvidenceRow[]
    artifacts?: ArtifactEvidence[]
    auditLogIds?: string[]
    notes?: Record<string, unknown>
  }
}

type ScenarioReport = {
  correlationId: string
  steps: StepOutput[]
  auditLogIds: string[]
  entityIds: Record<string, string[]>
  artifacts: ArtifactEvidence[]
  assertions: Array<{ name: string; pass: boolean; details: string }>
}

type ShatterEvidenceBundle = {
  run: {
    startedAt: string
    databaseUrl: string | null
    deterministicMode: boolean
  }
  actor: {
    userId: string
    companyId: string
  }
  scenarios: Record<string, ScenarioReport>
  commands: string[]
}

function computeOibCheckDigit(firstTenDigits: string): string {
  let a = 10
  for (const ch of firstTenDigits) {
    const digit = Number(ch)
    a = (a + digit) % 10
    if (a === 0) a = 10
    a = (a * 2) % 11
  }
  const check = 11 - a
  return String(check === 10 ? 0 : check)
}

function generateValidOib(): string {
  const seed = crypto.randomBytes(8).readBigUInt64BE(0).toString()
  const digits10 = seed.slice(-10).padStart(10, "0")
  return `${digits10}${computeOibCheckDigit(digits10)}`
}

async function ensureCleanDir(dir: string) {
  await fs.rm(dir, { recursive: true, force: true })
  await fs.mkdir(dir, { recursive: true })
}

async function fetchAuditIds(companyId: string, correlationId: string) {
  const logs = await db.auditLog.findMany({
    where: {
      companyId,
      changes: { path: ["correlationId"], equals: correlationId },
    },
    select: { id: true },
    orderBy: { timestamp: "asc" },
  })
  return logs.map((l) => l.id)
}

async function withScenario<T>(params: {
  correlationId: string
  companyId: string
  userId: string
  reason: string
  fn: () => Promise<T>
}): Promise<T> {
  return runWithContext({ requestId: params.correlationId }, async () =>
    runWithTenant({ companyId: params.companyId, userId: params.userId }, async () =>
      runWithAuditContext({ actorId: params.userId, reason: params.reason }, params.fn)
    )
  )
}

function recordEntity(report: ScenarioReport, row: EvidenceRow) {
  report.entityIds[row.model] ??= []
  if (!report.entityIds[row.model].includes(row.id)) report.entityIds[row.model].push(row.id)
}

function recordArtifact(report: ScenarioReport, artifact: ArtifactEvidence) {
  report.artifacts.push(artifact)
  report.entityIds.Artifact ??= []
  if (!report.entityIds.Artifact.includes(artifact.id)) report.entityIds.Artifact.push(artifact.id)
}

function assert(report: ScenarioReport, name: string, pass: boolean, details: string) {
  report.assertions.push({ name, pass, details })
}

function printStep(correlationId: string, output: StepOutput) {
  const payload = {
    correlationId,
    step: output.step,
    input: output.input,
    process: output.process,
    evidence: output.evidence,
  }
  console.log(JSON.stringify(payload, null, 2))
}

async function main() {
  process.env.DETERMINISTIC_MODE = "true"
  process.env.FISCAL_DEMO_MODE = "true"
  process.env.MOCK_FINA_SIGNING = "true"

  const evidenceDir = path.resolve(process.cwd(), "audit/operation-shatter/evidence")
  const r2MockDir = path.join(evidenceDir, "r2-mock")
  await ensureCleanDir(r2MockDir)
  process.env.R2_MOCK_DIR = r2MockDir

  // Modules that read env at import time must be loaded after env is set.
  const { generateInvoicePdfArtifact } = await import("@/lib/pdf/generate-invoice-pdf-artifact")
  const { fiscalizePosSale } = await import("@/lib/fiscal/pos-fiscalize")
  const { prepareJoppdSubmission, markJoppdSubmitted, markJoppdAccepted } =
    await import("@/lib/joppd/joppd-service")
  const { generatePdvXmlArtifact } = await import("@/lib/reports/pdv-xml-artifact")

  const startedAt = new Date().toISOString()
  const evidence: ShatterEvidenceBundle = {
    run: {
      startedAt,
      databaseUrl: process.env.DATABASE_URL ?? null,
      deterministicMode: process.env.DETERMINISTIC_MODE === "true",
    },
    actor: {
      userId: "",
      companyId: "",
    },
    scenarios: {},
    commands: [],
  }

  evidence.commands.push(
    `DATABASE_URL='${process.env.DATABASE_URL ?? ""}' npx tsx scripts/operation-shatter.ts`
  )

  // Shared actor + company for all scenarios in this run.
  const user = await db.user.create({
    data: {
      email: `shatter.${crypto.randomUUID()}@example.test`,
      name: "Shatter Auditor",
    },
  })

  const company = await db.company.create({
    data: {
      name: `Shatter d.o.o. ${startedAt.slice(0, 10)}`,
      oib: generateValidOib(),
      address: "Audit 1",
      city: "Zagreb",
      postalCode: "10000",
      country: "HR",
      isVatPayer: true,
      legalForm: "DOO",
      fiscalEnabled: true,
      premisesCode: "1",
      deviceCode: "1",
    },
  })

  evidence.actor = { userId: user.id, companyId: company.id }

  // Shared COA accounts for month close depreciation posting.
  const depreciationExpense = await withScenario({
    correlationId: "SHATTER-S2",
    companyId: company.id,
    userId: user.id,
    reason: "shatter_setup_coa",
    fn: () =>
      db.chartOfAccounts.create({
        data: {
          companyId: company.id,
          code: "6200",
          name: "Amortizacija",
          normalBalance: "DEBIT",
          statementType: "PROFIT_LOSS",
        },
      }),
  })

  const accumulatedDepreciation = await withScenario({
    correlationId: "SHATTER-S2",
    companyId: company.id,
    userId: user.id,
    reason: "shatter_setup_coa",
    fn: () =>
      db.chartOfAccounts.create({
        data: {
          companyId: company.id,
          code: "0280",
          name: "Ispravak vrijednosti dugotrajne imovine",
          normalBalance: "CREDIT",
          statementType: "BALANCE_SHEET",
        },
      }),
  })

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Messy Revenue Cycle (Sales & Fiscalization)
  // ---------------------------------------------------------------------------
  {
    const correlationId = "SHATTER-S1"
    const report: ScenarioReport = {
      correlationId,
      steps: [],
      auditLogIds: [],
      entityIds: {},
      artifacts: [],
      assertions: [],
    }
    evidence.scenarios[correlationId] = report

    const buyerEu = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_create_buyer_eu",
      fn: () =>
        db.contact.create({
          data: {
            companyId: company.id,
            type: "CUSTOMER",
            name: "EU Client GmbH",
            vatNumber: "DE123456789",
            country: "DE",
          },
        }),
    })
    recordEntity(report, {
      model: "Contact",
      id: buyerEu.id,
      fields: { name: buyerEu.name, vatNumber: buyerEu.vatNumber },
    })

    const issueDate1 = new Date("2026-01-05T00:00:00.000Z")
    const invNo1 = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_allocate_invoice_number_1",
      fn: () => getNextInvoiceNumber(company.id, undefined, undefined, issueDate1),
    })

    const line1 = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_build_vat_line_eu_reverse_charge",
      fn: () =>
        buildVatLineTotals(
          {
            description: "Consulting",
            quantity: 1,
            unit: "HUR",
            unitPrice: 1000,
            vatRate: 0,
            vatCategory: "E",
          },
          issueDate1
        ),
    })
    const invoice1Total = line1.netAmount.add(line1.vatAmount)

    const invoice1 = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_create_invoice_1",
      fn: () =>
        db.eInvoice.create({
          data: {
            companyId: company.id,
            direction: "OUTBOUND",
            type: "INVOICE",
            status: "SENT",
            invoiceNumber: invNo1.invoiceNumber,
            internalReference: invNo1.internalReference,
            issueDate: issueDate1,
            dueDate: new Date("2026-01-20T00:00:00.000Z"),
            currency: "EUR",
            buyerId: buyerEu.id,
            netAmount: line1.netAmount,
            vatAmount: line1.vatAmount,
            totalAmount: invoice1Total,
            lines: {
              create: [
                {
                  lineNumber: 1,
                  description: line1.description,
                  quantity: line1.quantity,
                  unit: line1.unit,
                  unitPrice: line1.unitPrice,
                  netAmount: line1.netAmount,
                  vatRate: line1.vatRate,
                  vatCategory: line1.vatCategory,
                  vatAmount: line1.vatAmount,
                  vatRuleId: line1.vatRuleId ?? null,
                },
              ],
            },
          },
          include: { lines: true },
        }),
    })

    recordEntity(report, {
      model: "EInvoice",
      id: invoice1.id,
      fields: {
        invoiceNumber: invoice1.invoiceNumber,
        netAmount: invoice1.netAmount.toFixed(2),
        vatAmount: invoice1.vatAmount.toFixed(2),
        totalAmount: invoice1.totalAmount.toFixed(2),
        buyerId: invoice1.buyerId,
      },
    })

    assert(
      report,
      "S1.Invoice1 VAT is 0%",
      new Decimal(invoice1.vatAmount).equals(0),
      `EInvoice.vatAmount=${invoice1.vatAmount.toFixed(2)}`
    )

    const pdf1a = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_generate_invoice1_pdf_a",
      fn: () =>
        generateInvoicePdfArtifact({
          companyId: company.id,
          invoiceId: invoice1.id,
          createdById: user.id,
          reason: "s1_pdf",
        }),
    })
    const pdf1b = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_generate_invoice1_pdf_b",
      fn: () =>
        generateInvoicePdfArtifact({
          companyId: company.id,
          invoiceId: invoice1.id,
          createdById: user.id,
          reason: "s1_pdf_repeat",
        }),
    })

    const artifact1a = pdf1a.artifact
    const artifact1b = pdf1b.artifact

    recordArtifact(report, {
      id: artifact1a.id,
      type: artifact1a.type,
      fileName: artifact1a.fileName,
      checksum: artifact1a.checksum,
      storageKey: artifact1a.storageKey,
      generatorVersion: artifact1a.generatorVersion,
      inputHash: artifact1a.inputHash,
    })
    recordArtifact(report, {
      id: artifact1b.id,
      type: artifact1b.type,
      fileName: artifact1b.fileName,
      checksum: artifact1b.checksum,
      storageKey: artifact1b.storageKey,
      generatorVersion: artifact1b.generatorVersion,
      inputHash: artifact1b.inputHash,
    })

    assert(
      report,
      "H4.Invoice1 PDF checksum reproducible",
      artifact1a.checksum === artifact1b.checksum,
      `checksumA=${artifact1a.checksum} checksumB=${artifact1b.checksum}`
    )

    const pdfText = (await pdfParse(pdf1a.buffer)).text
    const normalizedPdfText = pdfText.replace(/\s+/g, " ").trim()
    // pdf-parse may corrupt diacritics (e.g. "obračunat" → "obra\runat"), so match a stable prefix.
    const reverseChargeNeedle = "Prijenos porezne obveze (Reverse charge): PDV nije obra"
    assert(
      report,
      "S1.Invoice1 PDF contains reverse-charge note",
      normalizedPdfText.includes(reverseChargeNeedle),
      `contains=${normalizedPdfText.includes(reverseChargeNeedle)}`
    )

    report.steps.push({
      step: "S1.Invoice1 create + PDF",
      input: {
        buyer: { name: buyerEu.name, vatNumber: buyerEu.vatNumber, country: buyerEu.country },
        invoice: { issueDate: issueDate1.toISOString(), invoiceNumber: invNo1.invoiceNumber },
        lines: [{ description: "Consulting", quantity: 1, unitPrice: 1000, vatRate: 0 }],
      },
      process: [
        { file: "src/lib/invoice-numbering.ts", fn: "getNextInvoiceNumber" },
        { file: "src/lib/vat/output-calculator.ts", fn: "buildVatLineTotals" },
        { file: "scripts/operation-shatter.ts", fn: "db.eInvoice.create" },
        { file: "src/lib/pdf/generate-invoice-pdf-artifact.ts", fn: "generateInvoicePdfArtifact" },
      ],
      evidence: {
        rows: [
          {
            model: "EInvoice",
            id: invoice1.id,
            fields: { invoiceNumber: invoice1.invoiceNumber, status: invoice1.status },
          },
          {
            model: "EInvoiceLine",
            id: invoice1.lines[0].id,
            fields: {
              vatRate: invoice1.lines[0].vatRate.toFixed(2),
              vatAmount: invoice1.lines[0].vatAmount.toFixed(2),
            },
          },
        ],
        artifacts: [
          {
            id: artifact1a.id,
            type: artifact1a.type,
            fileName: artifact1a.fileName,
            checksum: artifact1a.checksum,
            storageKey: artifact1a.storageKey,
            generatorVersion: artifact1a.generatorVersion,
            inputHash: artifact1a.inputHash,
          },
        ],
        notes: {
          pdfContainsReverseChargeNote: normalizedPdfText.includes(reverseChargeNeedle),
        },
      },
    })
    printStep(correlationId, report.steps.at(-1)!)

    const buyerHr = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_create_buyer_hr",
      fn: () =>
        db.contact.create({
          data: {
            companyId: company.id,
            type: "CUSTOMER",
            name: "Kupac (fizička osoba)",
            oib: "12345678903",
            country: "HR",
          },
        }),
    })
    recordEntity(report, {
      model: "Contact",
      id: buyerHr.id,
      fields: { name: buyerHr.name, oib: buyerHr.oib },
    })

    const issueDate2 = new Date("2026-01-07T00:00:00.000Z")
    const invNo2 = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_allocate_invoice_number_2",
      fn: () => getNextInvoiceNumber(company.id, undefined, undefined, issueDate2),
    })

    const lineHardware = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_build_vat_line_hw_25",
      fn: () =>
        buildVatLineTotals(
          {
            description: "Hardware",
            quantity: 1,
            unit: "C62",
            unitPrice: 100,
            vatRate: 25,
            vatCategory: "S",
          },
          issueDate2
        ),
    })
    const lineBook = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_build_vat_line_book_5",
      fn: () =>
        buildVatLineTotals(
          {
            description: "Book",
            quantity: 1,
            unit: "C62",
            unitPrice: 100,
            vatRate: 5,
            vatCategory: "SR",
          },
          issueDate2
        ),
    })
    const invoice2Net = lineHardware.netAmount.add(lineBook.netAmount)
    const invoice2Vat = lineHardware.vatAmount.add(lineBook.vatAmount)
    const invoice2Total = invoice2Net.add(invoice2Vat)

    const invoice2 = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_create_invoice_2",
      fn: () =>
        db.eInvoice.create({
          data: {
            companyId: company.id,
            direction: "OUTBOUND",
            type: "INVOICE",
            status: "PENDING_FISCALIZATION",
            invoiceNumber: invNo2.invoiceNumber,
            internalReference: invNo2.internalReference,
            issueDate: issueDate2,
            dueDate: new Date("2026-01-21T00:00:00.000Z"),
            currency: "EUR",
            buyerId: buyerHr.id,
            netAmount: invoice2Net,
            vatAmount: invoice2Vat,
            totalAmount: invoice2Total,
            operatorOib: company.oib,
            paymentMethod: "CASH",
            lines: {
              create: [
                {
                  lineNumber: 1,
                  description: lineHardware.description,
                  quantity: lineHardware.quantity,
                  unit: lineHardware.unit,
                  unitPrice: lineHardware.unitPrice,
                  netAmount: lineHardware.netAmount,
                  vatRate: lineHardware.vatRate,
                  vatCategory: lineHardware.vatCategory,
                  vatAmount: lineHardware.vatAmount,
                  vatRuleId: lineHardware.vatRuleId ?? null,
                },
                {
                  lineNumber: 2,
                  description: lineBook.description,
                  quantity: lineBook.quantity,
                  unit: lineBook.unit,
                  unitPrice: lineBook.unitPrice,
                  netAmount: lineBook.netAmount,
                  vatRate: lineBook.vatRate,
                  vatCategory: lineBook.vatCategory,
                  vatAmount: lineBook.vatAmount,
                  vatRuleId: lineBook.vatRuleId ?? null,
                },
              ],
            },
          },
          include: { lines: { orderBy: { lineNumber: "asc" } } },
        }),
    })
    recordEntity(report, {
      model: "EInvoice",
      id: invoice2.id,
      fields: {
        invoiceNumber: invoice2.invoiceNumber,
        totalAmount: invoice2.totalAmount.toFixed(2),
      },
    })

    const fiscalRes = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_fiscalize_invoice_2_demo",
      fn: () =>
        fiscalizePosSale({
          invoice: {
            id: invoice2.id,
            invoiceNumber: invoice2.invoiceNumber,
            issueDate: invoice2.issueDate,
            totalAmount: invoice2.totalAmount,
            paymentMethod: "CASH",
          },
          company: {
            id: company.id,
            oib: company.oib,
            fiscalEnabled: company.fiscalEnabled,
            premisesCode: company.premisesCode,
            deviceCode: company.deviceCode,
          },
        }),
    })

    const invoice2AfterFiscal = await db.eInvoice.findUnique({
      where: { id: invoice2.id },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    })
    if (!invoice2AfterFiscal) throw new Error("Invoice2 missing after fiscalization")

    assert(
      report,
      "S1.Invoice2 fiscalize success (mock/demo)",
      fiscalRes.success && Boolean(invoice2AfterFiscal.jir),
      `success=${fiscalRes.success} jir=${invoice2AfterFiscal.jir ?? null}`
    )

    let sabotageError: string | null = null
    try {
      await withScenario({
        correlationId,
        companyId: company.id,
        userId: user.id,
        reason: "s1_sabotage_update_fiscalized_invoice",
        fn: () =>
          db.eInvoice.update({
            where: { id: invoice2.id },
            data: { totalAmount: new Decimal("1.00") },
          }),
      })
    } catch (error) {
      sabotageError = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      assert(
        report,
        "S1.Sabotage update is blocked",
        error instanceof InvoiceImmutabilityError,
        sabotageError
      )
    }

    const invoice2AfterAttack = await db.eInvoice.findUnique({ where: { id: invoice2.id } })
    if (!invoice2AfterAttack) throw new Error("Invoice2 missing after attack")
    assert(
      report,
      "S1.Sabotage caused no DB mutation",
      invoice2AfterAttack.totalAmount.equals(invoice2AfterFiscal.totalAmount),
      `before=${invoice2AfterFiscal.totalAmount.toFixed(2)} after=${invoice2AfterAttack.totalAmount.toFixed(2)}`
    )

    const creditNo = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_allocate_credit_note_number",
      fn: () =>
        getNextInvoiceNumber(
          company.id,
          undefined,
          undefined,
          new Date("2026-01-08T00:00:00.000Z")
        ),
    })

    const creditNote = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s1_create_credit_note_full_refund",
      fn: () =>
        db.eInvoice.create({
          data: {
            companyId: company.id,
            direction: "OUTBOUND",
            type: "CREDIT_NOTE",
            status: "SENT",
            invoiceNumber: creditNo.invoiceNumber,
            internalReference: creditNo.internalReference,
            issueDate: new Date("2026-01-08T00:00:00.000Z"),
            currency: "EUR",
            buyerId: buyerHr.id,
            correctsInvoiceId: invoice2.id,
            notes: `Storno računa ${invoice2.invoiceNumber} (puni povrat)`,
            netAmount: invoice2AfterFiscal.netAmount.mul(-1),
            vatAmount: invoice2AfterFiscal.vatAmount.mul(-1),
            totalAmount: invoice2AfterFiscal.totalAmount.mul(-1),
            lines: {
              create: invoice2AfterFiscal.lines.map((l) => ({
                lineNumber: l.lineNumber,
                description: l.description,
                quantity: l.quantity,
                unit: l.unit,
                unitPrice: l.unitPrice,
                netAmount: l.netAmount.mul(-1),
                vatRate: l.vatRate,
                vatCategory: l.vatCategory,
                vatAmount: l.vatAmount.mul(-1),
                vatRuleId: l.vatRuleId,
              })),
            },
          },
        }),
    })
    recordEntity(report, {
      model: "EInvoice",
      id: creditNote.id,
      fields: { type: creditNote.type, correctsInvoiceId: creditNote.correctsInvoiceId },
    })

    assert(
      report,
      "S1.Credit note created as new record (original untouched)",
      creditNote.correctsInvoiceId === invoice2.id,
      `credit.correctsInvoiceId=${creditNote.correctsInvoiceId} original.id=${invoice2.id}`
    )

    report.steps.push({
      step: "S1.Invoice2 fiscalize + sabotage + credit note",
      input: {
        invoice2: {
          invoiceNumber: invoice2.invoiceNumber,
          totalAmount: invoice2.totalAmount.toFixed(2),
        },
        fiscalize: { demo: true, paymentMethod: "CASH" },
        sabotage: { update: { totalAmount: "1.00" } },
        creditNote: { correctsInvoiceId: invoice2.id, fullRefund: true },
      },
      process: [
        { file: "src/lib/fiscal/pos-fiscalize.ts", fn: "fiscalizePosSale" },
        { file: "src/lib/prisma-extensions.ts", fn: "enforceInvoiceImmutability" },
        { file: "scripts/operation-shatter.ts", fn: "db.eInvoice.create (CREDIT_NOTE)" },
      ],
      evidence: {
        rows: [
          {
            model: "EInvoice",
            id: invoice2AfterFiscal.id,
            fields: {
              jir: invoice2AfterFiscal.jir,
              fiscalizedAt: invoice2AfterFiscal.fiscalizedAt?.toISOString() ?? null,
            },
          },
          {
            model: "EInvoice",
            id: creditNote.id,
            fields: {
              correctsInvoiceId: creditNote.correctsInvoiceId,
              totalAmount: creditNote.totalAmount.toFixed(2),
            },
          },
        ],
        notes: { sabotageError },
      },
    })
    printStep(correlationId, report.steps.at(-1)!)

    report.auditLogIds = await fetchAuditIds(company.id, correlationId)
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Capitalization Trap (Procurement & Assets)
  // ---------------------------------------------------------------------------
  {
    const correlationId = "SHATTER-S2"
    const report: ScenarioReport = {
      correlationId,
      steps: [],
      auditLogIds: [],
      entityIds: {},
      artifacts: [],
      assertions: [],
    }
    evidence.scenarios[correlationId] = report

    const vendor = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s2_create_vendor",
      fn: () =>
        db.contact.create({
          data: { companyId: company.id, type: "SUPPLIER", name: "Links d.o.o.", country: "HR" },
        }),
    })
    recordEntity(report, { model: "Contact", id: vendor.id, fields: { name: vendor.name } })

    const category = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s2_create_expense_category",
      fn: () =>
        db.expenseCategory.create({
          data: {
            companyId: company.id,
            name: "IT oprema",
            code: "IT_EQUIPMENT",
            vatDeductibleDefault: true,
            receiptRequired: true,
            isActive: true,
          },
        }),
    })
    recordEntity(report, {
      model: "ExpenseCategory",
      id: category.id,
      fields: { name: category.name, code: category.code },
    })

    const expenseDate = new Date("2026-01-10T00:00:00.000Z")
    const expense = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s2_create_expense",
      fn: () =>
        db.expense.create({
          data: {
            companyId: company.id,
            vendorId: vendor.id,
            categoryId: category.id,
            description: "MacBook Pro M3",
            date: expenseDate,
            dueDate: null,
            netAmount: new Decimal("2500.00"),
            vatAmount: new Decimal("625.00"),
            vatRate: new Decimal("25.00"),
            totalAmount: new Decimal("3125.00"),
            currency: "EUR",
            status: "PENDING",
            vatDeductible: true,
          },
        }),
    })
    recordEntity(report, {
      model: "Expense",
      id: expense.id,
      fields: { totalAmount: expense.totalAmount.toFixed(2), status: expense.status },
    })

    const expenseLine = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s2_create_expense_line",
      fn: () =>
        db.expenseLine.create({
          data: {
            companyId: company.id,
            expenseId: expense.id,
            description: "MacBook Pro M3",
            quantity: new Decimal("1.000"),
            unitPrice: new Decimal("2500.00"),
            netAmount: new Decimal("2500.00"),
            vatRate: new Decimal("25.00"),
            vatAmount: new Decimal("625.00"),
            totalAmount: new Decimal("3125.00"),
          },
        }),
    })
    recordEntity(report, {
      model: "ExpenseLine",
      id: expenseLine.id,
      fields: {
        netAmount: expenseLine.netAmount.toFixed(2),
        vatAmount: expenseLine.vatAmount.toFixed(2),
      },
    })

    // URA input row via real VAT input code paths.
    const uraInput = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s2_create_ura_input",
      fn: async () => {
        return db.$transaction(async (tx) => {
          const { references } = await evaluateVatInputRules(
            tx,
            company,
            expense,
            expenseLine,
            category
          )
          const { deductibleVatAmount, nonDeductibleVatAmount } = calculateVatInputAmounts(
            expense,
            expenseLine,
            references
          )

          return tx.uraInput.create({
            data: {
              companyId: company.id,
              expenseId: expense.id,
              expenseLineId: expenseLine.id,
              date: expense.date,
              vendorName: vendor.name,
              vendorVatNumber: vendor.vatNumber ?? vendor.oib ?? null,
              netAmount: expenseLine.netAmount,
              vatRate: expenseLine.vatRate,
              vatAmount: expenseLine.vatAmount,
              totalAmount: expenseLine.totalAmount,
              deductibleVatAmount,
              nonDeductibleVatAmount,
              ruleReferences: references,
            },
          })
        })
      },
    })
    recordEntity(report, {
      model: "UraInput",
      id: uraInput.id,
      fields: { deductibleVatAmount: uraInput.deductibleVatAmount.toFixed(2) },
    })

    const candidateEmit = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s2_emit_asset_candidates",
      fn: () =>
        emitAssetCandidates(db, {
          expense,
          lines: [expenseLine],
        }),
    })

    const candidates = await db.fixedAssetCandidate.findMany({
      where: { companyId: company.id, expenseId: expense.id },
      orderBy: { createdAt: "asc" },
    })

    const candidate = candidates[0] ?? null
    assert(
      report,
      "S2.Expense flagged as asset candidate",
      Boolean(candidate),
      `fixedAssetCandidate.count=${candidates.length} threshold>1000`
    )
    if (!candidate) throw new Error("Expected FixedAssetCandidate to be created")
    recordEntity(report, {
      model: "FixedAssetCandidate",
      id: candidate.id,
      fields: {
        status: candidate.status,
        amount: candidate.amount.toFixed(2),
        thresholdValue: candidate.thresholdValue.toFixed(2),
      },
    })

    const conversion = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s2_convert_candidate_to_asset",
      fn: () =>
        convertFixedAssetCandidateToAsset({
          companyId: company.id,
          candidateId: candidate.id,
          usefulLifeMonths: 24,
          depreciationMethod: "STRAIGHT_LINE",
        }),
    })

    if (!conversion.asset) throw new Error("Expected asset created")
    recordEntity(report, {
      model: "FixedAsset",
      id: conversion.asset.id,
      fields: {
        acquisitionCost: conversion.asset.acquisitionCost.toFixed(2),
        usefulLifeMonths: conversion.asset.usefulLifeMonths,
      },
    })
    if (!conversion.schedule) throw new Error("Expected depreciation schedule created")
    recordEntity(report, {
      model: "DepreciationSchedule",
      id: conversion.schedule.id,
      fields: { status: conversion.schedule.status },
    })

    const entry1 = await db.depreciationEntry.findFirst({
      where: { assetId: conversion.asset.id },
      orderBy: { sequence: "asc" },
    })
    assert(
      report,
      "S2.Depreciation month1 posts 104.16",
      Boolean(entry1) && entry1!.amount.toFixed(2) === "104.16",
      entry1 ? `amount=${entry1.amount.toFixed(2)}` : "missing"
    )

    const monthClose = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s2_month_close_jan_2026",
      fn: () =>
        runMonthClose({
          companyId: company.id,
          forMonth: new Date("2026-01-01T00:00:00.000Z"),
          actorId: user.id,
          reason: "shatter_s2_month_close",
          depreciationDebitAccountId: depreciationExpense.id,
          depreciationCreditAccountId: accumulatedDepreciation.id,
        }),
    })

    const postedEntries = monthClose.depreciationResults
    assert(
      report,
      "S2.Month close locked period",
      monthClose.period.status === "LOCKED",
      `period.status=${monthClose.period.status}`
    )

    const firstPosting = postedEntries[0] ?? null
    const journalLines = firstPosting
      ? await db.journalLine.findMany({
          where: { journalEntryId: firstPosting.journalEntryId },
          orderBy: { lineNumber: "asc" },
        })
      : []

    assert(
      report,
      "S2.Journal entry posted 104.16",
      journalLines.some((l) => l.debit.toFixed(2) === "104.16") &&
        journalLines.some((l) => l.credit.toFixed(2) === "104.16"),
      `lines=${journalLines.map((l) => `${l.lineNumber}:${l.debit.toFixed(2)}/${l.credit.toFixed(2)}`).join(",")}`
    )

    let lockError: string | null = null
    try {
      await withScenario({
        correlationId,
        companyId: company.id,
        userId: user.id,
        reason: "s2_attack_locked_period_update_expense",
        fn: () =>
          db.expense.update({ where: { id: expense.id }, data: { description: "Tampered" } }),
      })
    } catch (error) {
      lockError = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      assert(
        report,
        "S2.Locked period blocks expense update",
        error instanceof AccountingPeriodLockedError,
        lockError
      )
    }

    report.steps.push({
      step: "S2.Expense→Asset→MonthClose→Lock",
      input: {
        expense: {
          vendor: vendor.name,
          item: "MacBook Pro M3",
          net: "2500.00",
          vat: "625.00",
          total: "3125.00",
        },
        depreciation: { usefulLifeMonths: 24, expectedMonth1: "104.16" },
        monthClose: { month: "2026-01" },
        sabotage: { expenseUpdateDescription: "Tampered" },
      },
      process: [
        { file: "src/lib/fixed-assets/asset-candidates.ts", fn: "emitAssetCandidates" },
        { file: "src/lib/fixed-assets/conversion.ts", fn: "convertFixedAssetCandidateToAsset" },
        { file: "src/lib/assets/depreciation.ts", fn: "postDepreciationEntriesForPeriod" },
        { file: "src/lib/month-close/service.ts", fn: "runMonthClose" },
      ],
      evidence: {
        rows: [
          {
            model: "Expense",
            id: expense.id,
            fields: { totalAmount: expense.totalAmount.toFixed(2), status: expense.status },
          },
          {
            model: "FixedAssetCandidate",
            id: candidate.id,
            fields: {
              status: candidate.status,
              amount: candidate.amount.toFixed(2),
              thresholdValue: candidate.thresholdValue.toFixed(2),
            },
          },
          {
            model: "FixedAsset",
            id: conversion.asset.id,
            fields: {
              acquisitionCost: conversion.asset.acquisitionCost.toFixed(2),
              usefulLifeMonths: conversion.asset.usefulLifeMonths,
            },
          },
          {
            model: "AccountingPeriod",
            id: monthClose.period.id,
            fields: {
              status: monthClose.period.status,
              startDate: monthClose.period.startDate.toISOString(),
            },
          },
        ],
        notes: { lockError, candidateEmit },
      },
    })
    printStep(correlationId, report.steps.at(-1)!)

    report.auditLogIds = await fetchAuditIds(company.id, correlationId)
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Banking Nightmare (Reconciliation)
  // ---------------------------------------------------------------------------
  {
    const correlationId = "SHATTER-S3"
    const report: ScenarioReport = {
      correlationId,
      steps: [],
      auditLogIds: [],
      entityIds: {},
      artifacts: [],
      assertions: [],
    }
    evidence.scenarios[correlationId] = report

    const bankAccount = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s3_create_bank_account",
      fn: () =>
        db.bankAccount.create({
          data: {
            companyId: company.id,
            name: "Main",
            iban: "HR1210010051863000160",
            bankName: "ZABA",
            currency: "EUR",
            currentBalance: 0,
            isDefault: true,
          },
        }),
    })
    recordEntity(report, {
      model: "BankAccount",
      id: bankAccount.id,
      fields: { iban: bankAccount.iban },
    })

    const buyer = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s3_create_customer",
      fn: () =>
        db.contact.create({
          data: { companyId: company.id, type: "CUSTOMER", name: "Kupac A/B", country: "HR" },
        }),
    })
    recordEntity(report, { model: "Contact", id: buyer.id, fields: { name: buyer.name } })

    // Scenario 2 locks January; scenario 3 runs in the next (unlocked) month.
    const issueA = new Date("2026-02-15T00:00:00.000Z")
    const issueB = new Date("2026-02-12T00:00:00.000Z")

    const invNoA = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s3_allocate_invoice_a",
      fn: () => getNextInvoiceNumber(company.id, undefined, undefined, issueA),
    })
    const invNoB = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s3_allocate_invoice_b",
      fn: () => getNextInvoiceNumber(company.id, undefined, undefined, issueB),
    })

    const line100 = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s3_build_line_100",
      fn: () =>
        buildVatLineTotals(
          {
            description: "Service",
            quantity: 1,
            unit: "HUR",
            unitPrice: 100,
            vatRate: 0,
            vatCategory: "E",
          },
          issueA
        ),
    })
    const total100 = line100.netAmount.add(line100.vatAmount)

    const invoiceA = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s3_create_invoice_a",
      fn: () =>
        db.eInvoice.create({
          data: {
            companyId: company.id,
            direction: "OUTBOUND",
            type: "INVOICE",
            status: "SENT",
            invoiceNumber: invNoA.invoiceNumber,
            internalReference: invNoA.internalReference,
            issueDate: issueA,
            currency: "EUR",
            buyerId: buyer.id,
            netAmount: line100.netAmount,
            vatAmount: line100.vatAmount,
            totalAmount: total100,
            paidAmount: new Decimal("0.00"),
            paymentStatus: "UNPAID",
            lines: {
              create: [
                {
                  lineNumber: 1,
                  description: line100.description,
                  quantity: line100.quantity,
                  unit: line100.unit,
                  unitPrice: line100.unitPrice,
                  netAmount: line100.netAmount,
                  vatRate: line100.vatRate,
                  vatCategory: line100.vatCategory,
                  vatAmount: line100.vatAmount,
                },
              ],
            },
          },
        }),
    })
    const invoiceB = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s3_create_invoice_b",
      fn: () =>
        db.eInvoice.create({
          data: {
            companyId: company.id,
            direction: "OUTBOUND",
            type: "INVOICE",
            status: "SENT",
            invoiceNumber: invNoB.invoiceNumber,
            internalReference: invNoB.internalReference,
            issueDate: issueB,
            currency: "EUR",
            buyerId: buyer.id,
            netAmount: line100.netAmount,
            vatAmount: line100.vatAmount,
            totalAmount: total100,
            paidAmount: new Decimal("0.00"),
            paymentStatus: "UNPAID",
            lines: {
              create: [
                {
                  lineNumber: 1,
                  description: line100.description,
                  quantity: line100.quantity,
                  unit: line100.unit,
                  unitPrice: line100.unitPrice,
                  netAmount: line100.netAmount,
                  vatRate: line100.vatRate,
                  vatCategory: line100.vatCategory,
                  vatAmount: line100.vatAmount,
                },
              ],
            },
          },
        }),
    })
    recordEntity(report, {
      model: "EInvoice",
      id: invoiceA.id,
      fields: {
        invoiceNumber: invoiceA.invoiceNumber,
        totalAmount: invoiceA.totalAmount.toFixed(2),
      },
    })
    recordEntity(report, {
      model: "EInvoice",
      id: invoiceB.id,
      fields: {
        invoiceNumber: invoiceB.invoiceNumber,
        totalAmount: invoiceB.totalAmount.toFixed(2),
      },
    })

    const importRes = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s3_import_parsed_transactions",
      fn: () =>
        importParsedBankTransactions({
          companyId: company.id,
          bankAccountId: bankAccount.id,
          importedBy: user.id,
          fileName: "camt053-mocked.json",
          importedAt: new Date("2026-02-20T00:00:00.000Z"),
          transactions: [
            {
              date: new Date("2026-02-20T00:00:00.000Z"),
              description: "Uplata bez poziva",
              amount: "98.00",
              reference: null,
            },
            {
              date: new Date("2026-02-20T00:00:00.000Z"),
              description: "Uplata s pozivom",
              amount: "102.00",
              reference: invoiceB.invoiceNumber,
            },
            {
              date: new Date("2026-02-20T00:00:00.000Z"),
              description: "Bank naknada",
              amount: "-5.00",
              reference: null,
            },
          ],
        }),
    })

    const matchRes = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s3_run_matcher",
      fn: () =>
        runAutoMatchTransactions({
          companyId: company.id,
          bankAccountId: bankAccount.id,
          userId: user.id,
        }),
    })

    const invAAfter = await db.eInvoice.findUnique({ where: { id: invoiceA.id } })
    const invBAfter = await db.eInvoice.findUnique({ where: { id: invoiceB.id } })
    if (!invAAfter || !invBAfter) throw new Error("Invoices missing after matching")

    assert(
      report,
      "S3.Invoice A PARTIAL remaining 2",
      invAAfter.paymentStatus === "PARTIAL" && invAAfter.paidAmount.toFixed(2) === "98.00",
      `paymentStatus=${invAAfter.paymentStatus} paidAmount=${invAAfter.paidAmount.toFixed(2)}`
    )
    assert(
      report,
      "S3.Invoice B PAID with overpayment 2",
      invBAfter.paymentStatus === "PAID" && invBAfter.paidAmount.toFixed(2) === "100.00",
      `paymentStatus=${invBAfter.paymentStatus} paidAmount=${invBAfter.paidAmount.toFixed(2)}`
    )

    const unapplied = await db.unappliedPayment.findFirst({
      where: { companyId: company.id, amount: new Decimal("2.00") },
    })
    assert(
      report,
      "S3.Overpayment stored as UnappliedPayment 2.00",
      Boolean(unapplied),
      unapplied ? `unappliedPayment.id=${unapplied.id}` : "missing"
    )
    if (unapplied)
      recordEntity(report, {
        model: "UnappliedPayment",
        id: unapplied.id,
        fields: { amount: unapplied.amount.toFixed(2) },
      })

    const feeExpense = await db.expense.findFirst({
      where: { companyId: company.id, description: "Bankarske usluge" },
      orderBy: { createdAt: "desc" },
      include: { category: true },
    })
    assert(
      report,
      "S3.Bank fee categorized to Bankarske usluge",
      Boolean(feeExpense) && String(feeExpense!.category?.name).toLowerCase().includes("bankarske"),
      feeExpense ? `expense.id=${feeExpense.id} category=${feeExpense.category?.name}` : "missing"
    )
    if (feeExpense)
      recordEntity(report, {
        model: "Expense",
        id: feeExpense.id,
        fields: {
          totalAmount: feeExpense.totalAmount.toFixed(2),
          category: feeExpense.category?.name,
        },
      })

    const txns = await db.bankTransaction.findMany({
      where: { companyId: company.id, bankAccountId: bankAccount.id },
      orderBy: { amount: "asc" },
      select: {
        id: true,
        amount: true,
        description: true,
        matchedInvoiceId: true,
        matchedExpenseId: true,
        matchStatus: true,
      },
    })
    txns.forEach((t) =>
      recordEntity(report, {
        model: "BankTransaction",
        id: t.id,
        fields: { amount: t.amount.toFixed(2), matchStatus: t.matchStatus },
      })
    )

    report.steps.push({
      step: "S3.Import + AutoMatch",
      input: {
        invoices: [
          { id: invoiceA.id, invoiceNumber: invoiceA.invoiceNumber, total: "100.00" },
          { id: invoiceB.id, invoiceNumber: invoiceB.invoiceNumber, total: "100.00" },
        ],
        transactions: [
          { amount: "98.00", reference: null },
          { amount: "102.00", reference: invoiceB.invoiceNumber },
          { amount: "-5.00", description: "Bank naknada" },
        ],
      },
      process: [
        { file: "src/lib/banking/import/import-parsed.ts", fn: "importParsedBankTransactions" },
        { file: "src/lib/banking/reconciliation-service.ts", fn: "runAutoMatchTransactions" },
      ],
      evidence: {
        rows: [
          {
            model: "StatementImport",
            id: importRes.statementImportId,
            fields: { fileChecksum: importRes.fileChecksum },
          },
          {
            model: "EInvoice",
            id: invAAfter.id,
            fields: {
              paymentStatus: invAAfter.paymentStatus,
              paidAmount: invAAfter.paidAmount.toFixed(2),
            },
          },
          {
            model: "EInvoice",
            id: invBAfter.id,
            fields: {
              paymentStatus: invBAfter.paymentStatus,
              paidAmount: invBAfter.paidAmount.toFixed(2),
            },
          },
          ...txns.map((t) => ({
            model: "BankTransaction",
            id: t.id,
            fields: { amount: t.amount.toFixed(2), matchStatus: t.matchStatus },
          })),
        ],
        notes: { matchRes },
      },
    })
    printStep(correlationId, report.steps.at(-1)!)

    report.auditLogIds = await fetchAuditIds(company.id, correlationId)
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Regulatory Truth (VAT & JOPPD)
  // ---------------------------------------------------------------------------
  {
    const correlationId = "SHATTER-S4"
    const report: ScenarioReport = {
      correlationId,
      steps: [],
      auditLogIds: [],
      entityIds: {},
      artifacts: [],
      assertions: [],
    }
    evidence.scenarios[correlationId] = report

    // Fiscal rule versions (pinned ids must be visible in snapshot evidence).
    const ruleDate = new Date("2026-01-01T00:00:00.000Z")
    await dbReg.ruleTable.upsert({
      where: { key: "CONTRIBUTIONS" },
      update: {},
      create: { key: "CONTRIBUTIONS", name: "Contributions", description: "Shatter bootstrap" },
    })
    await dbReg.ruleTable.upsert({
      where: { key: "INCOME_TAX" },
      update: {},
      create: { key: "INCOME_TAX", name: "Income tax", description: "Shatter bootstrap" },
    })
    await dbReg.ruleTable.upsert({
      where: { key: "MUNICIPALITY_INCOME_TAX" },
      update: {},
      create: {
        key: "MUNICIPALITY_INCOME_TAX",
        name: "Municipality income tax",
        description: "Shatter bootstrap",
      },
    })
    await dbReg.ruleTable.upsert({
      where: { key: "JOPPD_CODEBOOK" },
      update: {},
      create: { key: "JOPPD_CODEBOOK", name: "JOPPD codebook", description: "Shatter bootstrap" },
    })
    const contributionsVersion = await createRuleVersion({
      tableKey: "CONTRIBUTIONS",
      version: `shatter-${startedAt}`,
      effectiveFrom: ruleDate,
      data: {
        year: 2026,
        lastVerified: "2026-01-01",
        source: "OPERATION_SHATTER",
        rates: {
          MIO_I: { rate: 0.15, name: "MIO I", iban: "HR123", model: "HR00", pozivNaBroj: "123" },
          MIO_II: { rate: 0.05, name: "MIO II", iban: "HR123", model: "HR00", pozivNaBroj: "123" },
          HZZO: { rate: 0.165, name: "HZZO", iban: "HR123", model: "HR00", pozivNaBroj: "123" },
        },
        base: { minimum: 0, maximum: 1_000_000, description: "Shatter bounds" },
        monthly: { mioI: 0, mioII: 0, hzzo: 0, total: 0 },
      },
    })
    const incomeTaxVersion = await createRuleVersion({
      tableKey: "INCOME_TAX",
      version: `shatter-${startedAt}`,
      effectiveFrom: ruleDate,
      data: {
        year: 2026,
        lastVerified: "2026-01-01",
        source: "OPERATION_SHATTER",
        personalAllowance: 560,
        brackets: [{ min: 0, max: null, rate: 0.2, description: "Flat 20% shatter bracket" }],
      },
    })
    const municipalityVersion = await createRuleVersion({
      tableKey: "MUNICIPALITY_INCOME_TAX",
      version: `shatter-${startedAt}`,
      effectiveFrom: ruleDate,
      data: {
        year: 2026,
        lastVerified: "2026-01-01",
        source: "OPERATION_SHATTER",
        entries: [
          {
            postalCode: "10000",
            city: "Zagreb",
            municipality: "Grad Zagreb",
            county: "Grad Zagreb",
            prirezRate: 0.18,
          },
        ],
      },
    })
    const joppdCodebookVersion = await createRuleVersion({
      tableKey: "JOPPD_CODEBOOK",
      version: `shatter-${startedAt}`,
      effectiveFrom: ruleDate,
      data: {
        year: 2026,
        lastVerified: "2026-01-01",
        source: "OPERATION_SHATTER",
        entries: [{ code: "0001", label: "Placa", maxAmount: null, unit: "EUR" }],
      },
    })

    recordEntity(report, {
      model: "RuleVersion",
      id: contributionsVersion.id,
      fields: { table: "CONTRIBUTIONS", version: contributionsVersion.version },
    })
    recordEntity(report, {
      model: "RuleVersion",
      id: incomeTaxVersion.id,
      fields: { table: "INCOME_TAX", version: incomeTaxVersion.version },
    })
    recordEntity(report, {
      model: "RuleVersion",
      id: municipalityVersion.id,
      fields: { table: "MUNICIPALITY_INCOME_TAX", version: municipalityVersion.version },
    })
    recordEntity(report, {
      model: "RuleVersion",
      id: joppdCodebookVersion.id,
      fields: { table: "JOPPD_CODEBOOK", version: joppdCodebookVersion.version },
    })

    const contributions = (await getEffectiveRuleVersion("CONTRIBUTIONS", ruleDate)).data as any
    const incomeTax = (await getEffectiveRuleVersion("INCOME_TAX", ruleDate)).data as any
    const municipality = (await getEffectiveRuleVersion("MUNICIPALITY_INCOME_TAX", ruleDate))
      .data as any

    const calc = computeDirectorSalaryPayroll({
      grossAmount: "3000.00",
      postalCode: "10000",
      contributions,
      incomeTax,
      municipality,
    })

    // Payout + snapshot
    // Scenario 2 locks January; payroll/JOPPD run in the next (unlocked) month.
    const payout = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s4_create_payout",
      fn: () =>
        createPayout({
          companyId: company.id,
          payoutDate: new Date("2026-02-28T00:00:00.000Z"),
          periodFrom: new Date("2026-02-01T00:00:00.000Z"),
          periodTo: new Date("2026-02-28T23:59:59.999Z"),
          lines: [
            {
              lineNumber: 1,
              employeeName: "Direktor",
              employeeOib: "12345678903",
              employeeIban: "HR1723600001101234565",
              grossAmount: calc.grossAmount,
              netAmount: calc.netAmount,
              taxAmount: calc.tax.totalTax,
              joppdData: {
                municipalityCode: "01333",
                workMunicipalityCode: "01333",
                recipientType: "0001",
                receiptType: "0001",
                mio1: calc.employeeContributions.mio1,
                mio2: calc.employeeContributions.mio2,
                hzzo: calc.employerContributions.hzzo,
              },
              ruleVersionId: joppdCodebookVersion.id,
            },
          ],
        }),
    })

    recordEntity(report, {
      model: "Payout",
      id: payout.id,
      fields: {
        periodYear: payout.periodYear,
        periodMonth: payout.periodMonth,
        status: payout.status,
      },
    })
    recordEntity(report, {
      model: "PayoutLine",
      id: payout.lines[0]!.id,
      fields: {
        grossAmount: payout.lines[0]!.grossAmount!.toFixed(2),
        netAmount: payout.lines[0]!.netAmount!.toFixed(2),
      },
    })

    const snapshot = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s4_create_calculation_snapshot",
      fn: () =>
        db.calculationSnapshot.create({
          data: {
            companyId: company.id,
            payoutId: payout.id,
            payoutLineId: payout.lines[0].id,
            rulesEngineSnapshot: {
              kind: "OPERATION_SHATTER_DIRECTOR_SALARY",
              pinnedRuleVersions: {
                CONTRIBUTIONS: contributionsVersion.id,
                INCOME_TAX: incomeTaxVersion.id,
                MUNICIPALITY_INCOME_TAX: municipalityVersion.id,
              },
            },
            employmentSnapshot: { kind: "DIRECTOR", postalCode: "10000" },
            inputSnapshot: { grossAmount: "3000.00" },
            outputSnapshot: {
              grossAmount: calc.grossAmount,
              netAmount: calc.netAmount,
              taxAmount: calc.tax.totalTax,
              employerContributions: calc.employerContributions,
              employeeContributions: calc.employeeContributions,
              ruleVersionIds: {
                CONTRIBUTIONS: contributionsVersion.id,
                INCOME_TAX: incomeTaxVersion.id,
                MUNICIPALITY_INCOME_TAX: municipalityVersion.id,
              },
            },
            createdById: user.id,
          },
        }),
    })
    recordEntity(report, {
      model: "CalculationSnapshot",
      id: snapshot.id,
      fields: { payoutId: snapshot.payoutId, payoutLineId: snapshot.payoutLineId },
    })

    await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s4_lock_payout",
      fn: () => lockPayout(payout.id, user.id),
    })
    await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s4_report_payout",
      fn: () => reportPayout(payout.id, user.id),
    })

    const creds = { privateKeyPem: "MOCK", certificatePem: "MOCK" }
    const submission1 = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s4_generate_joppd",
      fn: () =>
        prepareJoppdSubmission({
          companyId: company.id,
          payoutId: payout.id,
          credentials: creds,
          retentionYears: 11,
        }),
    })

    const submission2 = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s4_generate_joppd_repeat_for_checksum",
      fn: () =>
        prepareJoppdSubmission({
          companyId: company.id,
          payoutId: payout.id,
          credentials: creds,
          retentionYears: 11,
        }),
    })

    recordEntity(report, {
      model: "JoppdSubmission",
      id: submission1.id,
      fields: { status: submission1.status, signedXmlHash: submission1.signedXmlHash },
    })
    recordEntity(report, {
      model: "JoppdSubmission",
      id: submission2.id,
      fields: { status: submission2.status, signedXmlHash: submission2.signedXmlHash },
    })

    assert(
      report,
      "H4.JOPPD XML checksum reproducible for same payout inputs",
      submission1.signedXmlHash === submission2.signedXmlHash,
      `hash1=${submission1.signedXmlHash} hash2=${submission2.signedXmlHash}`
    )

    const joppdArtifact = await db.artifact.findFirst({
      where: {
        companyId: company.id,
        AND: [
          { generationMeta: { path: ["artifactKind"], equals: "JOPPD_XML" } },
          { generationMeta: { path: ["submissionId"], equals: submission1.id } },
        ],
      },
      orderBy: { createdAt: "desc" },
    })
    if (joppdArtifact) {
      recordArtifact(report, {
        id: joppdArtifact.id,
        type: joppdArtifact.type,
        fileName: joppdArtifact.fileName,
        checksum: joppdArtifact.checksum,
        storageKey: joppdArtifact.storageKey,
        generatorVersion: joppdArtifact.generatorVersion,
        inputHash: joppdArtifact.inputHash,
      })
    }

    await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s4_submit_joppd_mock",
      fn: () => markJoppdSubmitted(submission1.id, `MOCK-${submission1.id}`),
    })
    await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s4_accept_joppd_mock",
      fn: () => markJoppdAccepted(submission1.id),
    })

    let joppdAttackError: string | null = null
    try {
      await withScenario({
        correlationId,
        companyId: company.id,
        userId: user.id,
        reason: "s4_attack_modify_signed_storage_key",
        fn: () =>
          db.joppdSubmission.update({
            where: { id: submission1.id },
            data: { signedXmlStorageKey: null },
          }),
      })
    } catch (error) {
      joppdAttackError = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      assert(
        report,
        "S4.Sabotage update blocked for submitted JOPPD",
        error instanceof JoppdImmutabilityError,
        joppdAttackError
      )
    }

    let joppdDeleteError: string | null = null
    try {
      await withScenario({
        correlationId,
        companyId: company.id,
        userId: user.id,
        reason: "s4_attack_delete_joppd",
        fn: () => db.joppdSubmission.delete({ where: { id: submission1.id } }),
      })
    } catch (error) {
      joppdDeleteError = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      assert(
        report,
        "S4.Sabotage delete blocked for submitted JOPPD",
        error instanceof JoppdImmutabilityError,
        joppdDeleteError
      )
    }

    const periodFrom = new Date("2026-01-01T00:00:00.000Z")
    const periodTo = new Date("2026-01-31T23:59:59.999Z")

    const pdv1 = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s4_generate_pdv_a",
      fn: () =>
        generatePdvXmlArtifact({
          companyId: company.id,
          dateFrom: periodFrom,
          dateTo: periodTo,
          createdById: user.id,
        }),
    })
    const pdv2 = await withScenario({
      correlationId,
      companyId: company.id,
      userId: user.id,
      reason: "s4_generate_pdv_b",
      fn: () =>
        generatePdvXmlArtifact({
          companyId: company.id,
          dateFrom: periodFrom,
          dateTo: periodTo,
          createdById: user.id,
          reason: "pdv_repeat",
        }),
    })

    recordArtifact(report, {
      id: pdv1.artifact.id,
      type: pdv1.artifact.type,
      fileName: pdv1.artifact.fileName,
      checksum: pdv1.artifact.checksum,
      storageKey: pdv1.artifact.storageKey,
      generatorVersion: pdv1.artifact.generatorVersion,
      inputHash: pdv1.artifact.inputHash,
    })
    recordArtifact(report, {
      id: pdv2.artifact.id,
      type: pdv2.artifact.type,
      fileName: pdv2.artifact.fileName,
      checksum: pdv2.artifact.checksum,
      storageKey: pdv2.artifact.storageKey,
      generatorVersion: pdv2.artifact.generatorVersion,
      inputHash: pdv2.artifact.inputHash,
    })

    assert(
      report,
      "H4.PDV XML checksum reproducible",
      pdv1.artifact.checksum === pdv2.artifact.checksum,
      `checksumA=${pdv1.artifact.checksum} checksumB=${pdv2.artifact.checksum}`
    )

    assert(
      report,
      "S4.PDV excludes EU reverse charge from domestic output VAT",
      pdv1.data.section1.euDeliveries.services === "1000.00" &&
        pdv1.data.section1.domestic.standard.baseAmount === "0.00" &&
        pdv1.data.section1.domestic.superReduced.baseAmount === "0.00",
      JSON.stringify({
        euServices: pdv1.data.section1.euDeliveries.services,
        outStandardBase: pdv1.data.section1.domestic.standard.baseAmount,
        outSuperReducedBase: pdv1.data.section1.domestic.superReduced.baseAmount,
      })
    )

    assert(
      report,
      "S4.PDV input VAT includes 625.00 from MacBook",
      pdv1.data.section2.domestic.standard.vatAmount === "625.00",
      `inVat25=${pdv1.data.section2.domestic.standard.vatAmount}`
    )

    const controlSumOk =
      new Decimal(pdv1.data.section3.outputVat)
        .sub(new Decimal(pdv1.data.section3.inputVat))
        .toFixed(2) === pdv1.data.section3.vatPayable
    assert(
      report,
      "S4.PDV control sum (output - input = payable)",
      controlSumOk,
      JSON.stringify(pdv1.data.section3)
    )

    report.steps.push({
      step: "S4.Payroll→JOPPD→PDV",
      input: {
        payout: { gross: "3000.00", postalCode: "10000" },
        ruleVersionIds: {
          CONTRIBUTIONS: contributionsVersion.id,
          INCOME_TAX: incomeTaxVersion.id,
          MUNICIPALITY_INCOME_TAX: municipalityVersion.id,
          JOPPD_CODEBOOK: joppdCodebookVersion.id,
        },
        joppd: { mockSigning: true, retentionYears: 11, submissionId: submission1.id },
        sabotage: { updateSignedKeyToNull: true, deleteSubmission: true },
        pdv: { dateFrom: periodFrom.toISOString(), dateTo: periodTo.toISOString() },
      },
      process: [
        { file: "src/lib/payroll/director-salary.ts", fn: "computeDirectorSalaryPayroll" },
        { file: "src/lib/joppd/joppd-service.ts", fn: "prepareJoppdSubmission" },
        { file: "src/lib/reports/pdv-xml-artifact.ts", fn: "generatePdvXmlArtifact" },
      ],
      evidence: {
        rows: [
          {
            model: "Payout",
            id: payout.id,
            fields: { status: "REPORTED", periodMonth: payout.periodMonth },
          },
          {
            model: "CalculationSnapshot",
            id: snapshot.id,
            fields: { rulesEngineSnapshot: snapshot.rulesEngineSnapshot },
          },
          {
            model: "JoppdSubmission",
            id: submission1.id,
            fields: {
              status: "ACCEPTED",
              signedXmlHash: submission1.signedXmlHash,
              signedXmlStorageKey: submission1.signedXmlStorageKey,
            },
          },
        ],
        artifacts: [
          ...(joppdArtifact
            ? [
                {
                  id: joppdArtifact.id,
                  type: joppdArtifact.type,
                  fileName: joppdArtifact.fileName,
                  checksum: joppdArtifact.checksum,
                  storageKey: joppdArtifact.storageKey,
                  generatorVersion: joppdArtifact.generatorVersion,
                  inputHash: joppdArtifact.inputHash,
                },
              ]
            : []),
          {
            id: pdv1.artifact.id,
            type: pdv1.artifact.type,
            fileName: pdv1.artifact.fileName,
            checksum: pdv1.artifact.checksum,
            storageKey: pdv1.artifact.storageKey,
            generatorVersion: pdv1.artifact.generatorVersion,
            inputHash: pdv1.artifact.inputHash,
          },
        ],
        notes: {
          joppdAttackError,
          joppdDeleteError,
          pdv: {
            section1: pdv1.data.section1,
            section2: pdv1.data.section2,
            section3: pdv1.data.section3,
          },
        },
      },
    })
    printStep(correlationId, report.steps.at(-1)!)

    report.auditLogIds = await fetchAuditIds(company.id, correlationId)
  }

  // Finalize: store audit ids + persist evidence bundle.
  for (const key of Object.keys(evidence.scenarios)) {
    evidence.scenarios[key].auditLogIds = await fetchAuditIds(company.id, key)
  }

  const outPath = path.resolve(
    process.cwd(),
    "audit/operation-shatter/evidence/shatter-evidence.json"
  )
  await fs.writeFile(outPath, JSON.stringify(evidence, null, 2))

  console.log(JSON.stringify({ done: true, evidencePath: outPath }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
