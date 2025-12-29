import type { Metadata } from "next"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Politika AI podataka",
  description: "Politika korištenja i obrade podataka putem AI funkcionalnosti FiskAI-a.",
  alternates: {
    canonical: `${BASE_URL}/ai-data-policy`,
  },
}

export default function AiDataPolicyPage() {
  return (
    <SectionBackground variant="dark" showOrbs={false}>
      <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <h1 className="text-display text-4xl font-semibold">Politika AI podataka</h1>
        <p className="mt-4 text-sm text-white/60">
          Ova stranica objašnjava kako FiskAI koristi umjetnu inteligenciju i obraduje podatke putem
          AI funkcionalnosti.
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">
          Koje AI funkcionalnosti nudimo
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>OCR (Optical Character Recognition):</strong> Skeniranje i prepoznavanje teksta
            iz slika računa i troškova.
          </li>
          <li>
            <strong>AI prijedlozi kategorija:</strong> Prijedlozi za kategorizaciju troškova na
            temelju prethodnih unosa.
          </li>
          <li>
            <strong>AI preporuke:</strong> Analiza podataka radi identifikacije ušteda i
            optimizacija.
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">
          Kako se podaci šalju AI pružatelju usluga
        </h2>
        <p className="mt-3 text-sm text-white/60">
          Kada koristite AI funkcionalnosti (npr. OCR skeniranje računa), slike se šalju vanjskom AI
          pružatelju usluge (npr. OpenAI) isključivo radi obrade. Ove slike se ne pohranjuju trajno
          kod vanjskih pružatelja usluga i koriste se samo za izvršenje određene funkcionalnosti.
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">Kontrola i privatnost</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>Korisnička kontrola:</strong> Sve AI prijedloge treba ručno potvrditi; AI ne
            radi promjene bez korisničke ovlasti.
          </li>
          <li>
            <strong>AI može biti onemogućen:</strong> Korisnici mogu isključiti AI funkcionalnosti u
            postavkama.
          </li>
          <li>
            <strong>Minimalni podaci:</strong> Šalju se samo oni podaci koji su nužni za izvršenje
            funkcionalnosti.
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">Sigurnosne mjere</h2>
        <p className="mt-3 text-sm text-white/60">
          Svi prijenosi podataka prema AI pružateljima usluga obavljaju se putem sigurnih HTTPS
          veza. Prijenosi se mogu logirati radi praćenja korištenja i sigurnosti.
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">Vaša prava</h2>
        <p className="mt-3 text-sm text-white/60">
          Imate pravo znati koji podaci se šalju AI pružateljima i kako se koriste. Također imate
          pravo onemogućiti AI funkcionalnosti koje koriste vaše podatke.
        </p>
      </div>
    </SectionBackground>
  )
}
