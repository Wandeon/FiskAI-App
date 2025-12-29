import type { Metadata } from "next"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Sporazum o obradi podataka",
  description: "Sporazum o obradi podataka (DPA) za FiskAI.",
  alternates: {
    canonical: `${BASE_URL}/dpa`,
  },
}

export default function DpaPage() {
  return (
    <SectionBackground variant="dark" showOrbs={false}>
      <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <h1 className="text-display text-4xl font-semibold">Sporazum o obradi podataka (DPA)</h1>
        <p className="mt-4 text-sm text-white/60">
          Ova stranica sadrži početni nacrt Sporazuma o obradi podataka. Prije komercijalnog
          korištenja, ovaj dokument treba uskladiti s pravnim savjetnikom i regulatornim zahtjevima.
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">Opseg obrade</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            FiskAI obrađuje poslovne podatke koje korisnici unesu u sustav (računi, troškovi,
            kontakti).
          </li>
          <li>
            Podaci se koriste isključivo u svrhu izdavanja računa, vođenja evidencije troškova i
            izrada izvješća za knjigovođu.
          </li>
          <li>Podaci se ne koriste za druge svrhe bez izričite suglasnosti korisnika.</li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">Sigurnost podataka</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>Podaci se šifriraju prilikom prijenosa i pohrane.</li>
          <li>Pristup sustavu je kontroliran putem autentifikacije i autorizacije.</li>
          <li>Redovito se izvode sigurnosne provjere i ažuriranja sustava.</li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">AI obrada</h2>
        <p className="mt-3 text-sm text-white/60">
          Pri korištenju AI/OCR funkcionalnosti, neki podaci se mogu privremeno poslati vanjskom
          pružatelju usluge radi obrade. Ova obrada je vremenski ograničena i sadržaj se ne koristi
          ničim drugim osim za izvršenje OCR funkcionalnosti.
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">Prava korisnika</h2>
        <p className="mt-3 text-sm text-white/60">
          Korisnici imaju pravo na pristup svojim podacima, ispravak netočnih podataka te pravo na
          brisanje podataka u skladu s važećim propisima.
        </p>
      </div>
    </SectionBackground>
  )
}
