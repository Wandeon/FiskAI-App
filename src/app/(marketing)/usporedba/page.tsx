import { Metadata } from "next"
import Link from "next/link"
import { getAllComparisons } from "@/lib/knowledge-hub/mdx"
import { ComparisonsExplorer } from "./ComparisonsExplorer"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { FadeIn } from "@/components/ui/motion/FadeIn"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "Usporedbe oblika poslovanja | FiskAI",
  description:
    "Usporedite različite oblike poslovanja u Hrvatskoj: paušalni obrt, obrt dohodaš, d.o.o., freelance i više.",
  alternates: {
    canonical: `${BASE_URL}/usporedba`,
  },
}

export default async function ComparisonsIndexPage() {
  const allComparisons = await getAllComparisons()
  const comparisons = allComparisons.map((c) => ({
    slug: c.slug,
    title: c.frontmatter.title,
    description: c.frontmatter.description,
  }))

  return (
    <SectionBackground>
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <nav className="mb-6 text-sm text-white/60">
          <Link href="/baza-znanja" className="hover:text-white/90">
            Baza znanja
          </Link>{" "}
          <span className="text-white/60">/</span> <span className="text-white/90">Usporedbe</span>
        </nav>

        <FadeIn>
          <header className="text-center">
            <h1 className="text-display text-4xl font-semibold md:text-5xl">
              Usporedbe oblika poslovanja
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
              Pronađite idealan oblik poslovanja za vašu situaciju. Detaljne usporedbe poreza,
              doprinosa i administrativnih obveza.
            </p>
          </header>
        </FadeIn>

        <ComparisonsExplorer comparisons={comparisons} />
      </div>
    </SectionBackground>
  )
}
