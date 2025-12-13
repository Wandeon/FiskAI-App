import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, Users, FileText, Download, Shield, BarChart, Clock, TrendingUp } from "lucide-react"

export const metadata: Metadata = {
  title: "FiskAI — Za knjigovođe i računovode",
  description: "Suradnja s klijentima na jednom mjestu: uredni izvozi, audit tragovi i automatizirani prenos podataka.",
}

export default function AccountantsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      {/* Hero section */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800 mb-4">
          <Users className="h-4 w-4" />
          Posebno prilagođeno za knjigovođe
        </div>
        <h1 className="text-display text-4xl font-semibold md:text-5xl">
          Suradnja s klijentima bez <span className="text-blue-700">"donosim fascikl"</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Vaši klijenti šalju uredne izvozne pakete, vi dobivate točne podatke i smanjujete vrijeme obrade za 70%.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Registrirajte se za besplatni pristup
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-semibold hover:bg-gray-50"
          >
            Dogovori demo za ured
          </Link>
        </div>
      </div>

      {/* Value proposition */}
      <div className="mb-16 rounded-2xl border border-blue-100 bg-blue-50 p-8">
        <h2 className="text-2xl font-semibold mb-6 text-center">Zašto knjigovođe biraju FiskAI?</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white p-2">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">70% manje vremena obrade</p>
                <p className="text-sm text-[var(--muted)]">Uredni izvozi umjesto fotografija računa</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white p-2">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Točni i verificirani podaci</p>
                <p className="text-sm text-[var(--muted)]">AI OCR provjera, automatska numeracija računa</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white p-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Klijenti ostaju vjerni</p>
                <p className="text-sm text-[var(--muted)]">Olakšavate im administraciju, oni ostaju kod vas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features grid */}
      <div className="mb-16">
        <h2 className="text-3xl font-semibold mb-8 text-center">Sve što vam treba za suradnju s klijentima</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <Download className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Uredni izvozi</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Standardizirani formati za brzu obradu</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>CSV/Excel izvozi s prilozima</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>PDF kopije svih računa</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Filtriranje po mjesecu/kvartalu</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Automatizirano slanje na email</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <Users className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Pristup klijentima</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Direktan pregled i komunikacija</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Besplatni pristup za knjigovođe</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Pregled svih klijenata na jednom mjestu</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Komunikacija kroz platformu</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Obavijesti o promjenama</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <BarChart className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Izvještaji i analize</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Sve informacije za reviziju</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Kumulativni pregled po klijentima</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Provjera kompletnosti podataka</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Audit trag svih promjena</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Alarmi za nedostajuće podatke</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <Shield className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Sigurnost i kontrola</h3>
                <p className="text-sm text-[var(--muted)] mt-1">GDPR i profesionalni standardi</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Multi-tenant izolacija podataka</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Usklađeno s računovodstvenim standardima</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Arhiviranje 11+ godina</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Pristupi po "least privilege" principu</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <FileText className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">E-računi i fiskalizacija</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Priprema za buduće zahtjeve</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Podrška za e-račune (EN 16931)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Fiskalizacija 2.0 integracija</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>XML export za poreznu upravu</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Provjera usklađenosti računa</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <TrendingUp className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Efikasnost ureda</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Skaliranje bez zapošljavanja</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Obrada više klijenata istovremeno</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Automatizirani workflow-ovi</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Integracije s vašim sustavima</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>API za vlastite aplikacije</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Pricing for accountants */}
      <div className="mb-12">
        <h2 className="text-3xl font-semibold mb-8 text-center">Besplatno za knjigovođe</h2>
        <div className="mx-auto max-w-md rounded-2xl border border-blue-300 bg-gradient-to-b from-blue-50 to-white p-8 text-center">
          <div className="mb-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-sm font-semibold text-white">
              Knjigovođa plan
            </div>
          </div>
          <div className="mb-6">
            <div className="flex items-baseline justify-center">
              <span className="text-4xl font-bold">0€</span>
              <span className="text-[var(--muted)] ml-2">/ zauvijek</span>
            </div>
            <p className="text-sm text-[var(--muted)] mt-2">Besplatni pristup za sve certificirane knjigovođe</p>
          </div>
          <ul className="space-y-3 text-sm text-left mb-8">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Neograničen broj klijenata</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Pristup svim izvozima i izvještajima</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Komunikacija s klijentima</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Kumulativni pregledi</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Dedicated account manager za uredove</span>
            </li>
          </ul>
          <Link
            href="/register"
            className="block w-full rounded-md bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
          >
            Registrirajte se kao knjigovođa
          </Link>
          <p className="text-xs text-[var(--muted)] mt-3">
            Potrebna verifikacija OIB-a i certifikata • Za registrirane računovodstvene uredove
          </p>
        </div>
      </div>

      {/* Client onboarding process */}
      <div className="mb-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
        <h2 className="text-2xl font-semibold mb-6 text-center">Kako početi surađivati s klijentima</h2>
        <div className="grid gap-6 md:grid-cols-4">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">1</div>
            <p className="font-medium">Registracija</p>
            <p className="text-xs text-[var(--muted)] mt-1">Besplatni račun za knjigovođe</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">2</div>
            <p className="font-medium">Poziv klijenata</p>
            <p className="text-xs text-[var(--muted)] mt-1">Šaljete pozivnicu iz aplikacije</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">3</div>
            <p className="font-medium">Klijent koristi FiskAI</p>
            <p className="text-xs text-[var(--muted)] mt-1">Izdaje račune, skenira troškove</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">4</div>
            <p className="font-medium">Vi dobivate izvoz</p>
            <p className="text-xs text-[var(--muted)] mt-1">Automatski ili na zahtjev</p>
          </div>
        </div>
      </div>

      {/* Case study */}
      <div className="mb-12 rounded-2xl border border-[var(--border)] bg-white p-8">
        <h2 className="text-2xl font-semibold mb-6">Iskustvo računovodstvenog ureda</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                  AK
                </div>
                <div>
                  <p className="font-semibold">Ana K.</p>
                  <p className="text-sm text-[var(--muted)]">Vlasnica računovodstvenog ureda, 15 klijenata</p>
                </div>
              </div>
            </div>
            <blockquote className="text-lg text-[var(--muted)] italic mb-4">
              "Prije smo primali fotografije računa na WhatsApp. Sada klijenti šalju uredne CSV izvozne pakete. Vrijeme obrade smanjeno za 70%, greške gotovo eliminirane."
            </blockquote>
          </div>
          <div className="space-y-4">
            <div>
              <p className="font-medium mb-2">Prije FiskAI</p>
              <ul className="space-y-1 text-sm text-[var(--muted)]">
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
              <p className="font-medium mb-2">Sada s FiskAI</p>
              <ul className="space-y-1 text-sm text-[var(--muted)]">
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
                  <span>Greške {'<'} 1% (AI provjera)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Spremni za modernu suradnju s klijentima?</h2>
        <p className="text-lg text-[var(--muted)] mb-6 max-w-2xl mx-auto">
          Pridružite se računovodstvenim uredima koji su digitalizirali suradnju s klijentima i povećali kapacitet bez zapošljavanja.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Besplatna registracija za knjigovođe
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-8 py-3 text-sm font-semibold hover:bg-gray-50"
          >
            Demo za računovodstvene uredove
          </Link>
        </div>
        <p className="text-xs text-[var(--muted)] mt-3">
          Za veće uredove nudimo besplatnu obuku i podršku pri implementaciji.
        </p>
      </div>
    </div>
  )
}