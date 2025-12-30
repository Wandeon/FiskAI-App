import { S3Client } from "@aws-sdk/client-s3"
import { createHash } from "crypto"
import { JoppdSubmissionStatus, Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { generateR2Key } from "@/lib/r2-client"
import { uploadWithRetention } from "@/lib/r2-client-retention"

import { generateJoppdXml, type JoppdLineInput } from "./joppd-generator"
import { signJoppdXml, type SigningCredentials } from "./joppd-signer"

export interface PrepareJoppdSubmissionInput {
  companyId: string
  payoutId: string
  credentials: SigningCredentials
  retentionYears: number
  correctionOfSubmissionId?: string
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

  const correctionLookup = input.lineCorrections ?? {}
  const lineInputs: JoppdLineInput[] = payout.lines.map((line, index) => ({
    lineNumber: line.lineNumber ?? index + 1,
    payoutLineId: line.id,
    recipientName: line.recipientName,
    recipientOib: line.recipientOib,
    grossAmount: decimalToNumber(line.grossAmount),
    netAmount: decimalToNumber(line.netAmount),
    taxAmount: decimalToNumber(line.taxAmount),
    originalLineId: correctionLookup[line.id] ?? null,
    lineData: line.joppdData,
  }))

  const submission = await prisma.joppdSubmission.create({
    data: {
      companyId: input.companyId,
      periodYear: payout.periodYear,
      periodMonth: payout.periodMonth,
      isCorrection: Boolean(input.correctionOfSubmissionId),
      correctedSubmissionId: input.correctionOfSubmissionId ?? null,
    },
  })

  await prisma.joppdSubmissionLine.createMany({
    data: lineInputs.map((line) => ({
      submissionId: submission.id,
      payoutLineId: line.payoutLineId,
      lineNumber: line.lineNumber,
      lineData: line.lineData as Prisma.InputJsonValue,
      originalLineId: line.originalLineId,
    })),
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

export async function markJoppdSubmitted(id: string, submissionReference?: string) {
  return prisma.joppdSubmission.update({
    where: { id },
    data: {
      status: JoppdSubmissionStatus.SUBMITTED,
      submissionReference: submissionReference ?? null,
      submittedAt: new Date(),
    },
  })
}

export async function markJoppdAccepted(id: string) {
  return prisma.joppdSubmission.update({
    where: { id },
    data: {
      status: JoppdSubmissionStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  })
}

export async function markJoppdRejected(id: string, rejectionReason?: string) {
  return prisma.joppdSubmission.update({
    where: { id },
    data: {
      status: JoppdSubmissionStatus.REJECTED,
      rejectedAt: new Date(),
      rejectionReason: rejectionReason ?? null,
    },
  })
}

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  if (!value) {
    return null
  }
  return value.toNumber()
}
