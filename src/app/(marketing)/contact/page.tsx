import type { Metadata } from "next"
import Link from "next/link"
import { Mail, Phone, MapPin, Clock, MessageSquare } from "lucide-react"

export const metadata: Metadata = {
  title: "FiskAI — Kontakt",
  description: "Kontaktirajte FiskAI tim za demo, beta program ili podršku.",
}

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 md:px-6">
      <div className="mb-10">
        <h1 className="text-display text-4xl font-semibold">Kontakt i podrška</h1>
        <p className="mt-4 text-lg text-[var(--muted)] max-w-2xl">
          Javite nam se za demo, beta pristup ili tehničku podršku. Fokusirani smo na paušalni obrt, VAT i suradnju s knjigovođama.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-8">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-xl font-semibold mb-4">Kontakt podaci</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <MapPin className="h-5 w-5 text-[var(--muted)]" />
                </div>
                <div>
                  <p className="font-medium">Adresa</p>
                  <p className="text-sm text-[var(--muted)]">Radnička cesta 80, 10000 Zagreb</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Mail className="h-5 w-5 text-[var(--muted)]" />
                </div>
                <div>
                  <p className="font-medium">Email</p>
                  <a href="mailto:kontakt@fiskai.hr" className="text-sm text-blue-700 hover:underline block">
                    kontakt@fiskai.hr
                  </a>
                  <p className="text-xs text-[var(--muted)] mt-1">Općeniti upiti, demo zahtjevi</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Phone className="h-5 w-5 text-[var(--muted)]" />
                </div>
                <div>
                  <p className="font-medium">Telefon</p>
                  <a href="tel:+38512345678" className="text-sm text-blue-700 hover:underline block">
                    +385 1 234 5678
                  </a>
                  <p className="text-xs text-[var(--muted)] mt-1">Radnim danima 9-17h</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <MessageSquare className="h-5 w-5 text-[var(--muted)]" />
                </div>
                <div>
                  <p className="font-medium">Podrška</p>
                  <a href="mailto:podrska@fiskai.hr" className="text-sm text-blue-700 hover:underline block">
                    podrska@fiskai.hr
                  </a>
                  <p className="text-xs text-[var(--muted)] mt-1">Tehnički problemi, pomoć u aplikaciji</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <Clock className="h-5 w-5 text-[var(--muted)]" />
                </div>
                <div>
                  <p className="font-medium">Vrijeme odgovora</p>
                  <p className="text-sm text-[var(--muted)]">Unutar 24h radnim danima</p>
                  <p className="text-xs text-[var(--muted)] mt-1">Hitni slučajevi: +385 1 234 5679</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-xl font-semibold mb-4">Tvrtka</h2>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Naziv:</span> Metrica d.o.o.</p>
              <p><span className="font-medium">OIB:</span> 12345678901</p>
              <p><span className="font-medium">IBAN:</span> HR1234567890123456789 (ZABA)</p>
              <p><span className="font-medium">VAT ID:</span> HR12345678901</p>
              <p className="text-[var(--muted)] mt-2">Registrirana u Sudskom registru Republike Hrvatske</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-xl font-semibold mb-4">Zahtjev za demo</h2>
            <p className="text-sm text-[var(--muted)] mb-4">
              Zatražite personalizirani demo koji pokazuje kako FiskAI može ubrzati vaše računovodstvo.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ime i prezime *</label>
                <input type="text" className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Vaše ime i prezime" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input type="email" className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="vaš@email.hr" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tip poslovanja *</label>
                <select className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm">
                  <option value="">Odaberite...</option>
                  <option value="pausalni-obrt">Paušalni obrt</option>
                  <option value="vat-obrt">VAT obrt</option>
                  <option value="doo">d.o.o.</option>
                  <option value="accountant">Knjigovođa/računovoda</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Broj računa mjesečno *</label>
                <select className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm">
                  <option value="">Odaberite...</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="200+">200+</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Poruka (opcionalno)</label>
                <textarea className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm min-h-[100px]" placeholder="Specifična pitanja ili zahtjevi..." />
              </div>
              <button className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                Pošalji zahtjev za demo
              </button>
              <p className="text-xs text-[var(--muted)]">
                Kontaktirat ćemo vas unutar 24h radnim danima da dogovorimo vrijeme demo sastanka.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-xl font-semibold mb-2">Već imate račun?</h2>
            <p className="text-sm text-[var(--muted)] mb-4">
              Prijavite se u aplikaciju ili koristite in-app podršku za tehnička pitanja.
            </p>
            <div className="flex gap-3">
              <Link href="/login" className="flex-1 rounded-md border border-[var(--border)] bg-white px-4 py-2 text-center text-sm font-medium hover:bg-gray-50">
                Prijava
              </Link>
              <Link href="/register" className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700">
                Besplatna registracija
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="text-lg font-semibold mb-2">📞 Hitna podrška</h3>
        <p className="text-sm text-[var(--muted)] mb-3">
          Ako imate kritičan problem koji sprečava korištenje aplikacije (npr. ne možete izdati račun):
        </p>
        <div className="flex items-center gap-4">
          <a href="tel:+38512345679" className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-white/95 border border-red-200">
            <Phone className="h-4 w-4" />
            +385 1 234 5679
          </a>
          <span className="text-xs text-[var(--muted)]">Radnim danima 9-17h, subota 10-14h</span>
        </div>
      </div>
    </div>
  )
}

