import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, FileText, Calculator, Shield, Download, Users, Clock, TrendingUp } from "lucide-react"

export const metadata: Metadata = {
  title: "FiskAI — Za paušalni obrt",
  description: "AI-first računovodstveni asistent posebno prilagođen za paušalni obrt u Hrvatskoj. Izdavanje računa, praćenje troškova i izvozi za knjigovođu.",
}

export default function PausalniObrtPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      {/* Hero section */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800 mb-4">
          <Shield className="h-4 w-4" />
          Posebno prilagođeno za paušalni obrt
        </div>
        <h1 className="text-display text-4xl font-semibold md:text-5xl">
          Računovodstvo za paušalni obrt koje <span className="text-blue-700">štedi sati</span> mjesečno
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Izradite račune, pratite troškove i pripremite podatke za knjigovođu bez slanja mailova i "donosim fascikl".
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Započni besplatno
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-semibold hover:bg-gray-50"
          >
            Zatraži demo
          </Link>
        </div>
      </div>

      {/* Why paušalni obrt section */}
      <div className="mb-16 rounded-2xl border border-blue-100 bg-blue-50 p-8">
        <h2 className="text-2xl font-semibold mb-4">Zašto paušalni obrt voli FiskAI?</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white p-2">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <p className="font-medium">Štedi vrijeme</p>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Umanjite vrijeme potrošeno na administraciju s 5-10h na 1-2h mjesečno.
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white p-2">
                <Calculator className="h-5 w-5 text-blue-600" />
              </div>
              <p className="font-medium">Manje grešaka</p>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Automatska numeracija računa, provjera OIB-a i točni izračuni PDV-a.
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white p-2">
                <Download className="h-5 w-5 text-blue-600" />
              </div>
              <p className="font-medium">Jednostavan izvoz</p>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Izvozite sve za knjigovođu u CSV/Excel formatu s datumskim filtrom.
            </p>
          </div>
        </div>
      </div>

      {/* Features grid */}
      <div className="mb-16">
        <h2 className="text-3xl font-semibold mb-8 text-center">Sve što vam treba za paušalni obrt</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <FileText className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Izdavanje računa</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Brzo i profesionalno</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Automatska numeracija računa (serija, godina)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Hrvatski predlošci s potrebnim elementima</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Slanje računa putem emaila (PDF)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Praćenje plaćenih/neprlaćenih računa</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <TrendingUp className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Praćenje troškova</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Skeniranje i kategorizacija</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>AI OCR skeniranje računa (fotografija → podaci)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Automatska kategorizacija troškova</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Ručni unos troškova za papirnate račune</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Pregled po mjesecima/kvartalima</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <Download className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Izvoz za knjigovođu</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Bez "donosim fascikl"</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Kompletan izvoz u CSV/Excel formatu</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Filtriranje po datumu (mjesečno, kvartalno, godišnje)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>PDF računi kao prilozi</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Pregled povezanih računa i troškova</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-start gap-3 mb-4">
              <Users className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold">Suradnja s knjigovođom</h3>
                <p className="text-sm text-[var(--muted)] mt-1">Dijeljenje bez komplikacija</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Pozivnica za knjigovođu (besplatni pristup)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Izrada "accountant package" za slanje</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Audit trag: tko je što promijenio</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Komunikacija kroz platformu</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Monthly workflow */}
      <div className="mb-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
        <h2 className="text-2xl font-semibold mb-6 text-center">Vaš mjesečni radni tok s FiskAI</h2>
        <div className="grid gap-6 md:grid-cols-4">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">1</div>
            <p className="font-medium">Izdajte račune</p>
            <p className="text-xs text-[var(--muted)] mt-1">Klijentima preko emaila</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">2</div>
            <p className="font-medium">Skenirajte troškove</p>
            <p className="text-xs text-[var(--muted)] mt-1">AI prepoznavanje podataka</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">3</div>
            <p className="font-medium">Označite plaćeno</p>
            <p className="text-xs text-[var(--muted)] mt-1">Kada stigne uplata</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">4</div>
            <p className="font-medium">Izvezite za knjigovođu</p>
            <p className="text-xs text-[var(--muted)] mt-1">Jedan klik za izvoz</p>
          </div>
        </div>
      </div>

      {/* Pricing section */}
      <div className="mb-12">
        <h2 className="text-3xl font-semibold mb-8 text-center">Cijena koja se isplati</h2>
        <div className="mx-auto max-w-md rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-8 text-center">
          <div className="mb-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
              Paušalni plan
            </div>
          </div>
          <div className="mb-6">
            <div className="flex items-baseline justify-center">
              <span className="text-4xl font-bold">39€</span>
              <span className="text-[var(--muted)] ml-2">/ mjesečno</span>
            </div>
            <p className="text-sm text-[var(--muted)] mt-2">Bez ugovorne obveze • Možete otkazati bilo kada</p>
          </div>
          <ul className="space-y-3 text-sm text-left mb-8">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Do 50 računa mjesečno</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Neograničeno troškova (OCR uključen)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Izvoz za knjigovođu (CSV/Excel/PDF)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Email podrška unutar 24h</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Besplatna 14-dnevna proba</span>
            </li>
          </ul>
          <Link
            href="/register"
            className="block w-full rounded-md bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
          >
            Započni besplatnu probu
          </Link>
          <p className="text-xs text-[var(--muted)] mt-3">
            Nema kreditne kartice potrebne • Nakon 14 dana automatski prelazi u plaćeni plan
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
        <h2 className="text-2xl font-semibold mb-6">Često postavljana pitanja za paušalni obrt</h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Može li moj knjigovođa koristiti FiskAI?</h3>
            <p className="text-sm text-[var(--muted)]">
              Da! Možete pozvati svog knjigovođu u FiskAI kao besplatnog korisnika. On će moći pregledavati vaše podatke,
              izraditi izvještaje i komunicirati s vama direktno kroz platformu.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Što ako premašim 50 računa mjesečno?</h3>
            <p className="text-sm text-[var(--muted)]">
              Automatski ćemo vas obavijestiti i ponuditi nadogradnju na plan s više računa. Paušalni plan ima dodatak
              od 1€ po računu iznad 50, do maksimalno 200 računa mjesečno.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Kako izgleda izvoz za knjigovođu?</h3>
            <p className="text-sm text-[var(--muted)]">
              Dobivate ZIP datoteku koja sadrži: CSV s računima (broj, datum, klijent, iznos, PDV), CSV s troškovima,
              PDF kopije svih računa, i preglednu tablicu po mjesecima/kvartalima.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Je li potrebna dugoročna obveza?</h3>
            <p className="text-sm text-[var(--muted)]">
              Ne. Možete koristiti FiskAI mjesec dana i otkazati bez penala. Također nudimo 14-dnevnu besplatnu probu
              da isprobate sve funkcije.
            </p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--border)]">
          <p className="text-sm">
            Imate još pitanja?{" "}
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

      {/* Final CTA */}
      <div className="mt-12 text-center">
        <h2 className="text-2xl font-semibold mb-4">Spremni za probu?</h2>
        <p className="text-lg text-[var(--muted)] mb-6 max-w-2xl mx-auto">
          Pridružite se drugim paušalnim obrtnicima koji su već smanjili vrijeme potrošeno na računovodstvo za 80%.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-8 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Započni besplatnu 14-dnevnu probu
        </Link>
        <p className="text-xs text-[var(--muted)] mt-3">
          Nema kreditne kartice potrebne • Možete otkazati bilo kada
        </p>
      </div>
    </div>
  )
}