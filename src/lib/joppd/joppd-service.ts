import { S3Client } from "@aws-sdk/client-s3"
import { createHash } from "crypto"
import { JoppdSubmissionStatus, Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { generateR2Key } from "@/lib/r2-client"
import { uploadWithRetention } from "@/lib/r2-client-retention"
import { getEffectiveRuleVersion } from "@/lib/fiscal-rules/service"

import { generateJoppdXml, type JoppdLineInput } from "./joppd-generator"
import { signJoppdXml, type SigningCredentials } from "./joppd-signer"
import { validateJoppdXml } from "./joppd-xml-schema"

export interface PrepareJoppdSubmissionInput {
  companyId: string
  payoutId: string
  credentials: SigningCredentials
  retentionYears: number
  correctionOfSubmissionId?: string
  lineCorrections?: Record<string, string>
}

export interface PrepareJoppdCorrectionInput {
  companyId: string
  originalSubmissionId: string
  credentials: SigningCredentials
  retentionYears: number
  lineCorrections?: Record<string, string>
}

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
})

export async function prepareJoppdSubmission(input: PrepareJoppdSubmissionInput) {
  const payout = await prisma.payout.findUnique({
    where: { id: input.payoutId },
    include: {
      company: true,
      lines: {
        orderBy: { lineNumber: "asc" },
      },
    },
  })

  if (!payout || payout.companyId !== input.companyId) {
    throw new Error("Payout not found for provided company")
  }

  const ruleVersion = await getEffectiveRuleVersion("JOPPD_CODEBOOK", payout.payoutDate)
  const correctionLookup = input.lineCorrections ?? {}
  const lineInputs: JoppdLineInput[] = payout.lines.map((line, index) => ({
    lineNumber: line.lineNumber ?? index + 1,
    payoutLineId: line.id,
    recipientName: line.employeeName ?? line.recipientName,
    recipientOib: line.employeeOib ?? line.recipientOib,
    grossAmount: decimalToNumber(line.grossAmount),
    netAmount: decimalToNumber(line.netAmount),
    taxAmount: decimalToNumber(line.taxAmount),
    originalLineId: correctionLookup[line.id] ?? null,
    lineData: line.joppdData,
  }))

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.joppdSubmission.create({
      data: {
        companyId: input.companyId,
        periodYear: payout.periodYear,
        periodMonth: payout.periodMonth,
        isCorrection: Boolean(input.correctionOfSubmissionId),
        correctedSubmissionId: input.correctionOfSubmissionId ?? null,
      },
    })

    await tx.joppdSubmissionLine.createMany({
      data: lineInputs.map((line) => ({
        submissionId: created.id,
        payoutLineId: line.payoutLineId,
        lineNumber: line.lineNumber,
        lineData: line.lineData as Prisma.InputJsonValue,
        originalLineId: line.originalLineId,
        ruleVersionId: ruleVersion.id,
      })),
    })

    await tx.joppdSubmissionEvent.create({
      data: {
        submissionId: created.id,
        status: JoppdSubmissionStatus.PREPARED,
        note: created.isCorrection ? "Correction draft prepared" : "Submission prepared",
      },
    })

    return created
  })

  const xmlPayload = generateJoppdXml({
    submissionId: submission.id,
    companyOib: payout.company.oib,
    companyName: payout.company.name,
    periodYear: payout.periodYear,
    periodMonth: payout.periodMonth,
    payoutId: payout.id,
    payoutDate: payout.payoutDate,
    createdAt: submission.createdAt ?? new Date(),
    correctionOfSubmissionId: input.correctionOfSubmissionId ?? null,
    lines: lineInputs,
  })

  const validation = validateJoppdXml(xmlPayload)
  if (!validation.valid) {
    throw new Error(`JOPPD XML failed schema validation: ${validation.errors.join("; ")}`)
  }

  const signedXml = signJoppdXml(xmlPayload, input.credentials)
  const signedXmlHash = createHash("sha256").update(signedXml).digest("hex")
  const storageKey = generateR2Key(input.companyId, signedXmlHash, `joppd-${submission.id}.xml`)

  await uploadWithRetention(r2Client, storageKey, Buffer.from(signedXml), "application/xml", {
    retentionYears: input.retentionYears,
    metadata: {
      "submission-id": submission.id,
      "company-id": input.companyId,
      "payout-id": payout.id,
      "period-year": payout.periodYear.toString(),
      "period-month": payout.periodMonth.toString(),
    },
  })

  return prisma.joppdSubmission.update({
    where: { id: submission.id },
    data: {
      signedXmlStorageKey: storageKey,
      signedXmlHash,
    },
  })
}

export async function prepareJoppdCorrection(input: PrepareJoppdCorrectionInput) {
  const originalSubmission = await prisma.joppdSubmission.findUnique({
    where: { id: input.originalSubmissionId },
    include: {
      lines: {
        orderBy: { lineNumber: "asc" },
        include: {
          payoutLine: {
            include: {
              payout: {
                include: {
                  company: true,
                  lines: {
                    orderBy: { lineNumber: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!originalSubmission) {
    throw new Error("Original submission not found")
  }

  if (originalSubmission.companyId !== input.companyId) {
    throw new Error("Original submission does not belong to provided company")
  }

  if (originalSubmission.lines.length === 0) {
    throw new Error("Original submission has no lines to correct")
  }

  const payout = originalSubmission.lines[0].payoutLine.payout
  if (!payout) {
    throw new Error("Payout not found for correction workflow")
  }

  const payoutIdSet = new Set(originalSubmission.lines.map((line) => line.payoutLine.payoutId))
  if (payoutIdSet.size > 1) {
    throw new Error("Correction workflow requires a single payout per submission")
  }

  const defaultRuleVersionId =
    originalSubmission.lines.find((line) => line.ruleVersionId)?.ruleVersionId ??
    (await getEffectiveRuleVersion("JOPPD_CODEBOOK", payout.payoutDate)).id

  const originalLineLookup = new Map(
    originalSubmission.lines.map((line) => [line.payoutLineId, line])
  )
  const correctionLookup = input.lineCorrections ?? {}

  const lineInputs: JoppdLineInput[] = payout.lines.map((line, index) => ({
    lineNumber: line.lineNumber ?? index + 1,
    payoutLineId: line.id,
    recipientName: line.recipientName,
    recipientOib: line.recipientOib,
    grossAmount: decimalToNumber(line.grossAmount),
    netAmount: decimalToNumber(line.netAmount),
    taxAmount: decimalToNumber(line.taxAmount),
    originalLineId: correctionLookup[line.id] ?? originalLineLookup.get(line.id)?.id ?? null,
    lineData: line.joppdData,
  }))

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.joppdSubmission.create({
      data: {
        companyId: input.companyId,
        periodYear: payout.periodYear,
        periodMonth: payout.periodMonth,
        isCorrection: true,
        correctedSubmissionId: originalSubmission.id,
      },
    })

    await tx.joppdSubmissionLine.createMany({
      data: lineInputs.map((line) => ({
        submissionId: created.id,
        payoutLineId: line.payoutLineId,
        lineNumber: line.lineNumber,
        lineData: line.lineData as Prisma.InputJsonValue,
        originalLineId: line.originalLineId,
        ruleVersionId:
          originalLineLookup.get(line.payoutLineId)?.ruleVersionId ?? defaultRuleVersionId,
      })),
    })

    await tx.joppdSubmissionEvent.create({
      data: {
        submissionId: created.id,
        status: JoppdSubmissionStatus.PREPARED,
        note: `Correction prepared for submission ${originalSubmission.id}`,
      },
    })

    return created
  })

  const xmlPayload = generateJoppdXml({
    submissionId: submission.id,
    companyOib: payout.company.oib,
    companyName: payout.company.name,
    periodYear: payout.periodYear,
    periodMonth: payout.periodMonth,
    payoutId: payout.id,
    payoutDate: payout.payoutDate,
    createdAt: submission.createdAt ?? new Date(),
    correctionOfSubmissionId: originalSubmission.id,
    lines: lineInputs,
  })

  const validation = validateJoppdXml(xmlPayload)
  if (!validation.valid) {
    throw new Error(`JOPPD XML failed schema validation: ${validation.errors.join("; ")}`)
  }

  const signedXml = signJoppdXml(xmlPayload, input.credentials)
  const signedXmlHash = createHash("sha256").update(signedXml).digest("hex")
  const storageKey = generateR2Key(input.companyId, signedXmlHash, `joppd-${submission.id}.xml`)

  await uploadWithRetention(r2Client, storageKey, Buffer.from(signedXml), "application/xml", {
    retentionYears: input.retentionYears,
    metadata: {
      "submission-id": submission.id,
      "company-id": input.companyId,
      "payout-id": payout.id,
      "period-year": payout.periodYear.toString(),
      "period-month": payout.periodMonth.toString(),
      "correction-of": originalSubmission.id,
    },
  })

  return prisma.joppdSubmission.update({
    where: { id: submission.id },
    data: {
      signedXmlStorageKey: storageKey,
      signedXmlHash,
    },
  })
}

export async function markJoppdSubmitted(id: string, submissionReference?: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.joppdSubmission.update({
      where: { id },
      data: {
        status: JoppdSubmissionStatus.SUBMITTED,
        submissionReference: submissionReference ?? null,
        submittedAt: new Date(),
      },
    })

    await tx.joppdSubmissionEvent.create({
      data: {
        submissionId: id,
        status: JoppdSubmissionStatus.SUBMITTED,
        note: submissionReference ? `Submission reference: ${submissionReference}` : null,
      },
    })

    return updated
  })
}

export async function markJoppdAccepted(id: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.joppdSubmission.update({
      where: { id },
      data: {
        status: JoppdSubmissionStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    })

    await tx.joppdSubmissionEvent.create({
      data: {
        submissionId: id,
        status: JoppdSubmissionStatus.ACCEPTED,
      },
    })

    return updated
  })
}

export async function markJoppdRejected(id: string, rejectionReason?: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.joppdSubmission.update({
      where: { id },
      data: {
        status: JoppdSubmissionStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: rejectionReason ?? null,
      },
    })

    await tx.joppdSubmissionEvent.create({
      data: {
        submissionId: id,
        status: JoppdSubmissionStatus.REJECTED,
        note: rejectionReason ?? null,
      },
    })

    return updated
  })
}

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  if (!value) {
    return null
  }
  return value.toNumber()
}
