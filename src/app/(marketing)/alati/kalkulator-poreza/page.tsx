import { TaxCalculator } from "@/components/knowledge-hub/calculators/TaxCalculator"
import Link from "next/link"
import type { Metadata } from "next"
import { Calculator, ArrowRight, FileText } from "lucide-react"
import { FAQ } from "@/components/content/FAQ"
import { generateWebApplicationSchema } from "@/lib/schema/webApplication"

export const metadata: Metadata = {
  title: "Kalkulator paušalnog poreza 2025 | FiskAI",
  description:
    "Izračunajte kvartalni i godišnji paušalni porez na temelju očekivanog prihoda. Svi porezni razredi za 2025.",
}

const faq = [
  {
    q: "Koliko iznosi porez na dohodak?",
    a: "20% do 50.400 EUR godišnje, 30% iznad tog iznosa (2025.).",
  },
  {
    q: "Što je osobni odbitak?",
    a: "Neoporezivi dio dohotka - 560 EUR mjesečno (osnovna olakšica).",
  },
  {
    q: "Kako se računa prirez?",
    a: "Postotak od poreza na dohodak, ovisi o mjestu prebivališta (npr. Zagreb 18%).",
  },
]

export default function TaxCalculatorPage() {
  const webAppSchema = generateWebApplicationSchema({
    name: "Kalkulator Poreza",
    description:
      "Izračunajte kvartalni i godišnji paušalni porez na temelju očekivanog prihoda. Svi porezni razredi za 2025.",
    url: "https://fisk.ai/alati/kalkulator-poreza",
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />
      <nav className="mb-6 text-sm text-white/60">
        <Link href="/baza-znanja" className="hover:text-white/90">
          Baza znanja
        </Link>{" "}
        <span className="text-white/60">/</span>{" "}
        <Link href="/alati" className="hover:text-white/90">
          Alati
        </Link>{" "}
        <span className="text-white/60">/</span>{" "}
        <span className="text-white/90">Paušalni porez</span>
      </nav>

      <h1 className="text-display text-4xl font-semibold">Kalkulator paušalnog poreza 2025.</h1>
      <p className="mt-4 text-white/60">
        Unesite očekivani godišnji prihod i izračunajte ukupne godišnje troškove uključujući porez,
        doprinose i HOK članarinu.
      </p>

      <div className="mt-8">
        <TaxCalculator embedded={false} />
      </div>

      <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Povezani sadržaj</h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <Link
              href="/vodic/pausalni-obrt"
              className="font-semibold text-cyan-500 hover:underline"
            >
              Paušalni obrt - kompletan vodič
            </Link>
          </li>
          <li>
            <Link
              href="/usporedba/pocinjem-solo"
              className="font-semibold text-cyan-500 hover:underline"
            >
              Usporedba: počinjem solo (paušal vs obrt vs j.d.o.o.)
            </Link>
          </li>
        </ul>
      </div>

      {/* Upsell Section */}
      <section className="mt-8 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-6 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-600">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">Neka FiskAI računa umjesto vas</h3>
            <p className="mt-1 text-sm text-white/70">
              Automatski izračun poreza na temelju stvarnih prihoda. Generirane uplatnice spremne za
              plaćanje.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-white/80">
              <li className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-400" /> Kvartalni izvještaji
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span> Automatski izračun po poreznim razredima
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span> Podsjetnici za uplate
              </li>
            </ul>
            <Link
              href="/register"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cyan-700"
            >
              Automatiziraj porez <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <FAQ items={faq} />
    </div>
  )
}
