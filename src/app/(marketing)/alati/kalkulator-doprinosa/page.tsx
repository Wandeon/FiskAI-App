import { ContributionCalculator } from "@/components/knowledge-hub/calculators/ContributionCalculator"
import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight, Rocket } from "lucide-react"
import { FAQ } from "@/components/content/FAQ"
import { generateWebApplicationSchema } from "@/lib/schema/webApplication"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { CONTRIBUTIONS, formatCurrency, formatPercentage } from "@/lib/fiscal-data"

const contributionsYear = CONTRIBUTIONS.year
const contributionBaseLabel = formatCurrency(CONTRIBUTIONS.base.minimum, { decimals: 2 })
const mioRateLabel = formatPercentage(
  CONTRIBUTIONS.rates.MIO_I.rate + CONTRIBUTIONS.rates.MIO_II.rate
)
const hzzoRateLabel = formatPercentage(CONTRIBUTIONS.rates.HZZO.rate, { decimals: 1 })
const totalMonthlyLabel = formatCurrency(CONTRIBUTIONS.monthly.total, { decimals: 2 })

export const metadata: Metadata = {
  title: `Kalkulator doprinosa ${contributionsYear} | FiskAI`,
  description:
    `Izračunajte mjesečne doprinose za MIO I, MIO II i HZZO za paušalne obrtnike u ${contributionsYear}. godini.`,
}

const faq = [
  {
    q: "Koliki su doprinosi za paušalce?",
    a: `MIO ${mioRateLabel} i ZO ${hzzoRateLabel} na minimalnu osnovicu (${contributionBaseLabel} = ${totalMonthlyLabel} mjesečno).`,
  },
  {
    q: "Što je minimalna osnovica za doprinose?",
    a: `${contributionBaseLabel} mjesečno (minimalna osnovica za ${contributionsYear}.).`,
  },
  {
    q: "Do kada se plaćaju doprinosi?",
    a: "Do 15. u mjesecu za prethodni mjesec.",
  },
]

export default function ContributionCalculatorPage() {
  const webAppSchema = generateWebApplicationSchema({
    name: "Kalkulator Doprinosa",
    description:
      `Izračunajte mjesečne doprinose za MIO I, MIO II i HZZO za paušalne obrtnike u ${contributionsYear}. godini.`,
    url: "https://fisk.ai/alati/kalkulator-doprinosa",
  })

  return (
    <SectionBackground>
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
          <span className="text-white/60">/</span> <span className="text-white/90">Doprinosi</span>
        </nav>

        <h1 className="text-display text-4xl font-semibold">
          Kalkulator doprinosa {contributionsYear}.
        </h1>
        <p className="mt-4 text-white/60">
          Mjesečni doprinosi za paušalne obrtnike. Iznosi vrijede za {contributionsYear}. godinu i
          temelje se na minimalnoj osnovici od {contributionBaseLabel}.
        </p>

        <div className="mt-8">
          <ContributionCalculator embedded={false} />
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold">Povezani vodiči</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link
                href="/vodic/pausalni-obrt"
                className="font-semibold text-cyan-400 hover:underline"
              >
                Paušalni obrt - kompletan vodič
              </Link>
            </li>
            <li>
              <Link href="/alati/uplatnice" className="font-semibold text-cyan-400 hover:underline">
                Generator uplatnica za doprinose
              </Link>
            </li>
          </ul>
        </div>

        {/* FiskAI Upsell */}
        <div className="mt-8 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600">
              <Rocket className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white/90">Automatski izračun s FiskAI</h3>
              <p className="mt-1 text-sm text-white/60">
                Zaboravi na ručne kalkulacije. FiskAI automatski izračunava doprinose, generira
                uplatnice i podsjeća te na rokove.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:from-cyan-400 hover:to-blue-500"
                >
                  Započni besplatno
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/features"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 backdrop-blur-sm"
                >
                  Saznaj više
                </Link>
              </div>
            </div>
          </div>
        </div>

        <FAQ items={faq} />
      </div>
    </SectionBackground>
  )
}
