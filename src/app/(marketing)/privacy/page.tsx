import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "FiskAI — Privatnost",
  description: "Politika privatnosti (draft) za FiskAI.",
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
      <h1 className="text-display text-4xl font-semibold">Politika privatnosti (draft)</h1>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Ovaj tekst je početni nacrt. Prije komercijalnog lansiranja treba ga uskladiti s pravnim savjetnikom i stvarnim načinom obrade podataka.
      </p>

      <h2 className="text-display mt-10 text-2xl font-semibold">Što prikupljamo</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
        <li>Podatke o korisničkom računu (npr. email, ime).</li>
        <li>Podatke o tvrtki (npr. naziv, OIB, adresa) koje unesete.</li>
        <li>Poslovne dokumente i metapodatke koje sami učitate/kreirate (računi, troškovi).</li>
      </ul>

      <h2 className="text-display mt-10 text-2xl font-semibold">AI/OCR obrada</h2>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Kada uključite AI/OCR funkcije, određeni sadržaj (npr. slika računa) može se poslati vanjskom pružatelju usluge radi obrade.
        FiskAI treba jasno označiti taj tok podataka i omogućiti isključivanje.
      </p>

      <h2 className="text-display mt-10 text-2xl font-semibold">Vaša prava</h2>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Cilj je omogućiti izvoz podataka i zahtjeve za brisanje u skladu s GDPR-om (uz iznimke gdje zakonske obveze zahtijevaju čuvanje).
      </p>
    </div>
  )
}

