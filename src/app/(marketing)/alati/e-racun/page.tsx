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
import { generateUBLInvoice, validateInvoice, validateOIB } from "@/lib/einvoice"
import type { EInvoice, InvoiceLine, TaxCategory } from "@/lib/einvoice"
import { cn } from "@/lib/utils"
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
  "w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"

export default function ERacunGeneratorPage() {
  const webAppSchema = generateWebApplicationSchema({
    name: "E-Račun Generator",
    description:
      "Generiraj UBL 2.1 XML e-račune spremne za FINA sustav. 2026-ready format za B2B transakcije.",
    url: "https://fisk.ai/alati/e-racun",
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

  // Calculate totals
  const calculateTotals = useCallback(() => {
    const lineExtension = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
    const taxAmount = lineExtension * 0.25 // 25% PDV
    return {
      lineExtension,
      taxAmount,
      total: lineExtension + taxAmount,
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
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <h1 className="mb-3 text-3xl font-bold text-white">2026-Ready E-Račun Generator</h1>
            <p className="text-lg text-white/60">
              Generiraj UBL 2.1 XML e-račune spremne za FINA sustav
            </p>
          </div>

          {/* 2026 Warning Banner */}
          <div className="mb-6 rounded-lg border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-4">
            <div className="flex items-start gap-3">
              <Rocket className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div className="text-sm">
                <p className="mb-1 font-bold text-red-900">
                  Od 1. siječnja 2026. e-računi su OBVEZNI za B2B transakcije
                </p>
                <p className="text-red-800">
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
              <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-5">
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
                      className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
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
                      className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
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
                      className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Seller */}
              <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-5">
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
                          oibErrors.seller && "border-red-500"
                        )}
                      />
                      {oibErrors.seller && (
                        <p className="mt-1 text-xs text-red-600">{oibErrors.seller}</p>
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
                      className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
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
              <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-5">
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
                          oibErrors.buyer && "border-red-500"
                        )}
                      />
                      {oibErrors.buyer && (
                        <p className="mt-1 text-xs text-red-600">{oibErrors.buyer}</p>
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
                      className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
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
              <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold text-white">Stavke računa</h2>
                  <button
                    onClick={addLine}
                    className="flex items-center gap-1 rounded bg-cyan-600 px-2 py-1 text-xs font-medium text-white hover:bg-cyan-700"
                  >
                    <Plus className="h-3 w-3" /> Dodaj
                  </button>
                </div>

                <div className="space-y-3">
                  {lines.map((line, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded border border-white/20 bg-white/5 p-3"
                    >
                      <div className="flex items-start justify-between">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateLine(index, "description", e.target.value)}
                          placeholder="Opis usluge/proizvoda"
                          className="flex-1 rounded border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-white/40"
                        />
                        {lines.length > 1 && (
                          <button
                            onClick={() => removeLine(index)}
                            className="ml-2 p-1 text-red-500 hover:text-red-700"
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
                            className="w-full rounded border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white"
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
                            className="w-full rounded border border-white/20 bg-white/5 px-2 py-1.5 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-white/60">Ukupno</label>
                          <div className="rounded bg-white/10 px-2 py-1.5 text-sm font-medium text-white">
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
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-cyan-700"
              >
                <FileCode className="h-5 w-5" />
                Generiraj UBL 2.1 XML
              </button>
            </div>

            {/* Right Column - Output */}
            <div className="space-y-4">
              {/* Validation */}
              {validationResult && (
                <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                  <h3 className="mb-3 font-semibold text-white">Validacija</h3>
                  {validationResult.valid ? (
                    <div className="flex items-start gap-3 rounded border border-green-200 bg-green-50 p-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-900">Račun je valjan!</p>
                        <p className="text-sm text-green-700">Spreman za FINA sustav e-računa</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 rounded border border-red-200 bg-red-50 p-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                        <div>
                          <p className="font-semibold text-red-900">Pronađene greške</p>
                          <p className="text-sm text-red-700">
                            {validationResult.errors.length} greška/e
                          </p>
                        </div>
                      </div>
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                        {validationResult.errors.map((e, i) => (
                          <div key={i} className="rounded bg-red-50 p-2 text-xs">
                            <span className="font-medium text-red-900">{e.field}:</span>{" "}
                            <span className="text-red-700">{e.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* XML Output */}
              {xmlOutput && (
                <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm">
                  <div className="flex items-center justify-between border-b border-white/10 p-4">
                    <h3 className="font-semibold text-white">UBL 2.1 XML</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 rounded border border-white/20 bg-white/5 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
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
                    <pre className="max-h-96 overflow-auto rounded bg-gray-900 p-4 text-xs text-green-400">
                      <code>{xmlOutput}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* Upsell */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <Rocket className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-400" />
                  <div>
                    <p className="mb-2 font-bold text-white">Želiš automatski slati e-račune?</p>
                    <p className="mb-3 text-sm text-white/70">
                      FiskAI automatski generira, validira i šalje e-račune putem FINA sustava.
                      Spremi podatke kupaca, prati plaćanja, i budi 100% usklađen.
                    </p>
                    <a
                      href="/register"
                      className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
                    >
                      Započni besplatno <span>→</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Info */}
              {!xmlOutput && (
                <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-5">
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
                    <p className="mt-3 rounded bg-yellow-50 p-2 text-xs text-yellow-800">
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
