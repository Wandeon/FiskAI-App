import { Metadata } from "next"
import Link from "next/link"
import { PaymentSlipGenerator } from "@/components/knowledge-hub/calculators/PaymentSlipGenerator"
import { PAYMENT_IBANS, PAYMENT_MODEL } from "@/lib/knowledge-hub/constants"
import { Rocket, ArrowRight, Save } from "lucide-react"

export const metadata: Metadata = {
  title: "Generator Uplatnica | FiskAI",
  description: "Generirajte Hub3 uplatnice za plaćanje doprinosa, poreza i prireza.",
}

export default function PaymentSlipsPage() {
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
        <span className="text-[var(--foreground)]">Uplatnice</span>
      </nav>

      <header>
        <h1 className="text-display text-4xl font-semibold">Generator uplatnica (HUB3)</h1>
        <p className="mt-4 text-[var(--muted)]">
          Odaberite vrstu uplate, unesite OIB i generirajte barkod (PDF417) koji možete skenirati u
          mobilnom bankarstvu.
        </p>
      </header>

      <div className="mt-8">
        <PaymentSlipGenerator embedded={false} />
      </div>

      <section className="mt-12 prose prose-slate max-w-none">
        <h2>Kako koristiti?</h2>
        <ol>
          <li>Odaberite vrstu uplate (MIO, HZZO, porez...)</li>
          <li>Unesite svoj OIB</li>
          <li>Unesite iznos za uplatu</li>
          <li>Skenirajte generirani barkod mobilnim bankarstvom</li>
        </ol>

        <h2>IBAN-ovi za uplate</h2>
        <ul>
          <li>
            <strong>Državni proračun (MIO I / porezi):</strong> {PAYMENT_IBANS.STATE_BUDGET}
          </li>
          <li>
            <strong>MIO II. stup:</strong> {PAYMENT_IBANS.MIO_II}
          </li>
          <li>
            <strong>HZZO:</strong> {PAYMENT_IBANS.HZZO}
          </li>
          <li>
            <strong>HOK:</strong> {PAYMENT_IBANS.HOK}
          </li>
        </ul>
        <p>
          <strong>Model:</strong> {PAYMENT_MODEL}
        </p>
      </section>

      {/* Upsell Section */}
      <section className="mt-12 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600">
            <Save className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-900">Spremi predloške uplatnica</h3>
            <p className="mt-1 text-sm text-blue-700">
              FiskAI automatski izračunava doprinose i generira uplatnice na temelju vaših prihoda.
              Više nikad ne morate ručno kopirati IBAN-ove.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-blue-800">
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Automatski izračun MIO/HZZO doprinosa
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Podsjetnici prije isteka roka
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Povijest svih uplata na jednom mjestu
              </li>
            </ul>
            <Link
              href="/register"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Započni besplatno <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
