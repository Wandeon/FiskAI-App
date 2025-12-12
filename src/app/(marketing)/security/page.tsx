import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "FiskAI — Sigurnost",
  description: "Sažetak sigurnosnih i privatnosnih principa (Trust Center) za FiskAI.",
}

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
      <h1 className="text-display text-4xl font-semibold">Sigurnost (Trust Center)</h1>
      <p className="mt-4 text-sm text-[var(--muted)]">
        FiskAI obrađuje osjetljive poslovne podatke. Ova stranica je sažetak principa; detalji se dovršavaju tijekom beta programa.
      </p>

      <h2 className="text-display mt-10 text-2xl font-semibold">Principi</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
        <li>Kontrola ostaje kod klijenta: jasni izvozi i pregled promjena.</li>
        <li>Najmanje privilegije: role i pristupi po tvrtki (multi-tenant).</li>
        <li>Auditabilnost: trag tko je što promijenio (i zašto).</li>
        <li>AI je opcionalan i ne radi “tiho”: korisnik potvrđuje prijedloge.</li>
      </ul>

      <h2 className="text-display mt-10 text-2xl font-semibold">Privatnost i AI</h2>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Za OCR/AI obradu cilj je minimizirati podatke koji napuštaju sustav, jasno naznačiti što se šalje i omogućiti isključivanje AI funkcija.
      </p>
      <p className="mt-3 text-sm">
        <Link href="/privacy" className="font-semibold text-blue-700 hover:underline">
          Politika privatnosti
        </Link>
      </p>

      <h2 className="text-display mt-10 text-2xl font-semibold">Status i dostupnost</h2>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Operativne informacije (monitoring) se nadograđuju; trenutno postoji tehnički endpoint za provjeru zdravlja sustava.
      </p>
      <p className="mt-3 text-sm">
        <a className="font-semibold text-blue-700 hover:underline" href="/api/health">
          /api/health
        </a>
      </p>
    </div>
  )
}

