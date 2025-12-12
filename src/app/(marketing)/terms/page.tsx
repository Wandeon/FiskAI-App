import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "FiskAI — Uvjeti korištenja",
  description: "Uvjeti korištenja (draft) za FiskAI.",
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
      <h1 className="text-display text-4xl font-semibold">Uvjeti korištenja (draft)</h1>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Ovaj tekst je početni nacrt. Prije komercijalnog lansiranja treba ga uskladiti s pravnim savjetnikom, cjenikom i SLA-om.
      </p>

      <h2 className="text-display mt-10 text-2xl font-semibold">Beta program</h2>
      <p className="mt-3 text-sm text-[var(--muted)]">
        FiskAI je u beta fazi: funkcionalnosti se mogu mijenjati, a prioritet je stabilnost i ispravnost podataka.
      </p>

      <h2 className="text-display mt-10 text-2xl font-semibold">Odgovornosti</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
        <li>Korisnik je odgovoran za ispravnost unesenih podataka i verifikaciju prijedloga.</li>
        <li>FiskAI će pružati razumnu podršku i ispravke grešaka tijekom beta faze.</li>
        <li>Za regulatorne obveze (npr. porezne prijave) preporučuje se suradnja s knjigovođom.</li>
      </ul>
    </div>
  )
}

