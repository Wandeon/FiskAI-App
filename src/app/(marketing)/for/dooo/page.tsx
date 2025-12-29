import type { Metadata } from "next"
import Link from "next/link"
import {
  CheckCircle2,
  Building2,
  FileText,
  Calculator,
  Shield,
  Users,
  BarChart,
  TrendingUp,
} from "lucide-react"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Za d.o.o. (društvo s ograničenom odgovornošću)",
  description:
    "Napredno računovodstveno rješenje za d.o.o. tvrtke u Hrvatskoj: PDV obračun, e-računi, fiskalizacija, knjigovodstvo i izvještaji.",
  alternates: {
    canonical: `${BASE_URL}/for/dooo`,
  },
}

export default function DooPage() {
  return (
    <SectionBackground variant="hero" showGrid={true} showOrbs={true}>
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        {/* Hero section */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400 mb-4">
            <Building2 className="h-4 w-4" />
            Posebno prilagođeno za d.o.o.
          </div>
          <h1 className="text-display text-4xl font-semibold md:text-5xl text-white">
            Potpuna računovodstvena platforma za vaš <span className="text-cyan-400">d.o.o.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            Od izdavanja računa i PDV obrade do kompletnog knjigovodstva i pripreme za reviziju —
            sve na jednom mjestu.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Započni besplatnu probu
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Zatraži poslovni demo
            </Link>
          </div>
        </div>

        {/* Key differentiators */}
        <div className="mb-16 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-8">
          <h2 className="text-2xl font-semibold mb-6 text-center text-white">
            Zašto d.o.o. tvrtke biraju FiskAI?
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white/10 p-2">
                  <Calculator className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">PDV obrada i JOPPD</p>
                  <p className="text-sm text-white/60">
                    Automatski obračun PDV-a i priprema JOPPD obrazaca za plaće.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white/10 p-2">
                  <FileText className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">E-računi i fiskalizacija</p>
                  <p className="text-sm text-white/60">
                    Potpuna podrška za e-račune (EN 16931) i fiskalizaciju 2.0.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white/10 p-2">
                  <BarChart className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Financijski izvještaji</p>
                  <p className="text-sm text-white/60">
                    Bilanca, račun dobiti i gubitka, tokovi gotovine.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white/10 p-2">
                  <Users className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Timski pristup</p>
                  <p className="text-sm text-white/60">
                    Više korisnika, uloge, odobrenja i audit tragovi.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature comparison */}
        <div className="mb-16">
          <h2 className="text-3xl font-semibold mb-8 text-center text-white">
            Sve što vaš d.o.o. treba
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <FileText className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Računi & E-računi</h3>
                  <p className="text-sm text-white/60 mt-1">Profesionalno izdavanje</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Automatska numeracija po serijama</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>E-računi (XML) prema EN 16931</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Fiskalizacija 2.0 integracija</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Primanje e-računa od dobavljača</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <Calculator className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">PDV obrada</h3>
                  <p className="text-sm text-white/60 mt-1">Puna zakonska usklađenost</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>PDV obračun po stopama (25%, 13%, 5%, 0%)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>PDV prijava (obrazac PDV-O) izvoz</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Obračun PDV-a za EU transakcije</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Knjiženje PDV-a po kontima</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <BarChart className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Knjigovodstvo</h3>
                  <p className="text-sm text-white/60 mt-1">Dvostruko knjigovodstvo</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Glavna knjiga (automatsko knjiženje)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Potporačuna (analitička evidencija)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Bilanca i izvještaji po MSFI</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Arhiviranje 11+ godina</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <TrendingUp className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Troškovi & Skeniranje</h3>
                  <p className="text-sm text-white/60 mt-1">AI OCR automatski unos</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>AI OCR za skeniranje računa</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Automatska kategorizacija troškova</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Povezivanje s bankovnim transakcijama</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Pregled po troškovnim centrima</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <Users className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Tim & Kontrole</h3>
                  <p className="text-sm text-white/60 mt-1">Višekorisnički pristup</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Uloge: vlasnik, računovođa, zaposlenik</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Odobrenje računa (workflow)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Kompletan audit trag</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>VPN/SSO integracije (opcionalno)</span>
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
              <div className="flex items-start gap-3 mb-4">
                <Shield className="h-6 w-6 text-cyan-400 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-semibold text-white">Sigurnost & Izvoz</h3>
                  <p className="text-sm text-white/60 mt-1">GDPR i kontrola</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Multi-tenant izolacija podataka</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Izvoz svih podataka za reviziju</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Arhiviranje po zakonskim zahtjevima</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>SLA 99.5% dostupnosti</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Pricing for d.o.o. */}
        <div className="mb-12">
          <h2 className="text-3xl font-semibold mb-8 text-center text-white">
            Cijene prilagođene d.o.o. potrebama
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
              <div className="mb-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-400">
                  D.O.O. Standard
                </div>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-white">99€</span>
                  <span className="text-white/60 ml-2">/ mjesečno</span>
                </div>
                <p className="text-sm text-white/60 mt-2">Za d.o.o. do 200 računa mjesečno</p>
              </div>
              <ul className="space-y-3 text-sm mb-8 text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Do 200 računa mjesečno</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>PDV obrada i JOPPD</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>E-računi (send/receive)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Do 3 korisnika</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Glavna knjiga i izvještaji</span>
                </li>
              </ul>
              <Link
                href="/register"
                className="block w-full rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
              >
                Započni besplatnu probu
              </Link>
            </div>

            <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/10 to-white/5 p-8 shadow-lg">
              <div className="mb-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-1 text-sm font-semibold text-white">
                  D.O.O. Enterprise
                </div>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-white">199€</span>
                  <span className="text-white/60 ml-2">/ mjesečno</span>
                </div>
                <p className="text-sm text-white/60 mt-2">Za veće d.o.o. i grupe tvrtki</p>
              </div>
              <ul className="space-y-3 text-sm mb-8 text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Neograničeno računa</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Više tvrtki u grupi</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Do 10 korisnika</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Napredno knjigovodstvo</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Dedicated account manager</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>SLA 99.9% dostupnosti</span>
                </li>
              </ul>
              <Link
                href="/contact"
                className="block w-full rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
              >
                Kontaktirajte prodaju
              </Link>
            </div>
          </div>
        </div>

        {/* Implementation process */}
        <div className="mb-16 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
          <h2 className="text-2xl font-semibold mb-6 text-center text-white">
            Implementacija za d.o.o. tvrtke
          </h2>
          <div className="grid gap-6 md:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-bold text-lg">
                1
              </div>
              <p className="font-medium text-white">Onboarding</p>
              <p className="text-xs text-white/60 mt-1">
                Podaci tvrtke, PDV registracija, korisnici
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-bold text-lg">
                2
              </div>
              <p className="font-medium text-white">Migracija</p>
              <p className="text-xs text-white/60 mt-1">Import postojećih podataka (CSV/Excel)</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-bold text-lg">
                3
              </div>
              <p className="font-medium text-white">Obuka</p>
              <p className="text-xs text-white/60 mt-1">Timsko osposobljavanje (2h)</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 font-bold text-lg">
                4
              </div>
              <p className="font-medium text-white">Pokretanje</p>
              <p className="text-xs text-white/60 mt-1">Go-live i kontinuirana podrška</p>
            </div>
          </div>
        </div>

        {/* Integration partners */}
        <div className="mb-12 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
          <h2 className="text-2xl font-semibold mb-6 text-white">Integracije i partneri</h2>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <p className="font-medium mb-2 text-white">Banke</p>
              <p className="text-white/60">CSH/HPB export, PSD2 API u pripremi</p>
            </div>
            <div>
              <p className="font-medium mb-2 text-white">E-računi</p>
              <p className="text-white/60">IE-Računi, Fina, drugi informacijski posrednici</p>
            </div>
            <div>
              <p className="font-medium mb-2 text-white">Plaćanja</p>
              <p className="text-white/60">Stripe, PayPal, PBS za online plaćanja</p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4 text-white">
            Spremni za moderno računovodstvo?
          </h2>
          <p className="text-lg text-white/60 mb-6 max-w-2xl mx-auto">
            Pridružite se d.o.o. tvrtkama koje su digitalizirale svoje računovodstvo i smanjile
            troškove za 30-50%.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Započni besplatnu 30-dnevnu probu
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 px-8 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Dogovori poslovni demo
            </Link>
          </div>
          <p className="text-xs text-white/60 mt-3">
            Za veće implementacije nudimo besplatnu migraciju podataka i timsku obuku.
          </p>
        </div>
      </div>
    </SectionBackground>
  )
}
