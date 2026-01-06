"use client"

import { useState } from "react"
import Link from "next/link"
import { Shield, CheckCircle, XCircle, Info, FileText, ArrowRight } from "lucide-react"
/**
 * Validates Croatian OIB (Osobni identifikacijski broj)
 * using ISO 7064, MOD 11-10 algorithm
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
import { FAQ } from "@/components/content/FAQ"
import { generateWebApplicationSchema } from "@/lib/schema/webApplication"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

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

  const webAppSchema = generateWebApplicationSchema({
    name: "OIB Validator",
    description: "Provjerite valjanost hrvatskog OIB-a (Osobni identifikacijski broj)",
    url: "https://fiskai.hr/alati/oib-validator",
  })

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
    <SectionBackground>
      <div className="container mx-auto px-4 py-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
        />
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-chart-2 to-chart-3 mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-3 text-white">OIB Validator</h1>
            <p className="text-lg text-white/60">
              Provjerite valjanost hrvatskog OIB-a (Osobni identifikacijski broj)
            </p>
          </div>

          {/* Validator Card */}
          <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-8 mb-6">
            <label htmlFor="oib-input" className="block text-sm font-medium mb-2 text-white/90">
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
                className="flex-1 px-4 py-3 rounded-md border border-white/20 bg-surface/5 font-mono text-lg text-white placeholder:text-white/40"
                maxLength={11}
              />
              <button
                onClick={handleValidate}
                disabled={oib.length !== 11}
                className="px-6 py-3 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-interactive-hover text-white hover:bg-interactive-hover disabled:bg-surface/10"
              >
                Provjeri
              </button>
            </div>

            {/* Result */}
            {hasValidated && result && (
              <div
                className={`rounded-lg p-4 flex items-center gap-3 ${
                  result === "valid"
                    ? "bg-success-bg border-success-border"
                    : "bg-danger-bg border-danger-border"
                } border`}
              >
                {result === "valid" ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-success-text flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-success-text">OIB je valjan</p>
                      <p className="text-sm text-success-text">
                        OIB {oib} je prošao ISO 7064, MOD 11-10 validaciju
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6 text-danger-text flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-danger-text">OIB nije valjan</p>
                      <p className="text-sm text-danger-text">
                        OIB {oib} nije prošao ISO 7064, MOD 11-10 validaciju
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Character count */}
            <p className="text-sm mt-2 text-white/60">{oib.length}/11 znamenki</p>
          </div>

          {/* Info Section */}
          <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-6">
            <div className="flex items-start gap-3 mb-3">
              <Info className="w-5 h-5 flex-shrink-0 text-white/60" />
              <h3 className="font-semibold text-white/90">O OIB-u</h3>
            </div>

            <div className="space-y-3 text-sm text-white/60">
              <p>
                <strong className="text-white/90">Osobni identifikacijski broj (OIB)</strong> je
                jedinstveni identifikacijski broj dodijeljen svakoj fizičkoj i pravnoj osobi u
                Hrvatskoj.
              </p>

              <div>
                <p className="font-medium mb-1 text-white/90">Format:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Točno 11 znamenki</li>
                  <li>Samo numerički znakovi (0-9)</li>
                  <li>Koristi ISO 7064, MOD 11-10 algoritam za provjeru kontrolne znamenke</li>
                </ul>
              </div>

              <div>
                <p className="font-medium mb-1 text-white/90">Upotreba:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Obavezan za sve poslovne transakcije</li>
                  <li>Koristi se na računima i e-računima</li>
                  <li>Nužan za prijavu poreza i komunikaciju s državnim tijelima</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Upsell Section */}
          <div className="mt-6 rounded-xl border border-info-border bg-gradient-to-r from-info-bg to-info-bg p-6 backdrop-blur-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-interactive/20">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-primary">
                  Automatska validacija na računu
                </h3>
                <p className="mt-1 text-sm text-info-text">
                  FiskAI automatski validira OIB kupca i prodavača kod svakog računa. Nema više
                  grešaka koje vraća Porezna.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-info-text">
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span> Automatska provjera pri unosu
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span> Upozorenje na neispravan OIB
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span> UBL 2.1 e-računi s validiranim podacima
                  </li>
                </ul>
                <Link
                  href="/register"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-interactive px-5 py-2.5 text-sm font-medium text-white hover:bg-interactive-hover transition-colors"
                >
                  Isprobaj FiskAI <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <FAQ items={faq} />
        </div>
      </div>
    </SectionBackground>
  )
}
