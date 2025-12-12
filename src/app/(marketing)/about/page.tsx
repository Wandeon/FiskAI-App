import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "FiskAI — O nama",
  description: "Vizija i smjer razvoja FiskAI platforme.",
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
      <h1 className="text-display text-4xl font-semibold">O nama</h1>
      <p className="mt-4 text-sm text-[var(--muted)]">
        FiskAI je AI-first platforma za računovodstvo i ERP u nastajanju, fokusirana na hrvatsko tržište i nadolazeće zahtjeve (npr. Fiskalizacija 2.0).
      </p>

      <h2 className="text-display mt-10 text-2xl font-semibold">Misija</h2>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Smanjiti administraciju i greške kroz automatizaciju, a da kontrola uvijek ostane kod klijenta: jasni izvještaji, audit trag i izvozi.
      </p>

      <h2 className="text-display mt-10 text-2xl font-semibold">Principi</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
        <li>AI predlaže, korisnik odlučuje (bez “skrivenih” promjena).</li>
        <li>Modularnost: kreni jednostavno, skaliraj prema ERP-u.</li>
        <li>Compliance-first: gradimo uz hrvatski regulatorni okvir.</li>
        <li>Izvoz i prenosivost podataka kao standard.</li>
      </ul>
    </div>
  )
}

