import { db } from "@/lib/db"
import { buildBankInstructions } from "./bank"
import { runPayrollCalculation, type PayrollRulesEngine } from "./calculations"
import { buildJoppdItems } from "./joppd"
import type {
  BankPaymentInstruction,
  EmploymentSnapshot,
  JoppdItem,
  PayrollCalculationInput,
  PayrollCalculationResult,
} from "./types"

export async function lockPayout(payoutId: string, userId?: string | null) {
  return db.payout.update({
    where: { id: payoutId },
    data: {
      status: "LOCKED",
      lockedAt: new Date(),
      lockedById: userId ?? undefined,
    },
  })
}

export async function reportPayout(payoutId: string, userId?: string | null) {
  return db.payout.update({
    where: { id: payoutId },
    data: {
      status: "REPORTED",
      reportedAt: new Date(),
      reportedById: userId ?? undefined,
    },
  })
}

export async function calculateAndSnapshotPayoutLine(params: {
  payoutId: string
  payoutLineId: string
  companyId: string
  employment: EmploymentSnapshot
  rulesEngine: PayrollRulesEngine
  overrides?: Record<string, unknown>
  createdById?: string | null
}) {
  const payout = await db.payout.findUnique({
    where: { id: params.payoutId },
    select: { periodFrom: true, periodTo: true, currency: true },
  })

  if (!payout) {
    throw new Error("Payout not found.")
  }

  const payoutLine = await db.payoutLine.findUnique({
    where: { id: params.payoutLineId },
    select: { payoutId: true },
  })

  if (!payoutLine || payoutLine.payoutId !== params.payoutId) {
    throw new Error("Payout line does not belong to payout.")
  }

  const input: PayrollCalculationInput = {
    payoutId: params.payoutId,
    payoutLineId: params.payoutLineId,
    periodFrom: payout.periodFrom,
    periodTo: payout.periodTo,
    currency: payout.currency,
    employment: params.employment,
    overrides: params.overrides,
  }

  const envelope = runPayrollCalculation(params.rulesEngine, input)

  const snapshot = await db.calculationSnapshot.create({
    data: {
      companyId: params.companyId,
      payoutId: params.payoutId,
      payoutLineId: params.payoutLineId,
      rulesEngineSnapshot: envelope.rulesEngineSnapshot,
      employmentSnapshot: envelope.employmentSnapshot,
      inputSnapshot: envelope.inputSnapshot,
      outputSnapshot: envelope.outputSnapshot,
      createdById: params.createdById ?? undefined,
    },
  })

  return { snapshot, result: envelope.outputSnapshot }
}

export async function buildPayoutOutputs(payoutId: string): Promise<{
  joppdItems: JoppdItem[]
  bankInstructions: BankPaymentInstruction[]
}> {
  const payout = await db.payout.findUnique({
    where: { id: payoutId },
    include: {
      lines: true,
      snapshots: {
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!payout) {
    throw new Error("Payout not found.")
  }

  const calculationByLine = new Map<string, PayrollCalculationResult>()
  for (const snapshot of payout.snapshots) {
    if (!snapshot.payoutLineId) continue
    if (calculationByLine.has(snapshot.payoutLineId)) continue
    calculationByLine.set(
      snapshot.payoutLineId,
      snapshot.outputSnapshot as PayrollCalculationResult
    )
  }

  const joppdItems = buildJoppdItems(
    payout.periodFrom,
    payout.periodTo,
    payout.lines,
    calculationByLine
  )
  const bankInstructions = buildBankInstructions(payout.lines, calculationByLine)

  return { joppdItems, bankInstructions }
}
