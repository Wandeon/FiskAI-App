import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, Shield, Users, FileText, Zap, Globe } from "lucide-react"

export const metadata: Metadata = {
  title: "FiskAI — Cijene i paketi",
  description: "Transparentne cijene za paušalni obrt, VAT obrt/d.o.o. i knjigovođe. Besplatna proba, bez ugovorne obveze.",
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      {/* Hero section */}
      <div className="mb-12 text-center">
        <h1 className="text-display text-4xl font-semibold md:text-5xl">
          Transparentne cijene za svaku vrstu poslovanja
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Od paušalnog obrta do d.o.o. tvrtki — cijene koje rastu s vama. Bez skrivenih troškova, bez ugovorne obveze.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800">
          <Shield className="h-4 w-4" />
          14-dnevna besplatna proba za sve pakete
        </div>
      </div>

      {/* Pricing tiers */}
      <div className="mb-16 grid gap-8 md:grid-cols-3">
        {/* Paušalni plan */}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-8">
          <div className="mb-6">
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                Paušalni obrt
              </div>
            </div>
            <div className="mb-4 flex items-baseline">
              <span className="text-4xl font-bold">39€</span>
              <span className="text-[var(--muted)] ml-2">/ mjesečno</span>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Savršeno za paušalni obrt do 50 računa mjesečno
            </p>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Do 50 računa mjesečno</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Neograničeno troškova (OCR uključen)</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Izvoz za knjigovođu (CSV/Excel/PDF)</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>1 korisnik (vlasnik)</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Email podrška unutar 24h</span>
            </li>
          </ul>
          <Link
            href="/register"
            className="block w-full rounded-md bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
          >
            Započni besplatnu probu
          </Link>
          <p className="mt-3 text-center text-xs text-[var(--muted)]">
            Nema kreditne kartice • Možete otkazati bilo kada
          </p>
        </div>

        {/* D.O.O. Standard plan */}
        <div className="relative rounded-2xl border-2 border-blue-300 bg-gradient-to-b from-blue-50 to-white p-8 shadow-lg">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1 text-sm font-semibold text-white">
              Najpopularnije
            </div>
          </div>
          <div className="mb-6">
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-sm font-semibold text-white">
                D.O.O. Standard
              </div>
            </div>
            <div className="mb-4 flex items-baseline">
              <span className="text-4xl font-bold">99€</span>
              <span className="text-[var(--muted)] ml-2">/ mjesečno</span>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Za d.o.o. i VAT obrt do 200 računa mjesečno
            </p>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Do 200 računa mjesečno</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>PDV obrada i JOPPD priprema</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>E-računi (send/receive)</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Do 3 korisnika</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Glavna knjiga i financijski izvještaji</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Telefonska podrška unutar 4h</span>
            </li>
          </ul>
          <Link
            href="/register"
            className="block w-full rounded-md bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
          >
            Započni besplatnu 30-dnevnu probu
          </Link>
          <p className="mt-3 text-center text-xs text-[var(--muted)]">
            Besplatna migracija podataka za d.o.o.
          </p>
        </div>

        {/* Enterprise plan */}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-8">
          <div className="mb-6">
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-800">
                Enterprise
              </div>
            </div>
            <div className="mb-4 flex items-baseline">
              <span className="text-4xl font-bold">199€</span>
              <span className="text-[var(--muted)] ml-2">/ mjesečno</span>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Za veće d.o.o. i grupe tvrtki
            </p>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Neograničeno računa</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Više tvrtki u grupi</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Do 10 korisnika</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Napredno knjigovodstvo</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Dedicated account manager</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>SLA 99.9% dostupnosti</span>
            </li>
          </ul>
          <Link
            href="/contact"
            className="block w-full rounded-md bg-purple-600 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-purple-700"
          >
            Kontaktirajte prodaju
          </Link>
          <p className="mt-3 text-center text-xs text-[var(--muted)]">
            Timska obuka i prilagođena implementacija
          </p>
        </div>
      </div>

      {/* Knjigovođa plan */}
      <div className="mb-16 rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-8 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              <Users className="h-4 w-4" />
              Besplatno za knjigovođe
            </div>
            <h2 className="text-2xl font-semibold mb-2">Pridružite se knjigovođama koji koriste FiskAI</h2>
            <p className="text-sm text-[var(--muted)]">
              Registrirani knjigovođe dobivaju besplatni pristup za suradnju s klijentima.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 mx-auto">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <p className="font-medium">Uredni izvozi</p>
              <p className="text-xs text-[var(--muted)]">CSV/Excel s PDF prilozima</p>
            </div>
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 mx-auto">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <p className="font-medium">Pristup klijentima</p>
              <p className="text-xs text-[var(--muted)]">Direktna komunikacija</p>
            </div>
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 mx-auto">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <p className="font-medium">70% manje rada</p>
              <p className="text-xs text-[var(--muted)]">Manje ručnog unosa</p>
            </div>
          </div>
          <div className="mt-8">
            <Link
              href="/for/accountants"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Registrirajte se kao knjigovođa
            </Link>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Potrebna verifikacija OIB-a i certifikata
            </p>
          </div>
        </div>
      </div>

      {/* Add-ons */}
      <div className="mb-16 rounded-2xl border border-[var(--border)] bg-white p-8">
        <h2 className="text-2xl font-semibold mb-6 text-center">Dodaci (opcionalno)</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] p-6">
            <div className="mb-4">
              <div className="text-2xl font-bold">1€</div>
              <p className="text-sm text-[var(--muted)]">po dodatnom računu</p>
            </div>
            <p className="text-sm font-medium">Dodatni računi</p>
            <p className="text-xs text-[var(--muted)]">Za paušalni plan iznad 50 računa</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-6">
            <div className="mb-4">
              <div className="text-2xl font-bold">15€</div>
              <p className="text-sm text-[var(--muted)]">po korisniku mjesečno</p>
            </div>
            <p className="text-sm font-medium">Dodatni korisnici</p>
            <p className="text-xs text-[var(--muted)]">Za sve planove</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-6">
            <div className="mb-4">
              <div className="text-2xl font-bold">30€</div>
              <p className="text-sm text-[var(--muted)]">mjesečno</p>
            </div>
            <p className="text-sm font-medium">Napredni AI OCR</p>
            <p className="text-xs text-[var(--muted)]">Veća točnost za kompleksne račune</p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-12 rounded-2xl border border-[var(--border)] bg-white p-8">
        <h2 className="text-2xl font-semibold mb-6">Često postavljana pitanja</h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Kako funkcionira besplatna proba?</h3>
            <p className="text-sm text-[var(--muted)]">
              Besplatna proba traje 14 dana za paušalni plan i 30 dana za d.o.o. plan. Ne trebate kreditnu karticu.
              Nakon probnog razdoblja, automatski prelazite na odabrani plan koji možete otkazati bilo kada.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Što ako premašim limit računa?</h3>
            <p className="text-sm text-[var(--muted)]">
              Automatski ćemo vas obavijestiti i ponuditi nadogradnju. Paušalni plan ima dodatak od 1€ po računu iznad 50,
              do maksimalno 200 računa mjesečno. D.O.O. plan ima dodatak od 0,50€ po računu iznad 200.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Kako funkcionira otkazivanje?</h3>
            <p className="text-sm text-[var(--muted)]">
              Možete otkazati bilo kada bez penala. Vaš pristup ostaje aktivan do kraja plaćenog razdoblja.
              Nakon toga možete izvesti sve svoje podatke u CSV/JSON formatu.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Postoji li dugoročna obveza?</h3>
            <p className="text-sm text-[var(--muted)]">
              Ne. Svi planovi su mjesečni bez ugovorne obveze. Nudimo 10% popusta za godišnje plaćanje ako želite.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Koje su opcije plaćanja?</h3>
            <p className="text-sm text-[var(--muted)]">
              Prihvaćamo kartice (Visa, Mastercard, Maestro), PayPal i bankovni transfer za hrvatske tvrtke.
              Za d.o.o. tvrtke izdajemo račune s PDV-om.
            </p>
          </div>
        </div>
      </div>

      {/* Trust signals */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white mx-auto">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <p className="font-semibold">Bez rizika</p>
            <p className="text-xs text-[var(--muted)]">14-30 dana besplatne probe</p>
          </div>
          <div className="text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white mx-auto">
              <Globe className="h-6 w-6 text-blue-600" />
            </div>
            <p className="font-semibold">Podaci u EU</p>
            <p className="text-xs text-[var(--muted)]">GDPR usklađeno, podaci u Njemačkoj</p>
          </div>
          <div className="text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white mx-auto">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <p className="font-semibold">Podrška na hrvatskom</p>
            <p className="text-xs text-[var(--muted)]">Telefon i email unutar 24h</p>
          </div>
        </div>
        <div className="mt-8 text-center">
          <p className="text-sm">
            Imate pitanja o cijenama?{" "}
            <Link href="/contact" className="font-semibold text-blue-700 hover:underline">
              Kontaktirajte nas
            </Link>{" "}
            ili pozovite na{" "}
            <a href="tel:+38512345678" className="font-semibold text-blue-700 hover:underline">
              +385 1 234 5678
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

