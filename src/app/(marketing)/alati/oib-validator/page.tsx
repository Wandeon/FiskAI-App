"use client"

import { useState } from "react"
import Link from "next/link"
import { Shield, CheckCircle, XCircle, Info, FileText, ArrowRight } from "lucide-react"
import { validateOIB } from "@/lib/einvoice/validators"
import { FAQ } from "@/components/content/FAQ"

const faq = [
  {
    q: "Što je OIB?",
    a: "Osobni identifikacijski broj - 11-znamenkasti broj za identifikaciju fizičkih i pravnih osoba u RH.",
  },
  {
    q: "Kako provjeriti valjanost OIB-a?",
    a: "OIB koristi ISO 7064 (MOD 11, 10) algoritam za validaciju kontrolne znamenke.",
  },
  {
    q: "Gdje se koristi OIB?",
    a: "Na računima, poreznim prijavama, ugovorima, te za prijavu u sustav ePorezna.",
  },
]

export default function OIBValidatorPage() {
  const [oib, setOib] = useState("")
  const [result, setResult] = useState<"valid" | "invalid" | null>(null)
  const [hasValidated, setHasValidated] = useState(false)

  const handleValidate = () => {
    if (!oib.trim()) {
      setResult(null)
      setHasValidated(false)
      return
    }

    const isValid = validateOIB(oib)
    setResult(isValid ? "valid" : "invalid")
    setHasValidated(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow only digits and limit to 11 characters
    if (/^\d*$/.test(value) && value.length <= 11) {
      setOib(value)
      setHasValidated(false)
      setResult(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleValidate()
    }
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
            OIB Validator
          </h1>
          <p className="text-lg" style={{ color: "var(--muted)" }}>
            Provjerite valjanost hrvatskog OIB-a (Osobni identifikacijski broj)
          </p>
        </div>

        {/* Validator Card */}
        <div
          className="rounded-lg border p-8 mb-6"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <label
            htmlFor="oib-input"
            className="block text-sm font-medium mb-2"
            style={{ color: "var(--foreground)" }}
          >
            Unesite OIB (11 znamenki)
          </label>

          <div className="flex gap-3 mb-4">
            <input
              id="oib-input"
              type="text"
              value={oib}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="12345678901"
              className="flex-1 px-4 py-3 rounded-md border font-mono text-lg"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
              maxLength={11}
            />
            <button
              onClick={handleValidate}
              disabled={oib.length !== 11}
              className="px-6 py-3 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: oib.length === 11 ? "var(--foreground)" : "var(--muted)",
                color: oib.length === 11 ? "var(--surface)" : "var(--foreground)",
              }}
            >
              Provjeri
            </button>
          </div>

          {/* Result */}
          {hasValidated && result && (
            <div
              className={`rounded-lg p-4 flex items-center gap-3 ${
                result === "valid" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
              } border`}
            >
              {result === "valid" ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-900">OIB je valjan</p>
                    <p className="text-sm text-green-700">
                      OIB {oib} je prošao ISO 7064, MOD 11-10 validaciju
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-red-900">OIB nije valjan</p>
                    <p className="text-sm text-red-700">
                      OIB {oib} nije prošao ISO 7064, MOD 11-10 validaciju
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Character count */}
          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
            {oib.length}/11 znamenki
          </p>
        </div>

        {/* Info Section */}
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
              O OIB-u
            </h3>
          </div>

          <div className="space-y-3 text-sm" style={{ color: "var(--muted)" }}>
            <p>
              <strong style={{ color: "var(--foreground)" }}>
                Osobni identifikacijski broj (OIB)
              </strong>{" "}
              je jedinstveni identifikacijski broj dodijeljen svakoj fizičkoj i pravnoj osobi u
              Hrvatskoj.
            </p>

            <div>
              <p className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
                Format:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Točno 11 znamenki</li>
                <li>Samo numerički znakovi (0-9)</li>
                <li>Koristi ISO 7064, MOD 11-10 algoritam za provjeru kontrolne znamenke</li>
              </ul>
            </div>

            <div>
              <p className="font-medium mb-1" style={{ color: "var(--foreground)" }}>
                Upotreba:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Obavezan za sve poslovne transakcije</li>
                <li>Koristi se na računima i e-računima</li>
                <li>Nužan za prijavu poreza i komunikaciju s državnim tijelima</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Upsell Section */}
        <div className="mt-6 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-purple-600">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-purple-900">
                Automatska validacija na računu
              </h3>
              <p className="mt-1 text-sm text-purple-700">
                FiskAI automatski validira OIB kupca i prodavača kod svakog računa. Nema više
                grešaka koje vraća Porezna.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-purple-800">
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span> Automatska provjera pri unosu
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span> Upozorenje na neispravan OIB
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span> UBL 2.1 e-računi s validiranim podacima
                </li>
              </ul>
              <Link
                href="/register"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
              >
                Isprobaj FiskAI <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <FAQ items={faq} />
      </div>
    </div>
  )
}
