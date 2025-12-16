"use client"

import { useState } from "react"
import { FileText, Download, Copy, AlertTriangle, CheckCircle, Info } from "lucide-react"
import { generateUBLInvoice, validateInvoice } from "@/lib/einvoice"
import type { EInvoice } from "@/lib/einvoice"

// Sample invoice data for demo
const SAMPLE_INVOICE: EInvoice = {
  invoiceNumber: "2025-DEMO-001",
  issueDate: "2025-01-15",
  dueDate: "2025-02-14",
  currencyCode: "EUR",
  seller: {
    name: "Demo d.o.o.",
    oib: "12345678901",
    address: {
      streetName: "Ilica 123",
      city: "Zagreb",
      postalCode: "10000",
      country: "HR",
    },
    vatNumber: "HR12345678901",
  },
  buyer: {
    name: "Kupac d.o.o.",
    oib: "98765432109",
    address: {
      streetName: "Vukovarska 45",
      city: "Split",
      postalCode: "21000",
      country: "HR",
    },
    vatNumber: "HR98765432109",
  },
  lines: [
    {
      id: "1",
      description: "Web development usluge",
      quantity: 10,
      unitCode: "C62",
      unitPrice: 500.0,
      taxCategory: {
        code: "S",
        percent: 25,
        taxScheme: "VAT",
      },
      lineTotal: 5000.0,
    },
    {
      id: "2",
      description: "Hosting i održavanje",
      quantity: 1,
      unitCode: "C62",
      unitPrice: 300.0,
      taxCategory: {
        code: "S",
        percent: 25,
        taxScheme: "VAT",
      },
      lineTotal: 300.0,
    },
  ],
  taxTotal: {
    taxAmount: 1325.0,
    taxSubtotals: [
      {
        taxableAmount: 5300.0,
        taxAmount: 1325.0,
        taxCategory: {
          code: "S",
          percent: 25,
          taxScheme: "VAT",
        },
      },
    ],
  },
  legalMonetaryTotal: {
    lineExtensionAmount: 5300.0,
    taxExclusiveAmount: 5300.0,
    taxInclusiveAmount: 6625.0,
    payableAmount: 6625.0,
  },
}

export default function ERacunGeneratorPage() {
  const [xmlOutput, setXmlOutput] = useState<string>("")
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    errors: Array<{ field: string; message: string; code?: string }>
  } | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  const handleGenerate = () => {
    // Validate first
    const validation = validateInvoice(SAMPLE_INVOICE)
    setValidationResult(validation)

    // Generate XML even if there are validation errors (for demo purposes)
    const xml = generateUBLInvoice(SAMPLE_INVOICE, { prettyPrint: true })
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

  const handleDownload = () => {
    const blob = new Blob([xmlOutput], { type: "application/xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${SAMPLE_INVOICE.invoiceNumber}.xml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            E-Račun Generator
          </h1>
          <p className="text-lg" style={{ color: "var(--muted)" }}>
            Generirajte UBL 2.1 XML e-račune prema hrvatskim standardima
          </p>
        </div>

        {/* Disclaimer */}
        <div className="rounded-lg border p-4 mb-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-yellow-900 mb-1">Demo verzija</p>
              <p className="text-yellow-800">
                Ovo je demonstracijska verzija s unaprijed definiranim podacima. Za kreiranje pravih
                e-računa s vašim podacima, registrirajte se na FiskAI platformu.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Invoice Data */}
          <div>
            <div
              className="rounded-lg border p-6 mb-6"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
              }}
            >
              <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--foreground)" }}>
                Podaci računa (demo)
              </h2>

              <div className="space-y-4 text-sm">
                {/* Basic info */}
                <div>
                  <p className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
                    Osnovni podaci
                  </p>
                  <div className="space-y-1" style={{ color: "var(--muted)" }}>
                    <p>Broj računa: {SAMPLE_INVOICE.invoiceNumber}</p>
                    <p>Datum izdavanja: {SAMPLE_INVOICE.issueDate}</p>
                    <p>Datum dospijeća: {SAMPLE_INVOICE.dueDate}</p>
                    <p>Valuta: {SAMPLE_INVOICE.currencyCode}</p>
                  </div>
                </div>

                {/* Seller */}
                <div>
                  <p className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
                    Prodavatelj
                  </p>
                  <div className="space-y-1" style={{ color: "var(--muted)" }}>
                    <p>{SAMPLE_INVOICE.seller.name}</p>
                    <p>OIB: {SAMPLE_INVOICE.seller.oib}</p>
                    <p>{SAMPLE_INVOICE.seller.address.streetName}</p>
                    <p>
                      {SAMPLE_INVOICE.seller.address.postalCode}{" "}
                      {SAMPLE_INVOICE.seller.address.city}
                    </p>
                  </div>
                </div>

                {/* Buyer */}
                <div>
                  <p className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
                    Kupac
                  </p>
                  <div className="space-y-1" style={{ color: "var(--muted)" }}>
                    <p>{SAMPLE_INVOICE.buyer.name}</p>
                    <p>OIB: {SAMPLE_INVOICE.buyer.oib}</p>
                    <p>{SAMPLE_INVOICE.buyer.address.streetName}</p>
                    <p>
                      {SAMPLE_INVOICE.buyer.address.postalCode} {SAMPLE_INVOICE.buyer.address.city}
                    </p>
                  </div>
                </div>

                {/* Lines */}
                <div>
                  <p className="font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    Stavke računa
                  </p>
                  <div className="space-y-2">
                    {SAMPLE_INVOICE.lines.map((line) => (
                      <div
                        key={line.id}
                        className="p-3 rounded border"
                        style={{
                          background: "var(--muted)",
                          borderColor: "var(--border)",
                        }}
                      >
                        <p className="font-medium" style={{ color: "var(--foreground)" }}>
                          {line.description}
                        </p>
                        <p className="text-sm" style={{ color: "var(--muted)" }}>
                          {line.quantity} × {line.unitPrice.toFixed(2)} EUR ={" "}
                          {line.lineTotal.toFixed(2)} EUR
                        </p>
                        <p className="text-sm" style={{ color: "var(--muted)" }}>
                          PDV: {line.taxCategory.percent}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div
                  className="p-4 rounded border"
                  style={{
                    background: "var(--muted)",
                    borderColor: "var(--border)",
                  }}
                >
                  <p className="font-medium mb-2" style={{ color: "var(--foreground)" }}>
                    Ukupno
                  </p>
                  <div className="space-y-1 text-sm" style={{ color: "var(--muted)" }}>
                    <div className="flex justify-between">
                      <span>Osnovica:</span>
                      <span>
                        {SAMPLE_INVOICE.legalMonetaryTotal.taxExclusiveAmount.toFixed(2)} EUR
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>PDV:</span>
                      <span>{SAMPLE_INVOICE.taxTotal.taxAmount.toFixed(2)} EUR</span>
                    </div>
                    <div
                      className="flex justify-between font-semibold pt-2 border-t"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <span style={{ color: "var(--foreground)" }}>Za platiti:</span>
                      <span style={{ color: "var(--foreground)" }}>
                        {SAMPLE_INVOICE.legalMonetaryTotal.payableAmount.toFixed(2)} EUR
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                className="w-full mt-6 px-6 py-3 rounded-md font-medium transition-colors"
                style={{
                  background: "var(--foreground)",
                  color: "var(--surface)",
                }}
              >
                Generiraj XML
              </button>
            </div>
          </div>

          {/* Right Column - XML Output and Validation */}
          <div className="space-y-6">
            {/* Validation Results */}
            {validationResult && (
              <div
                className="rounded-lg border p-6"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--foreground)" }}>
                  Validacija
                </h3>

                {validationResult.valid ? (
                  <div className="flex items-start gap-3 p-3 rounded bg-green-50 border border-green-200">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-900">Račun je valjan</p>
                      <p className="text-sm text-green-700">Sve provjere su prošle uspješno</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 p-3 rounded bg-red-50 border border-red-200">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-900">Pronađene greške</p>
                        <p className="text-sm text-red-700">
                          {validationResult.errors.length} greška/e
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {validationResult.errors.map((error, index) => (
                        <div
                          key={index}
                          className="p-3 rounded text-sm bg-red-50 border border-red-100"
                        >
                          <p className="font-medium text-red-900">{error.field}</p>
                          <p className="text-red-700">{error.message}</p>
                          {error.code && (
                            <p className="text-xs text-red-600 mt-1">Kod: {error.code}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* XML Preview */}
            {xmlOutput && (
              <div
                className="rounded-lg border"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className="p-4 border-b flex items-center justify-between"
                  style={{ borderColor: "var(--border)" }}
                >
                  <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                    XML Preview
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                      style={{
                        background: "var(--muted)",
                        color: "var(--foreground)",
                      }}
                    >
                      <Copy className="w-4 h-4" />
                      {copySuccess ? "Kopirano!" : "Kopiraj"}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                      style={{
                        background: "var(--foreground)",
                        color: "var(--surface)",
                      }}
                    >
                      <Download className="w-4 h-4" />
                      Preuzmi
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  <pre
                    className="text-xs overflow-x-auto p-4 rounded"
                    style={{
                      background: "var(--muted)",
                      color: "var(--foreground)",
                    }}
                  >
                    <code>{xmlOutput}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Info */}
            {!xmlOutput && (
              <div
                className="rounded-lg border p-6"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <Info className="w-5 h-5 flex-shrink-0" style={{ color: "var(--muted)" }} />
                  <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                    O UBL 2.1 XML formatu
                  </h3>
                </div>

                <div className="space-y-3 text-sm" style={{ color: "var(--muted)" }}>
                  <p>
                    UBL (Universal Business Language) je međunarodni standard za elektroničke
                    poslovne dokumente. UBL 2.1 je verzija koja se koristi u Hrvatskoj za
                    e-računanje.
                  </p>

                  <div>
                    <p className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
                      Generiran XML sadrži:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Metapodatke o računu (broj, datum, valuta)</li>
                      <li>Podatke o prodavatelju i kupcu</li>
                      <li>Stavke računa s količinama i cijenama</li>
                      <li>Izračune poreza (PDV)</li>
                      <li>Ukupne iznose</li>
                    </ul>
                  </div>

                  <p className="text-xs">
                    <strong>Napomena:</strong> Za potpunu validaciju i slanje e-računa prema sustavu
                    e-Računa Ministarstva financija potrebna je dodatna integracija i digitalni
                    certifikat.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
