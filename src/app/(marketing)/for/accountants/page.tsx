import type { Metadata } from "next"
import Link from "next/link"
import {
  CheckCircle2,
  Users,
  FileText,
  Download,
  Shield,
  BarChart,
  Clock,
  TrendingUp,
} from "lucide-react"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Za knjigovođe i računovode",
  description:
    "Suradnja s klijentima na jednom mjestu: uredni izvozi, audit tragovi i automatizirani prenos podataka.",
  alternates: {
    canonical: `${BASE_URL}/for/accountants`,
  },
}

export default function AccountantsPage() {
  return (
    <SectionBackground variant="hero" showGrid={true} showOrbs={true}>
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        {/* Hero section */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400 mb-4">
            <Users className="h-4 w-4" />
            Posebno prilagođeno za knjigovođe
          </div>
          <h1 className="text-display text-4xl font-semibold md:text-5xl text-white">
            Suradnja s klijentima bez{" "}
            <span className="text-cyan-400">&quot;donosim fascikl&quot;</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            Vaši klijenti šalju uredne izvozne pakete, vi dobivate točne podatke i smanjujete
            vrijeme obrade za 70%.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Registrirajte se za besplatni pristup
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Dogovori demo za ured
            </Link>
          </div>
        </div>

        {/* Value proposition */}
        <div className="mb-16 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-8">
          <h2 className="text-2xl font-semibold mb-6 text-center text-white">
            Zašto knjigovođe biraju FiskAI?
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white/10 p-2">
                  <Clock className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">70% manje vremena obrade</p>
                  <p className="text-sm text-white/60">Uredni izvozi umjesto fotografija računa</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white/10 p-2">
                  <Shield className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Točni i verificirani podaci</p>
                  <p className="text-sm text-white/60">
                    AI OCR provjera, automatska numeracija računa
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white/10 p-2">
                  <TrendingUp className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Klijenti ostaju vjerni</p>
                  <p className="text-sm text-white/60">
                    Olakšavate im administraciju, oni ostaju kod vas
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-semibold mb-8 text-center text-white">
            Sve što vam treba za suradnju s klijentima
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <Download className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Uredni izvozi</h3>
                  <p className="text-sm text-white/60 mt-1">
                    Standardizirani formati za brzu obradu
                  </p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>CSV/Excel izvozi s prilozima</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>PDF kopije svih računa</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Filtriranje po mjesecu/kvartalu</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Automatizirano slanje na email</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <Users className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Pristup klijentima</h3>
                  <p className="text-sm text-white/60 mt-1">Direktan pregled i komunikacija</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Besplatni pristup za knjigovođe</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Pregled svih klijenata na jednom mjestu</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Komunikacija kroz platformu</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Obavijesti o promjenama</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <BarChart className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Izvještaji i analize</h3>
                  <p className="text-sm text-white/60 mt-1">Sve informacije za reviziju</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Kumulativni pregled po klijentima</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Provjera kompletnosti podataka</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Audit trag svih promjena</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Alarmi za nedostajuće podatke</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <Shield className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Sigurnost i kontrola</h3>
                  <p className="text-sm text-white/60 mt-1">GDPR i profesionalni standardi</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Multi-tenant izolacija podataka</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Usklađeno s računovodstvenim standardima</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Arhiviranje 11+ godina</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Pristupi po &quot;least privilege&quot; principu</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <FileText className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">E-računi i fiskalizacija</h3>
                  <p className="text-sm text-white/60 mt-1">Priprema za buduće zahtjeve</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Podrška za e-račune (EN 16931)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Fiskalizacija 2.0 integracija</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>XML export za poreznu upravu</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Provjera usklađenosti računa</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <TrendingUp className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Efikasnost ureda</h3>
                  <p className="text-sm text-white/60 mt-1">Skaliranje bez zapošljavanja</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Obrada više klijenata istovremeno</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Automatizirani workflow-ovi</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Integracije s vašim sustavima</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>API za vlastite aplikacije</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Pricing for accountants */}
        <div className="mb-12">
          <h2 className="text-3xl font-semibold mb-8 text-center text-white">
            Besplatno za knjigovođe
          </h2>
          <div className="mx-auto max-w-md rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/10 to-white/5 p-8 text-center">
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-1 text-sm font-semibold text-white">
                Knjigovođa plan
              </div>
            </div>
            <div className="mb-6">
              <div className="flex items-baseline justify-center">
                <span className="text-4xl font-bold text-white">0€</span>
                <span className="text-white/60 ml-2">/ zauvijek</span>
              </div>
              <p className="text-sm text-white/60 mt-2">
                Besplatni pristup za sve certificirane knjigovođe
              </p>
            </div>
            <ul className="space-y-3 text-sm text-left mb-8 text-white">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span>Neograničen broj klijenata</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span>Pristup svim izvozima i izvještajima</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span>Komunikacija s klijentima</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span>Kumulativni pregledi</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span>Dedicated account manager za uredove</span>
              </li>
            </ul>
            <Link
              href="/register"
              className="block w-full rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
            >
              Registrirajte se kao knjigovođa
            </Link>
            <p className="text-xs text-white/60 mt-3">
              Potrebna verifikacija OIB-a i certifikata • Za registrirane računovodstvene uredove
            </p>
          </div>
        </div>

        {/* Client onboarding process */}
        <div className="mb-16 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
          <h2 className="text-2xl font-semibold mb-6 text-center text-white">
            Kako početi surađivati s klijentima
          </h2>
          <div className="grid gap-6 md:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-bold text-lg">
                1
              </div>
              <p className="font-medium text-white">Registracija</p>
              <p className="text-xs text-white/60 mt-1">Besplatni račun za knjigovođe</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-bold text-lg">
                2
              </div>
              <p className="font-medium text-white">Poziv klijenata</p>
              <p className="text-xs text-white/60 mt-1">Šaljete pozivnicu iz aplikacije</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-bold text-lg">
                3
              </div>
              <p className="font-medium text-white">Klijent koristi FiskAI</p>
              <p className="text-xs text-white/60 mt-1">Izdaje račune, skenira troškove</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-bold text-lg">
                4
              </div>
              <p className="font-medium text-white">Vi dobivate izvoz</p>
              <p className="text-xs text-white/60 mt-1">Automatski ili na zahtjev</p>
            </div>
          </div>
        </div>

        {/* Case study */}
        <div className="mb-12 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
          <h2 className="text-2xl font-semibold mb-6 text-white">
            Iskustvo računovodstvenog ureda
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold">
                    AK
                  </div>
                  <div>
                    <p className="font-semibold text-white">Ana K.</p>
                    <p className="text-sm text-white/60">
                      Vlasnica računovodstvenog ureda, 15 klijenata
                    </p>
                  </div>
                </div>
              </div>
              <blockquote className="text-lg text-white/60 italic mb-4">
                &quot;Prije smo primali fotografije računa na WhatsApp. Sada klijenti šalju uredne
                CSV izvozne pakete. Vrijeme obrade smanjeno za 70%, greške gotovo eliminirane.&quot;
              </blockquote>
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-medium mb-2 text-white">Prije FiskAI</p>
                <ul className="space-y-1 text-sm text-white/60">
                  <li className="flex items-start gap-2">
                    <div className="mt-1 h-2 w-2 rounded-full bg-red-500" />
                    <span>Fotografije računa na WhatsApp/email</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1 h-2 w-2 rounded-full bg-red-500" />
                    <span>Ručno prepisivanje u Excel (3-5h po klijentu mjesečno)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1 h-2 w-2 rounded-full bg-red-500" />
                    <span>Greške u prepisivanju (5-10% računa)</span>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2 text-white">Sada s FiskAI</p>
                <ul className="space-y-1 text-sm text-white/60">
                  <li className="flex items-start gap-2">
                    <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                    <span>Uredni CSV/Excel izvozi s PDF prilozima</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                    <span>Automatski unos podataka (30min po klijentu)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1 h-2 w-2 rounded-full bg-green-500" />
                    <span>Greške {"<"} 1% (AI provjera)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            Spremni za modernu suradnju s klijentima?
          </h2>
          <p className="text-lg text-white/60 mb-6 max-w-2xl mx-auto">
            Pridružite se računovodstvenim uredima koji su digitalizirali suradnju s klijentima i
            povećali kapacitet bez zapošljavanja.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Besplatna registracija za knjigovođe
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 px-8 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Demo za računovodstvene uredove
            </Link>
          </div>
          <p className="text-xs text-white/60 mt-3">
            Za veće uredove nudimo besplatnu obuku i podršku pri implementaciji.
          </p>
        </div>
      </div>
    </SectionBackground>
  )
}
