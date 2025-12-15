import { TaxCalculator } from "@/components/knowledge-hub/calculators/TaxCalculator"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Kalkulator paušalnog poreza 2025 | FiskAI",
  description:
    "Izračunajte kvartalni i godišnji paušalni porez na temelju očekivanog prihoda. Svi porezni razredi za 2025.",
}

export default function TaxCalculatorPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <nav className="mb-8">
        <Link href="/alati" className="text-blue-600 hover:underline">
          ← Natrag na alate
        </Link>
      </nav>

      <h1 className="text-3xl font-bold mb-4">Kalkulator paušalnog poreza 2025.</h1>
      <p className="text-gray-600 mb-8">
        Unesite očekivani godišnji prihod i izračunajte ukupne godišnje troškove uključujući porez,
        doprinose i HOK članarinu.
      </p>

      <TaxCalculator embedded={false} />

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Povezani vodiči</h3>
        <ul className="space-y-2">
          <li>
            <Link href="/vodic/pausalni-obrt" className="text-blue-600 hover:underline">
              Paušalni obrt - kompletan vodič
            </Link>
          </li>
          <li>
            <Link href="/alati/usporedba-oblika" className="text-blue-600 hover:underline">
              Usporedba oblika poslovanja
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}
