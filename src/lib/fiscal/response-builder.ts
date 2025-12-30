import type { FiscalRequest, Prisma } from "@prisma/client"
import { generateVerificationUrl } from "@/lib/fiscal/qr-generator"

interface FiscalResponseInput {
  status: "SUCCESS" | "FAILED"
  attemptNumber: number
  jir?: string | null
  zki?: string | null
  responseXml?: string | null
  errorCode?: string | null
  errorMessage?: string | null
  httpStatus?: number | null
}

export function buildFiscalResponseCreateInput(
  request: FiscalRequest,
  input: FiscalResponseInput
): Prisma.FiscalResponseCreateInput {
  const qrDateTime = request.qrIssueDate ?? null
  const qrAmount = request.qrAmount ?? null
  const qrVerificationUrl =
    input.jir && qrDateTime && qrAmount
      ? generateVerificationUrl({
          jir: input.jir,
          zki: input.zki ?? request.zki ?? "",
          invoiceNumber: request.qrInvoiceNumber ?? "",
          issuerOib: request.qrIssuerOib ?? "",
          amount: Number(qrAmount),
          dateTime: qrDateTime,
        })
      : null

  return {
    request: { connect: { id: request.id } },
    status: input.status,
    attemptNumber: input.attemptNumber,
    jir: input.jir ?? null,
    zki: input.zki ?? null,
    responseXml: input.responseXml ?? null,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    httpStatus: input.httpStatus ?? null,
    qrJir: input.jir ?? null,
    qrZki: input.zki ?? null,
    qrDateTime,
    qrAmount,
    qrVerificationUrl,
  }
}
