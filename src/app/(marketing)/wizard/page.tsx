// src/app/(marketing)/wizard/page.tsx
import { WizardContainer } from "@/components/knowledge-hub/wizard/WizardContainer"
import type { Metadata } from "next"
import Link from "next/link"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { FadeIn } from "@/components/ui/motion/FadeIn"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "Pronađite svoj poslovni oblik | FiskAI",
  description:
    "Interaktivni čarobnjak koji vam pomaže odabrati pravi oblik poslovanja u Hrvatskoj.",
  alternates: {
    canonical: `${BASE_URL}/wizard`,
  },
}

export default function WizardPage() {
  return (
    <SectionBackground>
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <nav className="mb-6 text-sm text-white/60">
          <Link href="/baza-znanja" className="hover:text-white/90">
            Baza znanja
          </Link>{" "}
          <span className="text-white/60">/</span> <span className="text-white/90">Čarobnjak</span>
        </nav>

        <FadeIn>
          <header className="text-center">
            <h1 className="text-display text-4xl font-semibold md:text-5xl">
              Pronađite idealan oblik poslovanja
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
              Odgovorite na nekoliko pitanja i dobit ćete personaliziranu preporuku s detaljnim
              vodičem za vaš oblik poslovanja.
            </p>
          </header>
        </FadeIn>

        <div className="mt-10">
          <WizardContainer />
        </div>
      </div>
    </SectionBackground>
  )
}
