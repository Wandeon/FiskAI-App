import type { Metadata } from "next"
import Link from "next/link"
import {
  CheckCircle2,
  FileText,
  Calculator,
  Shield,
  Download,
  Users,
  Clock,
  TrendingUp,
} from "lucide-react"
import { WorkflowScroller } from "@/components/marketing/WorkflowScroller"
import { FaqAccordion } from "@/components/marketing/FaqAccordion"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { companyInfo } from "@/config/company"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Za paušalni obrt",
  description:
    "AI-first računovodstveni asistent posebno prilagođen za paušalni obrt u Hrvatskoj. Izdavanje računa, praćenje troškova i izvozi za knjigovođu.",
  alternates: {
    canonical: `${BASE_URL}/for/pausalni-obrt`,
  },
}

export default function PausalniObrtPage() {
  return (
    <SectionBackground variant="hero" showGrid={true} showOrbs={true}>
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        {/* Hero section */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-interactive/10 px-4 py-2 text-sm font-semibold text-primary mb-4">
            <Shield className="h-4 w-4" />
            Posebno prilagođeno za paušalni obrt
          </div>
          <h1 className="text-display text-4xl font-semibold md:text-5xl text-white">
            Računovodstvo za paušalni obrt koje <span className="text-primary">štedi sati</span>{" "}
            mjesečno
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            Izradite račune, pratite troškove i pripremite podatke za knjigovođu bez slanja mailova
            i &quot;donosim fascikl&quot;.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-interactive px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Započni besplatno
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-md border border-white/20 bg-surface/5 px-6 py-3 text-sm font-semibold text-white hover:bg-surface/10"
            >
              Zatraži demo
            </Link>
          </div>
        </div>

        {/* Why paušalni obrt section */}
        <div className="mb-16 rounded-2xl border border-info-border bg-interactive/10 p-8">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            Zašto paušalni obrt voli FiskAI?
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-surface/10 p-2">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <p className="font-medium text-white">Štedi vrijeme</p>
              </div>
              <p className="text-sm text-white/60">
                Umanjite vrijeme potrošeno na administraciju s 5-10h na 1-2h mjesečno.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-surface/10 p-2">
                  <Calculator className="h-5 w-5 text-primary" />
                </div>
                <p className="font-medium text-white">Manje grešaka</p>
              </div>
              <p className="text-sm text-white/60">
                Automatska numeracija računa, provjera OIB-a i točni izračuni PDV-a.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-surface/10 p-2">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <p className="font-medium text-white">Jednostavan izvoz</p>
              </div>
              <p className="text-sm text-white/60">
                Izvozite sve za knjigovođu u CSV/Excel formatu s datumskim filtrom.
              </p>
            </div>
          </div>
        </div>

        {/* Features grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-semibold mb-8 text-center text-white">
            Sve što vam treba za paušalni obrt
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <FileText className="h-6 w-6 text-primary flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Izdavanje računa</h3>
                  <p className="text-sm text-white/60 mt-1">Brzo i profesionalno</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Automatska numeracija računa (serija, godina)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Hrvatski predlošci s potrebnim elementima</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Slanje računa putem emaila (PDF)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Praćenje plaćenih/neplaćenih računa</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <TrendingUp className="h-6 w-6 text-primary flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Praćenje troškova</h3>
                  <p className="text-sm text-white/60 mt-1">Skeniranje i kategorizacija</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>AI OCR skeniranje računa (fotografija → podaci)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Automatska kategorizacija troškova</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Ručni unos troškova za papirnate račune</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Pregled po mjesecima/kvartalima</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <Download className="h-6 w-6 text-primary flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Izvoz za knjigovođu</h3>
                  <p className="text-sm text-white/60 mt-1">Bez &quot;donosim fascikl&quot;</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Kompletan izvoz u CSV/Excel formatu</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Filtriranje po datumu (mjesečno, kvartalno, godišnje)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>PDF računi kao prilozi</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Pregled povezanih računa i troškova</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <Users className="h-6 w-6 text-primary flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Suradnja s knjigovođom</h3>
                  <p className="text-sm text-white/60 mt-1">Dijeljenje bez komplikacija</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Pozivnica za knjigovođu (besplatni pristup)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Izrada &quot;accountant package&quot; za slanje</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Audit trag: tko je što promijenio</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>Komunikacija kroz platformu</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Monthly workflow */}
        <div className="mb-16 rounded-2xl border border-white/10 bg-surface/5 backdrop-blur-sm p-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold text-white">Vaš mjesečni radni tok s FiskAI</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-white/60">
              Umjesto “skupljam papire cijeli mjesec”, imate jasan proces i uredne podatke — bez
              ručnog prepisivanja.
            </p>
          </div>
          <WorkflowScroller />
        </div>

        {/* Pricing section */}
        <div className="mb-12">
          <h2 className="text-3xl font-semibold mb-8 text-center text-white">
            Cijena koja se isplati
          </h2>
          <div className="mx-auto max-w-md rounded-2xl border border-info-border bg-gradient-to-b from-info-bg to-info-bg p-8 text-center">
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-interactive/10 px-3 py-1 text-sm font-semibold text-primary">
                Paušalni plan
              </div>
            </div>
            <div className="mb-6">
              <div className="flex items-baseline justify-center">
                <span className="text-4xl font-bold text-white">39€</span>
                <span className="text-white/60 ml-2">/ mjesečno</span>
              </div>
              <p className="text-sm text-white/60 mt-2">
                Bez ugovorne obveze • Možete otkazati bilo kada
              </p>
            </div>
            <ul className="space-y-3 text-sm text-left mb-8 text-white">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                <span>Do 50 računa mjesečno</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                <span>Neograničeno troškova (OCR uključen)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                <span>Izvoz za knjigovođu (CSV/Excel/PDF)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                <span>Email podrška unutar 24h</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                <span>Besplatna 14-dnevna proba</span>
              </li>
            </ul>
            <Link
              href="/register"
              className="block w-full rounded-md bg-interactive px-6 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
            >
              Započni besplatnu probu
            </Link>
            <p className="text-xs text-white/60 mt-3">
              Nema kreditne kartice potrebne • Nakon 14 dana automatski prelazi u plaćeni plan
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="rounded-2xl border border-white/10 bg-surface/5 backdrop-blur-sm p-8">
          <h2 className="text-2xl font-semibold mb-6 text-white">
            Često postavljana pitanja za paušalni obrt
          </h2>
          <FaqAccordion
            items={[
              {
                question: "Može li moj knjigovođa koristiti FiskAI?",
                answer:
                  "Da. Možete pozvati knjigovođu kao besplatnog korisnika. Ima pregled podataka, izvoze i audit trag, a komunikacija ide kroz platformu.",
              },
              {
                question: "Što ako premašim 50 računa mjesečno?",
                answer:
                  "Dobit ćete obavijest i opcije nadogradnje. Paušalni plan može imati dodatak po računu iznad 50, uz jasnu kontrolu troškova prije potvrde.",
              },
              {
                question: "Kako izgleda izvoz za knjigovođu?",
                answer:
                  "Dobivate ZIP paket: CSV/Excel s računima i troškovima, PDF kopije računa i sažetak po razdobljima (mjesečno/kvartalno/godišnje).",
              },
              {
                question: "Je li potrebna dugoročna obveza?",
                answer:
                  "Ne. Planovi su mjesečni i možete otkazati bilo kada. Besplatna proba je bez kreditne kartice.",
              },
            ]}
          />
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-sm text-white">
              Imate još pitanja?{" "}
              <Link href="/contact" className="font-semibold text-primary hover:underline">
                Kontaktirajte nas
              </Link>{" "}
              putem emaila{" "}
              <a
                href={`mailto:${companyInfo.emailContact}`}
                className="font-semibold text-primary hover:underline"
              >
                {companyInfo.emailContact}
              </a>
            </p>
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-semibold mb-4 text-white">Spremni za probu?</h2>
          <p className="text-lg text-white/60 mb-6 max-w-2xl mx-auto">
            Pridružite se drugim paušalnim obrtnicima koji su već smanjili vrijeme potrošeno na
            računovodstvo za 80%.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md bg-interactive px-8 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Započni besplatnu 14-dnevnu probu
          </Link>
          <p className="text-xs text-white/60 mt-3">
            Nema kreditne kartice potrebne • Možete otkazati bilo kada
          </p>
        </div>
      </div>
    </SectionBackground>
  )
}
