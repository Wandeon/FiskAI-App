import { Metadata } from "next"
import Link from "next/link"
import { PDVThresholdCalculator } from "@/components/knowledge-hub/calculators/PDVThresholdCalculator"
import { TrendingUp, ArrowRight, Bell } from "lucide-react"
import { FAQ } from "@/components/content/FAQ"

export const metadata: Metadata = {
  title: "PDV Kalkulator - Kada prelazim prag? | FiskAI",
  description:
    "Izračunajte koliko ste blizu PDV praga od 60.000€ i što se mijenja kada ga prijeđete.",
}

const faq = [
  {
    q: "Kako izračunati PDV iz bruto iznosa?",
    a: "Podijelite bruto iznos s 1.25 (za 25% PDV) da dobijete neto, zatim oduzmite neto od bruto za iznos PDV-a.",
  },
  {
    q: "Kada se koristi 13% PDV?",
    a: "Stopa od 13% primjenjuje se na ugostiteljske usluge, novine, vodu i neke prehrambene proizvode.",
  },
  {
    q: "Što ako pogriješim u obračunu PDV-a?",
    a: "Ispravak se radi putem R-1 ili R-2 računa, ovisno o vrsti pogreške i razdoblju.",
  },
]

export default function PDVCalculatorPage() {
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
        <span className="text-[var(--foreground)]">PDV prag</span>
      </nav>

      <header>
        <h1 className="text-display text-4xl font-semibold">PDV kalkulator (60.000€)</h1>
        <p className="mt-4 text-[var(--muted)]">
          Provjerite koliko ste blizu praga i kad postajete PDV obveznik. Kalkulator koristi
          trenutni prihod (YTD), mjesečni prosjek i preostale mjesece do kraja godine.
        </p>
      </header>

      <div className="mt-8">
        <PDVThresholdCalculator />
      </div>

      <section className="mt-12 prose prose-slate max-w-none">
        <h2>Što je PDV prag?</h2>
        <p>
          Od 2025. godine, PDV prag u Hrvatskoj iznosi <strong>60.000 EUR</strong> godišnje. Kada
          vaš prihod prijeđe ovaj iznos, automatski postajete PDV obveznik od prvog dana sljedećeg
          mjeseca.
        </p>

        <h2>Što se mijenja kada postanete PDV obveznik?</h2>
        <ul>
          <li>Morate obračunavati 25% PDV na sve račune</li>
          <li>Možete odbijati ulazni PDV (troškovi)</li>
          <li>Obvezne mjesečne ili kvartalne PDV prijave</li>
          <li>Novi IBAN-ovi za uplate poreza</li>
        </ul>

        <h2>Povezane stranice</h2>
        <ul>
          <li>
            <Link href="/usporedba/preko-praga">Što kada prijeđem prag?</Link>
          </li>
          <li>
            <Link href="/vodic/pausalni-obrt#pdv">PDV za paušalne obrtnike</Link>
          </li>
        </ul>
      </section>

      {/* Upsell Section */}
      <section className="mt-12 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-amber-900">Automatsko praćenje PDV praga</h3>
            <p className="mt-1 text-sm text-amber-700">
              FiskAI prati vaš prihod u realnom vremenu i upozorava vas kada se približite PDV
              pragu. Bez iznenađenja.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-amber-800">
              <li className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" /> Upozorenje na 80% praga
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Projekcija do kraja godine
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Automatski izvještaj za knjigovođu
              </li>
            </ul>
            <Link
              href="/register"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
            >
              Prati prag automatski <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <FAQ items={faq} />
    </div>
  )
}
