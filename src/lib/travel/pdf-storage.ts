import { createHash } from "crypto"
import type { TravelPdf } from "@prisma/client"
import { db } from "@/lib/db"
import { generateR2Key, uploadToR2, downloadFromR2 } from "@/lib/r2-client"
import { logServiceBoundarySnapshot } from "@/lib/audit-hooks"
import { runWithAuditContext } from "@/lib/audit-context"

export interface StoreTravelPdfInput {
  companyId: string
  travelOrderId: string
  fileName: string
  data: Buffer
  sourceSnapshot: Record<string, unknown>
  generatedByUserId?: string | null
  reason?: string | null
}

export interface StoredTravelPdfPayload {
  pdf: TravelPdf
  checksumVerified: boolean
  data: Buffer
}

function roundBytes(size: number): number {
  return Math.max(0, Math.trunc(size))
}

async function getNextPdfVersion(travelOrderId: string): Promise<number> {
  const latest = await db.travelPdf.findFirst({
    where: { travelOrderId },
    select: { version: true },
    orderBy: { version: "desc" },
  })

  return (latest?.version ?? 0) + 1
}

export async function storeTravelPdf(input: StoreTravelPdfInput): Promise<TravelPdf> {
  const checksum = createHash("sha256").update(input.data).digest("hex")
  const storageKey = generateR2Key(input.companyId, checksum, input.fileName)
  const version = await getNextPdfVersion(input.travelOrderId)

  await uploadToR2(storageKey, input.data, "application/pdf")

  const pdf = await runWithAuditContext(
    { actorId: input.generatedByUserId ?? undefined, reason: input.reason ?? "travel_pdf_upload" },
    async () => {
      return db.travelPdf.create({
        data: {
          companyId: input.companyId,
          travelOrderId: input.travelOrderId,
          version,
          fileName: input.fileName,
          mimeType: "application/pdf",
          sizeBytes: roundBytes(input.data.length),
          r2Key: storageKey,
          sha256: checksum,
          sourceSnapshot: input.sourceSnapshot,
          generatedByUserId: input.generatedByUserId ?? null,
        },
      })
    }
  )

  await logServiceBoundarySnapshot({
    companyId: input.companyId,
    userId: input.generatedByUserId ?? null,
    actor: input.generatedByUserId ?? null,
    reason: input.reason ?? "travel_pdf_upload",
    action: "CREATE",
    entity: "TravelPdf",
    entityId: pdf.id,
    after: {
      travelOrderId: pdf.travelOrderId,
      fileName: pdf.fileName,
      r2Key: pdf.r2Key,
      sha256: pdf.sha256,
      version: pdf.version,
    },
  })

  return pdf
}

export async function fetchTravelPdfPayload(
  companyId: string,
  travelPdfId: string
): Promise<StoredTravelPdfPayload> {
  const pdf = await db.travelPdf.findFirst({
    where: { id: travelPdfId, companyId },
  })

  if (!pdf) {
    throw new Error("Travel PDF not found")
  }

  const payload = await downloadFromR2(pdf.r2Key)
  const checksum = createHash("sha256").update(payload).digest("hex")
  const checksumVerified = checksum === pdf.sha256

  if (!checksumVerified) {
    throw new Error("Travel PDF checksum mismatch")
  }

  return {
    pdf,
    checksumVerified,
    data: payload,
  }
}
