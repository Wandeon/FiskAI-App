import { Metadata } from "next"
import Link from "next/link"
import { PaymentSlipGenerator } from "@/components/knowledge-hub/calculators/PaymentSlipGenerator"
import { PAYMENT_IBANS, PAYMENT_MODEL } from "@/lib/knowledge-hub/constants"
import { ArrowRight, Save } from "lucide-react"
import { FAQ } from "@/components/content/FAQ"
import { generateWebApplicationSchema } from "@/lib/schema/webApplication"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { POZIV_NA_BROJ_CODES } from "@/lib/fiscal-data"

export const metadata: Metadata = {
  title: "Generator Uplatnica | FiskAI",
  description: "Generirajte Hub3 uplatnice za plaćanje doprinosa, poreza i prireza.",
}

export default function PaymentSlipsPage() {
  const incomeCodeExample = Object.keys(POZIV_NA_BROJ_CODES.incomeTypes)[0]
  const incomeCodeLabel = incomeCodeExample
    ? POZIV_NA_BROJ_CODES.incomeTypes[incomeCodeExample]
    : undefined

  const faq = [
    {
      q: "Koji je poziv na broj za porez?",
      a: `Model ${PAYMENT_MODEL} s OIB-om obveznika i šifrom vrste prihoda${
        incomeCodeExample && incomeCodeLabel
          ? ` (npr. ${incomeCodeExample} za ${incomeCodeLabel.toLowerCase()})`
          : "."
      }`,
    },
    {
      q: "Na koji račun uplatiti doprinose?",
      a: `MIO I. stup: ${PAYMENT_IBANS.STATE_BUDGET}, ZO: ${PAYMENT_IBANS.HZZO}.`,
    },
    {
      q: "Kako generirati poziv na broj?",
      a: "OIB + šifra djelatnosti + oznaka razdoblja (format ovisi o vrsti uplate).",
    },
  ]
  const webAppSchema = generateWebApplicationSchema({
    name: "Generator Uplatnica",
    description: "Generirajte Hub3 uplatnice za plaćanje doprinosa, poreza i prireza.",
    url: "https://fisk.ai/alati/uplatnice",
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
          <span className="text-white/60">/</span> <span className="text-white/90">Uplatnice</span>
        </nav>

        <header>
          <h1 className="text-display text-4xl font-semibold">Generator uplatnica (HUB3)</h1>
          <p className="mt-4 text-white/60">
            Odaberite vrstu uplate, unesite OIB i generirajte barkod (PDF417) koji možete skenirati
            u mobilnom bankarstvu.
          </p>
        </header>

        <div className="mt-8">
          <PaymentSlipGenerator embedded={false} />
        </div>

        <section className="mt-12 prose prose-invert max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-cyan-400 prose-strong:text-white">
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
        <section className="mt-12 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 p-6 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 backdrop-blur-sm">
              <Save className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-cyan-300">Spremi predloške uplatnica</h3>
              <p className="mt-1 text-sm text-cyan-200/80">
                FiskAI automatski izračunava doprinose i generira uplatnice na temelju vaših
                prihoda. Više nikad ne morate ručno kopirati IBAN-ove.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-cyan-200/70">
                <li className="flex items-center gap-2">
                  <span className="text-cyan-400">✓</span> Automatski izračun MIO/HZZO doprinosa
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-cyan-400">✓</span> Podsjetnici prije isteka roka
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-cyan-400">✓</span> povijest svih uplata na jednom mjestu
                </li>
              </ul>
              <Link
                href="/register"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-cyan-600 transition-colors"
              >
                Započni besplatno <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <FAQ items={faq} />
      </div>
    </SectionBackground>
  )
}
