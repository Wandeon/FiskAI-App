import type { Metadata } from "next"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Politika kolačića",
  description: "Politika kolačića za FiskAI.",
  alternates: {
    canonical: `${BASE_URL}/cookies`,
  },
}

export default function CookiePolicyPage() {
  return (
    <SectionBackground variant="dark" showOrbs={false}>
      <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <h1 className="text-display text-4xl font-semibold">Politika kolačića</h1>
        <p className="mt-4 text-sm text-white/60">
          Ova stranica objašnjava kako FiskAI koristi kolačiće i slične tehnologije za prikupljanje
          podataka.
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">Što su kolačići</h2>
        <p className="mt-3 text-sm text-white/60">
          Kolačići su male tekstualne datoteke koje se pohranjuju na vašem uređaju kada posjetite
          web stranicu. Oni pomažu u poboljšanju korisničkog iskustva i pružanju funkcionalnosti.
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">Kako koristimo kolačiće</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/60">
          <li>
            <strong>Obvezni kolačići:</strong> Omogućuju osnovne funkcije sustava, poput prijave i
            sigurnosti.
          </li>
          <li>
            <strong>Sesija kolačići:</strong> Pohranjuju informacije o vašoj trenutnoj sesiji dok
            ste prijavljeni.
          </li>
          <li>
            <strong>Analitički kolačići:</strong> Kako bismo poboljšali našu uslugu, možemo
            koristiti alate za analitiku (npr. PostHog) koji koriste kolačiće za prikupljanje
            anonimiziranih podataka o korištenju.
          </li>
        </ul>

        <h2 className="text-display mt-10 text-2xl font-semibold">Upravljanje kolačićima</h2>
        <p className="mt-3 text-sm text-white/60">
          Većina web preglednika automatski prihvaća kolačiće, ali možete promijeniti postavke
          preglednika da biste odbijali kolačiće ili da vas obavijeste kada se kolačić šalje.
        </p>
        <p className="mt-3 text-sm text-white/60">
          Imajte na umu da onemogućavanje kolačića može utjecati na funkcionalnost naše usluge.
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">AI kolačići i funkcije</h2>
        <p className="mt-3 text-sm text-white/60">
          Ako koristite AI funkcije kao što su OCR za prepoznavanje računa, ti zahtjevi se ne šalju
          putem kolačića već putem direktnog API poziva. Svi podaci se šalju na siguran način i ne
          čuvaju se trajno.
        </p>
      </div>
    </SectionBackground>
  )
}
