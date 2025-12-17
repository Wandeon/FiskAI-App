import type { Metadata } from "next"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { FadeIn } from "@/components/ui/motion/FadeIn"

export const metadata: Metadata = {
  title: "FiskAI — O nama",
  description: "Vizija i smjer razvoja FiskAI platforme.",
}

export default function AboutPage() {
  return (
    <SectionBackground>
      <div className="mx-auto max-w-3xl px-4 py-14 md:px-6">
        <FadeIn>
          <h1 className="text-display text-4xl font-semibold">O nama</h1>
          <p className="mt-4 text-sm text-white/60">
            FiskAI je AI-first platforma za računovodstvo i ERP u nastajanju, fokusirana na hrvatsko
            tržište i nadolazeće zahtjeve (npr. Fiskalizacija 2.0).
          </p>
        </FadeIn>

        <h2 className="text-display mt-10 text-2xl font-semibold">Misija</h2>
        <p className="mt-3 text-sm text-white/60">
          Smanjiti administraciju i greške kroz automatizaciju, a da kontrola uvijek ostane kod
          klijenta: jasni izvještaji, audit trag i izvozi.
        </p>

        <h2 className="text-display mt-10 text-2xl font-semibold">Principi</h2>
        <ul className="mt-3 space-y-2">
          <li className="rounded-lg bg-white/5 px-4 py-3 text-sm text-white/60">
            AI predlaže, korisnik odlučuje (bez &quot;skrivenih&quot; promjena).
          </li>
          <li className="rounded-lg bg-white/5 px-4 py-3 text-sm text-white/60">
            Modularnost: kreni jednostavno, skaliraj prema ERP-u.
          </li>
          <li className="rounded-lg bg-white/5 px-4 py-3 text-sm text-white/60">
            Compliance-first: gradimo uz hrvatski regulatorni okvir.
          </li>
          <li className="rounded-lg bg-white/5 px-4 py-3 text-sm text-white/60">
            Izvoz i prenosivost podataka kao standard.
          </li>
        </ul>
      </div>
    </SectionBackground>
  )
}
