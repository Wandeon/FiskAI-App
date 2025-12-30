import type { Company, EInvoice, FiscalCertificate } from "@prisma/client"

interface FiscalRequestSnapshotInput {
  invoice: Pick<EInvoice, "invoiceNumber" | "issueDate"> & {
    totalAmount: EInvoice["totalAmount"] | number
  }
  company: Pick<Company, "oib">
  certificate: Pick<
    FiscalCertificate,
    | "certSubject"
    | "certSerial"
    | "certNotBefore"
    | "certNotAfter"
    | "certSha256"
    | "provider"
    | "oibExtracted"
  >
}

export function buildFiscalRequestSnapshot(input: FiscalRequestSnapshotInput) {
  const { invoice, company, certificate } = input

  return {
    certificateSubject: certificate.certSubject,
    certificateSerial: certificate.certSerial,
    certificateNotBefore: certificate.certNotBefore,
    certificateNotAfter: certificate.certNotAfter,
    certificateSha256: certificate.certSha256,
    certificateProvider: certificate.provider,
    certificateOib: certificate.oibExtracted,
    qrInvoiceNumber: invoice.invoiceNumber,
    qrIssuerOib: company.oib,
    qrIssueDate: invoice.issueDate,
    qrAmount: invoice.totalAmount,
  }
}
