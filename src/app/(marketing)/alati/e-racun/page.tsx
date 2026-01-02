"use client"

import { useState, useCallback } from "react"
import {
  FileText,
  Copy,
  AlertTriangle,
  CheckCircle,
  Info,
  Rocket,
  Plus,
  Trash2,
  FileCode,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { calculateVatFromNet } from "@/interfaces/invoicing/InvoiceDisplayAdapter"

// ============================================================================
// Demo Types (inlined for client-side demo page)
// ============================================================================

type TaxCategoryCode = "S" | "Z" | "E" | "AE" | "K" | "G" | "O" | "L" | "M"

interface Address {
  streetName: string
  city: string
  postalCode: string
  country: string
}

interface Party {
  name: string
  oib: string
  address: Address
  vatNumber?: string
}

interface TaxCategory {
  code: TaxCategoryCode
  percent: number
  taxScheme?: string
}

interface TaxSubtotal {
  taxableAmount: number
  taxAmount: number
  taxCategory: TaxCategory
}

interface TaxTotal {
  taxAmount: number
  taxSubtotals: TaxSubtotal[]
}

interface MonetaryTotal {
  lineExtensionAmount: number
  taxExclusiveAmount: number
  taxInclusiveAmount: number
  payableAmount: number
}

interface InvoiceLine {
  id: string
  description: string
  quantity: number
  unitCode: string
  unitPrice: number
  taxCategory: TaxCategory
  lineTotal: number
}

interface EInvoice {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  currencyCode: string
  seller: Party
  buyer: Party
  lines: InvoiceLine[]
  taxTotal: TaxTotal
  legalMonetaryTotal: MonetaryTotal
}

interface ValidationError {
  field: string
  message: string
  code?: string
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// ============================================================================
// Demo Validators (inlined for client-side demo page)
// ============================================================================

/**
 * Validates Croatian OIB using ISO 7064, MOD 11-10 algorithm
 */
function validateOIB(oib: string): boolean {
  const cleaned = oib.replace(/\s/g, "")
  if (!/^\d{11}$/.test(cleaned)) return false

  let controlNumber = 10
  for (let i = 0; i < 10; i++) {
    controlNumber = (controlNumber + parseInt(cleaned[i])) % 10
    if (controlNumber === 0) controlNumber = 10
    controlNumber = (controlNumber * 2) % 11
  }

  const checkDigit = 11 - controlNumber === 10 ? 0 : 11 - controlNumber
  return checkDigit === parseInt(cleaned[10])
}

function validateParty(party: Party, role: "seller" | "buyer"): ValidationError[] {
  const errors: ValidationError[] = []
  const prefix = role

  if (!party.name?.trim()) {
    errors.push({ field: `${prefix}.name`, message: `${role} name is required`, code: "REQUIRED" })
  }
  if (!party.oib) {
    errors.push({ field: `${prefix}.oib`, message: `${role} OIB is required`, code: "REQUIRED" })
  } else if (!validateOIB(party.oib)) {
    errors.push({
      field: `${prefix}.oib`,
      message: `Invalid OIB: ${party.oib}`,
      code: "INVALID_OIB",
    })
  }

  return errors
}

function validateInvoice(invoice: EInvoice): ValidationResult {
  const errors: ValidationError[] = []

  if (!invoice.invoiceNumber?.trim()) {
    errors.push({ field: "invoiceNumber", message: "Invoice number is required", code: "REQUIRED" })
  }
  if (!invoice.issueDate?.trim()) {
    errors.push({ field: "issueDate", message: "Issue date is required", code: "REQUIRED" })
  }

  errors.push(...validateParty(invoice.seller, "seller"))
  errors.push(...validateParty(invoice.buyer, "buyer"))

  if (!invoice.lines?.length) {
    errors.push({
      field: "lines",
      message: "At least one invoice line is required",
      code: "REQUIRED",
    })
  }

  return { valid: errors.length === 0, errors }
}

// ============================================================================
// Demo UBL Generator (inlined for client-side demo page)
// ============================================================================

function escapeXML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function generateUBLInvoice(invoice: EInvoice, options: { prettyPrint?: boolean } = {}): string {
  const indent = options.prettyPrint ? "  " : ""
  const currencyCode = invoice.currencyCode

  const generateAddress = (address: Address, ind: string) => `${ind}<cac:PostalAddress>
${ind}  <cbc:StreetName>${escapeXML(address.streetName)}</cbc:StreetName>
${ind}  <cbc:CityName>${escapeXML(address.city)}</cbc:CityName>
${ind}  <cbc:PostalZone>${escapeXML(address.postalCode)}</cbc:PostalZone>
${ind}  <cac:Country>
${ind}    <cbc:IdentificationCode>${escapeXML(address.country)}</cbc:IdentificationCode>
${ind}  </cac:Country>
${ind}</cac:PostalAddress>`

  const generateParty = (party: Party, role: "supplier" | "customer", ind: string) => {
    const tag = role === "supplier" ? "AccountingSupplierParty" : "AccountingCustomerParty"
    let xml = `${ind}<cac:${tag}>
${ind}  <cac:Party>
${ind}    <cbc:EndpointID schemeID="HR:OIB">${escapeXML(party.oib)}</cbc:EndpointID>
${ind}    <cac:PartyName>
${ind}      <cbc:Name>${escapeXML(party.name)}</cbc:Name>
${ind}    </cac:PartyName>
${generateAddress(party.address, ind + "    ")}`

    if (party.vatNumber) {
      xml += `
${ind}    <cac:PartyTaxScheme>
${ind}      <cbc:CompanyID>${escapeXML(party.vatNumber)}</cbc:CompanyID>
${ind}      <cac:TaxScheme>
${ind}        <cbc:ID>VAT</cbc:ID>
${ind}      </cac:TaxScheme>
${ind}    </cac:PartyTaxScheme>`
    }

    xml += `
${ind}    <cac:PartyLegalEntity>
${ind}      <cbc:RegistrationName>${escapeXML(party.name)}</cbc:RegistrationName>
${ind}      <cbc:CompanyID schemeID="HR:OIB">${escapeXML(party.oib)}</cbc:CompanyID>
${ind}    </cac:PartyLegalEntity>
${ind}  </cac:Party>
${ind}</cac:${tag}>`
    return xml
  }

  const generateLine = (line: InvoiceLine, ind: string) => `${ind}<cac:InvoiceLine>
${ind}  <cbc:ID>${escapeXML(line.id)}</cbc:ID>
${ind}  <cbc:InvoicedQuantity unitCode="${escapeXML(line.unitCode)}">${line.quantity.toFixed(2)}</cbc:InvoicedQuantity>
${ind}  <cbc:LineExtensionAmount currencyID="${currencyCode}">${line.lineTotal.toFixed(2)}</cbc:LineExtensionAmount>
${ind}  <cac:Item>
${ind}    <cbc:Description>${escapeXML(line.description)}</cbc:Description>
${ind}    <cbc:Name>${escapeXML(line.description)}</cbc:Name>
${ind}    <cac:ClassifiedTaxCategory>
${ind}      <cbc:ID>${escapeXML(line.taxCategory.code)}</cbc:ID>
${ind}      <cbc:Percent>${line.taxCategory.percent.toFixed(2)}</cbc:Percent>
${ind}      <cac:TaxScheme>
${ind}        <cbc:ID>${escapeXML(line.taxCategory.taxScheme || "VAT")}</cbc:ID>
${ind}      </cac:TaxScheme>
${ind}    </cac:ClassifiedTaxCategory>
${ind}  </cac:Item>
${ind}  <cac:Price>
${ind}    <cbc:PriceAmount currencyID="${currencyCode}">${line.unitPrice.toFixed(2)}</cbc:PriceAmount>
${ind}  </cac:Price>
${ind}</cac:InvoiceLine>`

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
${indent}<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fina.hr:2.0</cbc:CustomizationID>
${indent}<cbc:ProfileID>urn:fina.hr:profiles:core:ver2.0</cbc:ProfileID>
${indent}<cbc:ID>${escapeXML(invoice.invoiceNumber)}</cbc:ID>
${indent}<cbc:IssueDate>${invoice.issueDate}</cbc:IssueDate>
${indent}<cbc:DueDate>${invoice.dueDate}</cbc:DueDate>
${indent}<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
${indent}<cbc:DocumentCurrencyCode>${escapeXML(currencyCode)}</cbc:DocumentCurrencyCode>
${generateParty(invoice.seller, "supplier", indent)}
${generateParty(invoice.buyer, "customer", indent)}
${indent}<cac:TaxTotal>
${indent}  <cbc:TaxAmount currencyID="${currencyCode}">${invoice.taxTotal.taxAmount.toFixed(2)}</cbc:TaxAmount>
${invoice.taxTotal.taxSubtotals
  .map(
    (s) => `${indent}  <cac:TaxSubtotal>
${indent}    <cbc:TaxableAmount currencyID="${currencyCode}">${s.taxableAmount.toFixed(2)}</cbc:TaxableAmount>
${indent}    <cbc:TaxAmount currencyID="${currencyCode}">${s.taxAmount.toFixed(2)}</cbc:TaxAmount>
${indent}    <cac:TaxCategory>
${indent}      <cbc:ID>${escapeXML(s.taxCategory.code)}</cbc:ID>
${indent}      <cbc:Percent>${s.taxCategory.percent.toFixed(2)}</cbc:Percent>
${indent}      <cac:TaxScheme>
${indent}        <cbc:ID>VAT</cbc:ID>
${indent}      </cac:TaxScheme>
${indent}    </cac:TaxCategory>
${indent}  </cac:TaxSubtotal>`
  )
  .join("\n")}
${indent}</cac:TaxTotal>
${indent}<cac:LegalMonetaryTotal>
${indent}  <cbc:LineExtensionAmount currencyID="${currencyCode}">${invoice.legalMonetaryTotal.lineExtensionAmount.toFixed(2)}</cbc:LineExtensionAmount>
${indent}  <cbc:TaxExclusiveAmount currencyID="${currencyCode}">${invoice.legalMonetaryTotal.taxExclusiveAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
${indent}  <cbc:TaxInclusiveAmount currencyID="${currencyCode}">${invoice.legalMonetaryTotal.taxInclusiveAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
${indent}  <cbc:PayableAmount currencyID="${currencyCode}">${invoice.legalMonetaryTotal.payableAmount.toFixed(2)}</cbc:PayableAmount>
${indent}</cac:LegalMonetaryTotal>
${invoice.lines.map((l) => generateLine(l, indent)).join("\n")}
</Invoice>`

  return xml
}

// ============================================================================
// Page Component
// ============================================================================
import { FAQ } from "@/components/content/FAQ"
import { generateWebApplicationSchema } from "@/lib/schema/webApplication"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const faq = [
  {
    q: "Što je e-račun?",
    a: "Elektronički račun u strukturiranom formatu (UBL 2.1) koji se razmjenjuje putem PEPPOL mreže.",
  },
  {
    q: "Tko mora izdavati e-račune?",
    a: "Od 1.1.2026. svi PDV obveznici za B2B/B2G, od 1.1.2027. svi poduzetnici.",
  },
  {
    q: "Što je PEPPOL?",
    a: "Pan-europska mreža za razmjenu e-dokumenata između poslovnih subjekata.",
  },
]

const DEFAULT_TAX_CATEGORY: TaxCategory = {
  code: "S",
  percent: 25,
  taxScheme: "VAT",
}

const initialLine: InvoiceLine = {
  id: "1",
  description: "",
  quantity: 1,
  unitCode: "C62",
  unitPrice: 0,
  taxCategory: DEFAULT_TAX_CATEGORY,
  lineTotal: 0,
}

const textInputClassName =
  "w-full rounded border border-white/20 bg-surface/5 px-3 py-2 text-sm text-white placeholder:text-white/40"

export default function ERacunGeneratorPage() {
  const webAppSchema = generateWebApplicationSchema({
    name: "E-Račun Generator",
    description:
      "Generiraj UBL 2.1 XML e-račune spremne za FINA sustav. 2026-ready format za B2B transakcije.",
    url: "https://fiskai.hr/alati/e-racun",
  })

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  )

  // Seller
  const [sellerName, setSellerName] = useState("")
  const [sellerOIB, setSellerOIB] = useState("")
  const [sellerAddress, setSellerAddress] = useState("")
  const [sellerCity, setSellerCity] = useState("")
  const [sellerPostal, setSellerPostal] = useState("")

  // Buyer
  const [buyerName, setBuyerName] = useState("")
  const [buyerOIB, setBuyerOIB] = useState("")
  const [buyerAddress, setBuyerAddress] = useState("")
  const [buyerCity, setBuyerCity] = useState("")
  const [buyerPostal, setBuyerPostal] = useState("")

  // Lines
  const [lines, setLines] = useState<InvoiceLine[]>([{ ...initialLine }])

  // Output
  const [xmlOutput, setXmlOutput] = useState<string>("")
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    errors: Array<{ field: string; message: string; code?: string }>
  } | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [oibErrors, setOibErrors] = useState<{ seller?: string; buyer?: string }>({})

  // Calculate totals using domain layer for VAT calculations
  const calculateTotals = useCallback(() => {
    const lineExtension = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
    // Use domain adapter instead of direct float multiplication
    const vatResult = calculateVatFromNet(lineExtension, 25) // 25% PDV
    return {
      lineExtension: vatResult.netAmount,
      taxAmount: vatResult.vatAmount,
      total: vatResult.totalAmount,
    }
  }, [lines])

  const totals = calculateTotals()

  const addLine = () => {
    setLines([
      ...lines,
      {
        ...initialLine,
        id: String(lines.length + 1),
      },
    ])
  }

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index))
    }
  }

  const updateLine = (index: number, field: keyof InvoiceLine, value: string | number) => {
    const updated = [...lines]
    if (field === "quantity" || field === "unitPrice") {
      const numVal = typeof value === "string" ? parseFloat(value) || 0 : value
      updated[index] = {
        ...updated[index],
        [field]: numVal,
        lineTotal:
          field === "quantity"
            ? numVal * updated[index].unitPrice
            : updated[index].quantity * numVal,
      }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setLines(updated)
  }

  const validateOIBField = (oib: string, field: "seller" | "buyer") => {
    if (!oib) {
      setOibErrors((prev) => ({ ...prev, [field]: undefined }))
      return
    }
    const isValid = validateOIB(oib)
    setOibErrors((prev) => ({
      ...prev,
      [field]: isValid ? undefined : "Neispravan OIB (provjera kontrolne znamenke)",
    }))
  }

  const buildInvoice = (): EInvoice => ({
    invoiceNumber,
    issueDate,
    dueDate,
    currencyCode: "EUR",
    seller: {
      name: sellerName,
      oib: sellerOIB,
      address: {
        streetName: sellerAddress,
        city: sellerCity,
        postalCode: sellerPostal,
        country: "HR",
      },
      vatNumber: `HR${sellerOIB}`,
    },
    buyer: {
      name: buyerName,
      oib: buyerOIB,
      address: {
        streetName: buyerAddress,
        city: buyerCity,
        postalCode: buyerPostal,
        country: "HR",
      },
      vatNumber: buyerOIB ? `HR${buyerOIB}` : undefined,
    },
    lines: lines.map((l, i) => ({
      ...l,
      id: String(i + 1),
      lineTotal: l.quantity * l.unitPrice,
    })),
    taxTotal: {
      taxAmount: totals.taxAmount,
      taxSubtotals: [
        {
          taxableAmount: totals.lineExtension,
          taxAmount: totals.taxAmount,
          taxCategory: DEFAULT_TAX_CATEGORY,
        },
      ],
    },
    legalMonetaryTotal: {
      lineExtensionAmount: totals.lineExtension,
      taxExclusiveAmount: totals.lineExtension,
      taxInclusiveAmount: totals.total,
      payableAmount: totals.total,
    },
  })

  const handleGenerate = () => {
    const invoice = buildInvoice()
    const validation = validateInvoice(invoice)
    setValidationResult(validation)
    const xml = generateUBLInvoice(invoice, { prettyPrint: true })
    setXmlOutput(xml)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(xmlOutput)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleDownloadXML = () => {
    const blob = new Blob([xmlOutput], { type: "application/xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${invoiceNumber || "racun"}.xml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <SectionBackground>
      <div className="container mx-auto px-4 py-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
        />
        <div className="mx-auto max-w-6xl">
          {/* Header with 2026 urgency */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-interactive to-interactive">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-3 text-3xl font-bold text-white">2026-Ready E-Račun Generator</h1>
            <p className="text-lg text-white/60">
              Generiraj UBL 2.1 XML e-račune spremne za FINA sustav
            </p>
          </div>

          {/* 2026 Warning Banner */}
          <div className="mb-6 rounded-lg border border-danger-border bg-gradient-to-r from-red-50 to-orange-50 p-4">
            <div className="flex items-start gap-3">
              <Rocket className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-text" />
              <div className="text-sm">
                <p className="mb-1 font-bold text-red-900">
                  Od 1. siječnja 2026. e-računi su OBVEZNI za B2B transakcije
                </p>
                <p className="text-danger-text">
                  PDF računi više neće biti prihvaćeni. Ovaj alat generira pravilan UBL 2.1 XML
                  format koji će zahtijevati FINA.{" "}
                  <a href="/register" className="font-medium underline">
                    Registriraj se za automatsko slanje →
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left Column - Form */}
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-5">
                <h2 className="mb-4 font-semibold text-white">Osnovni podaci</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-white/80">
                      Broj računa *
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="2025-001"
                      className="w-full rounded border border-white/20 bg-surface/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-white/80">
                      Datum izdavanja
                    </label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full rounded border border-white/20 bg-surface/5 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-white/80">
                      Datum dospijeća
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded border border-white/20 bg-surface/5 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Seller */}
              <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-5">
                <h2 className="mb-4 font-semibold text-white">Prodavatelj (vi)</h2>
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/80">
                        Naziv *
                      </label>
                      <input
                        type="text"
                        value={sellerName}
                        onChange={(e) => setSellerName(e.target.value)}
                        placeholder="Vaša firma d.o.o."
                        className={textInputClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/80">OIB *</label>
                      <input
                        type="text"
                        value={sellerOIB}
                        onChange={(e) => {
                          setSellerOIB(e.target.value)
                          validateOIBField(e.target.value, "seller")
                        }}
                        placeholder="12345678901"
                        maxLength={11}
                        className={cn(
                          textInputClassName,
                          oibErrors.seller && "border-danger-border"
                        )}
                      />
                      {oibErrors.seller && (
                        <p className="mt-1 text-xs text-danger-text">{oibErrors.seller}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Adresa</label>
                    <input
                      type="text"
                      value={sellerAddress}
                      onChange={(e) => setSellerAddress(e.target.value)}
                      placeholder="Ulica i kućni broj"
                      className="w-full rounded border border-white/20 bg-surface/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/80">
                        Poštanski broj
                      </label>
                      <input
                        type="text"
                        value={sellerPostal}
                        onChange={(e) => setSellerPostal(e.target.value)}
                        placeholder="10000"
                        className={textInputClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/80">Grad</label>
                      <input
                        type="text"
                        value={sellerCity}
                        onChange={(e) => setSellerCity(e.target.value)}
                        placeholder="Zagreb"
                        className={textInputClassName}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Buyer */}
              <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-5">
                <h2 className="mb-4 font-semibold text-white">Kupac</h2>
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/80">
                        Naziv *
                      </label>
                      <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Kupac d.o.o."
                        className={textInputClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/80">OIB</label>
                      <input
                        type="text"
                        value={buyerOIB}
                        onChange={(e) => {
                          setBuyerOIB(e.target.value)
                          validateOIBField(e.target.value, "buyer")
                        }}
                        placeholder="98765432109"
                        maxLength={11}
                        className={cn(
                          textInputClassName,
                          oibErrors.buyer && "border-danger-border"
                        )}
                      />
                      {oibErrors.buyer && (
                        <p className="mt-1 text-xs text-danger-text">{oibErrors.buyer}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">Adresa</label>
                    <input
                      type="text"
                      value={buyerAddress}
                      onChange={(e) => setBuyerAddress(e.target.value)}
                      placeholder="Ulica i kućni broj"
                      className="w-full rounded border border-white/20 bg-surface/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/80">
                        Poštanski broj
                      </label>
                      <input
                        type="text"
                        value={buyerPostal}
                        onChange={(e) => setBuyerPostal(e.target.value)}
                        placeholder="21000"
                        className={textInputClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/80">Grad</label>
                      <input
                        type="text"
                        value={buyerCity}
                        onChange={(e) => setBuyerCity(e.target.value)}
                        placeholder="Split"
                        className={textInputClassName}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Lines */}
              <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold text-white">Stavke računa</h2>
                  <button
                    onClick={addLine}
                    className="flex items-center gap-1 rounded bg-interactive-hover px-2 py-1 text-xs font-medium text-white hover:bg-interactive-hover"
                  >
                    <Plus className="h-3 w-3" /> Dodaj
                  </button>
                </div>

                <div className="space-y-3">
                  {lines.map((line, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded border border-white/20 bg-surface/5 p-3"
                    >
                      <div className="flex items-start justify-between">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(index, "description", e.target.value)}
                          placeholder="Opis usluge/proizvoda"
                          className="flex-1 rounded border border-white/20 bg-surface/5 px-2 py-1.5 text-sm text-white placeholder:text-white/40"
                        />
                        {lines.length > 1 && (
                          <button
                            onClick={() => removeLine(index)}
                            className="ml-2 p-1 text-danger hover:text-danger-text"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="mb-1 block text-xs text-white/60">Količina</label>
                          <input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, "quantity", e.target.value)}
                            min={1}
                            className="w-full rounded border border-white/20 bg-surface/5 px-2 py-1.5 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-white/60">Cijena (EUR)</label>
                          <input
                            type="number"
                            value={line.unitPrice}
                            onChange={(e) => updateLine(index, "unitPrice", e.target.value)}
                            min={0}
                            step={0.01}
                            className="w-full rounded border border-white/20 bg-surface/5 px-2 py-1.5 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-white/60">Ukupno</label>
                          <div className="rounded bg-surface/10 px-2 py-1.5 text-sm font-medium text-white">
                            {(line.quantity * line.unitPrice).toFixed(2)} EUR
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-sm text-white">
                  <div className="flex justify-between">
                    <span className="text-white/60">Osnovica:</span>
                    <span>{totals.lineExtension.toFixed(2)} EUR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">PDV (25%):</span>
                    <span>{totals.taxAmount.toFixed(2)} EUR</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2 font-bold">
                    <span>UKUPNO:</span>
                    <span>{totals.total.toFixed(2)} EUR</span>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-interactive-hover px-6 py-3 font-semibold text-white transition-colors hover:bg-interactive-hover"
              >
                <FileCode className="h-5 w-5" />
                Generiraj UBL 2.1 XML
              </button>
            </div>

            {/* Right Column - Output */}
            <div className="space-y-4">
              {/* Validation */}
              {validationResult && (
                <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-5">
                  <h3 className="mb-3 font-semibold text-white">Validacija</h3>
                  {validationResult.valid ? (
                    <div className="flex items-start gap-3 rounded border border-success-border bg-success-bg p-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-success-text" />
                      <div>
                        <p className="font-semibold text-green-900">Račun je valjan!</p>
                        <p className="text-sm text-success-text">Spreman za FINA sustav e-računa</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 rounded border border-danger-border bg-danger-bg p-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-text" />
                        <div>
                          <p className="font-semibold text-red-900">Pronađene greške</p>
                          <p className="text-sm text-danger-text">
                            {validationResult.errors.length} greška/e
                          </p>
                        </div>
                      </div>
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                        {validationResult.errors.map((e, i) => (
                          <div key={i} className="rounded bg-danger-bg p-2 text-xs">
                            <span className="font-medium text-red-900">{e.field}:</span>{" "}
                            <span className="text-danger-text">{e.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* XML Output */}
              {xmlOutput && (
                <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm">
                  <div className="flex items-center justify-between border-b border-white/10 p-4">
                    <h3 className="font-semibold text-white">UBL 2.1 XML</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 rounded border border-white/20 bg-surface/5 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-surface/10"
                      >
                        <Copy className="h-3 w-3" />
                        {copySuccess ? "Kopirano!" : "Kopiraj"}
                      </button>
                      <button
                        onClick={handleDownloadXML}
                        className="flex items-center gap-1 rounded bg-green-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                      >
                        <FileCode className="h-3 w-3" />
                        XML
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <pre className="max-h-96 overflow-auto rounded bg-base p-4 text-xs text-success-text">
                      <code>{xmlOutput}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* Upsell */}
              <div className="rounded-lg border border-white/10 bg-surface/5 p-5 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <Rocket className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                  <div>
                    <p className="mb-2 font-bold text-white">Želiš automatski slati e-račune?</p>
                    <p className="mb-3 text-sm text-white/70">
                      FiskAI automatski generira, validira i šalje e-račune putem FINA sustava.
                      Spremi podatke kupaca, prati plaćanja, i budi 100% usklađen.
                    </p>
                    <a
                      href="/register"
                      className="inline-flex items-center gap-2 rounded-lg bg-interactive-hover px-4 py-2 text-sm font-semibold text-white hover:bg-interactive-hover"
                    >
                      Započni besplatno <span>→</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Info */}
              {!xmlOutput && (
                <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-5">
                  <div className="mb-3 flex items-start gap-3">
                    <Info className="h-5 w-5 flex-shrink-0 text-white/60" />
                    <h3 className="font-semibold text-white">Zašto UBL 2.1 XML?</h3>
                  </div>
                  <div className="space-y-2 text-sm text-white/70">
                    <p>
                      <strong>UBL 2.1</strong> (Universal Business Language) je međunarodni standard
                      koji Hrvatska koristi za e-račune od 2026.
                    </p>
                    <ul className="ml-4 list-disc space-y-1">
                      <li>Strukturirani podaci umjesto PDF-a</li>
                      <li>Automatska obrada kod primatelja</li>
                      <li>Validacija prema EN 16931 normi</li>
                      <li>Kompatibilnost s EU Peppol mrežom</li>
                    </ul>
                    <p className="mt-3 rounded bg-warning-bg p-2 text-xs text-warning-text">
                      <strong>Napomena:</strong> Ovaj alat radi 100% u pregledniku. Vaši podaci se
                      NE šalju na server.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <FAQ items={faq} />
        </div>
      </div>
    </SectionBackground>
  )
}
