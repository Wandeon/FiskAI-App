import QRCode from "qrcode"

type BarcodeParams = {
  creditorName: string
  creditorIban: string
  amount: number
  currency?: string
  invoiceNumber?: string
  dueDate?: Date | null
  reference?: string
}

// Format amount with 2 decimals and dot separator
const formatAmount = (amount: number, currency: string) => {
  const safe = Number.isFinite(amount) ? amount : 0
  return `${currency}${safe.toFixed(2)}`
}

// EPC QR (SEPA credit transfer) payload; many HR banks accept it.
function buildEpcQrPayload(params: BarcodeParams) {
  const {
    creditorName,
    creditorIban,
    amount,
    currency = "EUR",
    invoiceNumber,
    dueDate,
    reference,
  } = params

  // EPC spec: https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2018-05/EPC069-12%20v2.7%20Payment%20Initiation%20Messages%20Implementation%20Guidelines%20.pdf
  const lines = [
    "BCD", // Identifier
    "001", // Version
    "1", // Character set: UTF-8
    "SCT", // SEPA Credit Transfer
    "", // BIC optional
    creditorName.slice(0, 70),
    creditorIban.replace(/\s+/g, ""),
    formatAmount(amount, currency),
    "", // Purpose code optional
    reference || invoiceNumber || "",
    [
      invoiceNumber ? `Račun: ${invoiceNumber}` : null,
      dueDate ? `Dospijeće: ${dueDate.toISOString().slice(0, 10)}` : null,
    ]
      .filter(Boolean)
      .join(" "),
  ]

  return lines.join("\n")
}

export async function generateInvoiceBarcodeDataUrl(params: BarcodeParams) {
  const payload = buildEpcQrPayload(params)
  // Use medium error correction, small margin
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, scale: 6 })
}
