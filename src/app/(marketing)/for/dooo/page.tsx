import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, Building2, FileText, Calculator, Shield, Users, BarChart, TrendingUp } from "lucide-react"

export const metadata: Metadata = {
  title: "FiskAI — Za d.o.o. (društvo s ograničenom odgovornošću)",
  description: "Napredno računovodstveno rješenje za d.o.o. tvrtke u Hrvatskoj: PDV obračun, e-računi, fiskalizacija, knjigovodstvo i izvještaji.",
}

export default function DooPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      {/* Hero section */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800 mb-4">
          <Building2 className="h-4 w-4" />
          Posebno prilagođeno za d.o.o.
        </div>
        <h1 className="text-display text-4xl font-semibold md:text-5xl">
          Potpuna računovodstvena platforma za vaš <span className="text-blue-700">d.o.o.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Od izdavanja računa i PDV obrade do kompletnog knjigovodstva i pripreme za reviziju — sve na jednom mjestu.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Započni besplatnu probu
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-semibold hover:bg-gray-50"
          >
            Zatraži poslovni demo
          </Link>
        </div>
      </div>

      {/* Key differentiators */}
      <div className="mb-16 rounded-2xl border border-blue-100 bg-blue-50 p-8">
        <h2 className="text-2xl font-semibold mb-6 text-center">Zašto d.o.o. tvrtke biraju FiskAI?</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white p-2">
                <Calculator className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">PDV obrada i JOPPD</p>
                <p className="text-sm text-[var(--muted)]">Automatski obračun PDV-a i priprema JOPPD obrazaca za plaće.</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white p-2">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">E-računi i fiskalizacija</p>
                <p className="text-sm text-[var(--muted)]">Potpuna podrška za e-račune (EN 16931) i fiskalizaciju 2.0.</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white p-2">
                <BarChart className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Financijski izvještaji</p>
                <p className="text-sm text-[var(--muted)]">Bilanca, račun dobiti i gubitka, tokovi gotovine.</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white p-2">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Timski pristup</p>
                <p className="text-sm text-[var(--muted)]">Više korisnika, uloge, odobrenja i audit tragovi.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature comparison */}
      <div className="mb-16">
        <h2 className="text-3xl font-semibold mb-8 text-center">Sve što vaš d.o.o. treba</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <FileText className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Računi & E-računi</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Profesionalno izdavanje</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Automatska numeracija po serijama</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>E-računi (XML) prema EN 16931</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Fiskalizacija 2.0 integracija</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Primanje e-računa od dobavljača</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <Calculator className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">PDV obrada</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Puna zakonska usklađenost</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>PDV obračun po stopama (25%, 13%, 5%, 0%)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>PDV prijava (obrazac PDV-O) izvoz</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Obračun PDV-a za EU transakcije</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Knjiženje PDV-a po kontima</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <BarChart className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Knjigovodstvo</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Dvostruko knjigovodstvo</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Glavna knjiga (automatsko knjiženje)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Potporačuna (analitička evidencija)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Bilanca i izvještaji po MSFI</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Arhiviranje 11+ godina</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <TrendingUp className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Troškovi & Skeniranje</h3>
                <p className="text-sm text-[var(--muted)] mt-1">AI OCR automatski unos</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>AI OCR za skeniranje računa</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Automatska kategorizacija troškova</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Povezivanje s bankovnim transakcijama</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Pregled po troškovnim centrima</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <Users className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Tim & Kontrole</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Višekorisnički pristup</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Uloge: vlasnik, računovođa, zaposlenik</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Odobrenje računa (workflow)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Kompletan audit trag</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>VPN/SSO integracije (opcionalno)</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <Shield className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Sigurnost & Izvoz</h3>
                <p className="text-sm text-[var(--muted)] mt-1">GDPR i kontrola</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Multi-tenant izolacija podataka</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Izvoz svih podataka za reviziju</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Arhiviranje po zakonskim zahtjevima</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>SLA 99.5% dostupnosti</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Pricing for d.o.o. */}
      <div className="mb-12">
        <h2 className="text-3xl font-semibold mb-8 text-center">Cijene prilagođene d.o.o. potrebama</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-white p-8">
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                D.O.O. Standard
              </div>
            </div>
            <div className="mb-6">
              <div className="flex items-baseline">
                <span className="text-4xl font-bold">99€</span>
                <span className="text-[var(--muted)] ml-2">/ mjesečno</span>
              </div>
              <p className="text-sm text-[var(--muted)] mt-2">Za d.o.o. do 200 računa mjesečno</p>
            </div>
            <ul className="space-y-3 text-sm mb-8">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Do 200 računa mjesečno</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>PDV obrada i JOPPD</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>E-računi (send/receive)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Do 3 korisnika</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Glavna knjiga i izvještaji</span>
              </li>
            </ul>
            <Link
              href="/register"
              className="block w-full rounded-md bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
            >
              Započni besplatnu probu
            </Link>
          </div>

          <div className="rounded-2xl border border-blue-300 bg-gradient-to-b from-blue-50 to-white p-8 shadow-lg">
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-sm font-semibold text-white">
                D.O.O. Enterprise
              </div>
            </div>
            <div className="mb-6">
              <div className="flex items-baseline">
                <span className="text-4xl font-bold">199€</span>
                <span className="text-[var(--muted)] ml-2">/ mjesečno</span>
              </div>
              <p className="text-sm text-[var(--muted)] mt-2">Za veće d.o.o. i grupe tvrtki</p>
            </div>
            <ul className="space-y-3 text-sm mb-8">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Neograničeno računa</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Više tvrtki u grupi</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Do 10 korisnika</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Napredno knjigovodstvo</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Dedicated account manager</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>SLA 99.9% dostupnosti</span>
              </li>
            </ul>
            <Link
              href="/contact"
              className="block w-full rounded-md bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
            >
              Kontaktirajte prodaju
            </Link>
          </div>
        </div>
      </div>

      {/* Implementation process */}
      <div className="mb-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
        <h2 className="text-2xl font-semibold mb-6 text-center">Implementacija za d.o.o. tvrtke</h2>
        <div className="grid gap-6 md:grid-cols-4">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">1</div>
            <p className="font-medium">Onboarding</p>
            <p className="text-xs text-[var(--muted)] mt-1">Podaci tvrtke, PDV registracija, korisnici</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">2</div>
            <p className="font-medium">Migracija</p>
            <p className="text-xs text-[var(--muted)] mt-1">Import postojećih podataka (CSV/Excel)</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">3</div>
            <p className="font-medium">Obuka</p>
            <p className="text-xs text-[var(--muted)] mt-1">Timsko osposobljavanje (2h)</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">4</div>
            <p className="font-medium">Pokretanje</p>
            <p className="text-xs text-[var(--muted)] mt-1">Go-live i kontinuirana podrška</p>
          </div>
        </div>
      </div>

      {/* Integration partners */}
      <div className="mb-12 rounded-2xl border border-[var(--border)] bg-white p-8">
        <h2 className="text-2xl font-semibold mb-6">Integracije i partneri</h2>
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div>
            <p className="font-medium mb-2">Banke</p>
            <p className="text-[var(--muted)]">CSH/HPB export, PSD2 API u pripremi</p>
          </div>
          <div>
            <p className="font-medium mb-2">E-računi</p>
            <p className="text-[var(--muted)]">IE-Računi, Fina, drugi informacijski posrednici</p>
          </div>
          <div>
            <p className="font-medium mb-2">Plaćanja</p>
            <p className="text-[var(--muted)]">Stripe, PayPal, PBS za online plaćanja</p>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Spremni za moderno računovodstvo?</h2>
        <p className="text-lg text-[var(--muted)] mb-6 max-w-2xl mx-auto">
          Pridružite se d.o.o. tvrtkama koje su digitalizirale svoje računovodstvo i smanjile troškove za 30-50%.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Započni besplatnu 30-dnevnu probu
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-8 py-3 text-sm font-semibold hover:bg-gray-50"
          >
            Dogovori poslovni demo
          </Link>
        </div>
        <p className="text-xs text-[var(--muted)] mt-3">
          Za veće implementacije nudimo besplatnu migraciju podataka i timsku obuku.
        </p>
      </div>
    </div>
  )
}