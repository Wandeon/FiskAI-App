import { ContributionCalculator } from "@/components/knowledge-hub/calculators/ContributionCalculator"
import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight, Rocket } from "lucide-react"
import { FAQ } from "@/components/content/FAQ"

export const metadata: Metadata = {
  title: "Kalkulator doprinosa 2025 | FiskAI",
  description:
    "Izračunajte mjesečne doprinose za MIO I, MIO II i HZZO za paušalne obrtnike u 2025. godini.",
}

const faq = [
  {
    q: "Koliki su doprinosi za paušalce?",
    a: "MIO 20% i ZO 16.5% na minimalnu osnovicu (560,40 EUR = 204,79 EUR mjesečno).",
  },
  {
    q: "Što je minimalna osnovica za doprinose?",
    a: "560,40 EUR mjesečno (35% prosječne plaće za 2025.).",
  },
  {
    q: "Do kada se plaćaju doprinosi?",
    a: "Do 15. u mjesecu za prethodni mjesec.",
  },
]

export default function ContributionCalculatorPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
          Baza znanja
        </Link>{" "}
        <span className="text-[var(--muted)]">/</span>{" "}
        <Link href="/alati" className="hover:text-[var(--foreground)]">
          Alati
        </Link>{" "}
        <span className="text-[var(--muted)]">/</span>{" "}
        <span className="text-[var(--foreground)]">Doprinosi</span>
      </nav>

      <h1 className="text-display text-4xl font-semibold">Kalkulator doprinosa 2025.</h1>
      <p className="mt-4 text-[var(--muted)]">
        Mjesečni doprinosi za paušalne obrtnike. Iznosi vrijede za 2025. godinu i temelje se na
        minimalnoj osnovici od 719,20 EUR.
      </p>

      <div className="mt-8">
        <ContributionCalculator embedded={false} />
      </div>

      <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold">Povezani vodiči</h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <Link
              href="/vodic/pausalni-obrt"
              className="font-semibold text-blue-700 hover:underline"
            >
              Paušalni obrt - kompletan vodič
            </Link>
          </li>
          <li>
            <Link href="/alati/uplatnice" className="font-semibold text-blue-700 hover:underline">
              Generator uplatnica za doprinose
            </Link>
          </li>
        </ul>
      </div>

      {/* FiskAI Upsell */}
      <div className="mt-8 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Rocket className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900">Automatski izračun s FiskAI</h3>
            <p className="mt-1 text-sm text-slate-600">
              Zaboravi na ručne kalkulacije. FiskAI automatski izračunava doprinose, generira
              uplatnice i podsjeća te na rokove.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Započni besplatno
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Saznaj više
              </Link>
            </div>
          </div>
        </div>
      </div>

      <FAQ items={faq} />
    </div>
  )
}
