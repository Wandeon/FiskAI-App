import { Metadata } from "next"
import Link from "next/link"
import { PDVThresholdCalculator } from "@/components/knowledge-hub/calculators/PDVThresholdCalculator"

export const metadata: Metadata = {
  title: "PDV Kalkulator - Kada prelazim prag? | FiskAI",
  description:
    "Izračunajte koliko ste blizu PDV praga od 60.000€ i što se mijenja kada ga prijeđete.",
}

export default function PDVCalculatorPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">PDV Kalkulator</h1>
        <p className="text-lg text-gray-600">
          Provjerite koliko ste blizu PDV praga i što to znači za vaše poslovanje.
        </p>
      </header>

      <PDVThresholdCalculator />

      <section className="mt-12 prose prose-gray max-w-none">
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
    </div>
  )
}
