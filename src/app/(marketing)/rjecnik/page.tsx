import { Metadata } from "next"
import Link from "next/link"
import { BookOpen, ArrowRight } from "lucide-react"
import { getAllGlossaryTerms } from "@/lib/knowledge-hub/mdx"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "Poslovni rječnik | FiskAI",
  description:
    "A-Z rječnik hrvatskih poslovnih i poreznih pojmova. PDV, OIB, JOPPD, fiskalizacija i više.",
  alternates: {
    canonical: `${BASE_URL}/rjecnik`,
  },
}

export default async function GlossaryPage() {
  const terms = await getAllGlossaryTerms()

  // Group by first letter
  const grouped = terms.reduce(
    (acc, term) => {
      const letter = term.frontmatter.term[0].toUpperCase()
      if (!acc[letter]) acc[letter] = []
      acc[letter].push(term)
      return acc
    },
    {} as Record<string, typeof terms>
  )

  const letters = Object.keys(grouped).sort((a, b) => a.localeCompare(b, "hr"))

  return (
    <SectionBackground variant="gradient">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <nav className="mb-6 text-sm text-white/60">
          <Link href="/baza-znanja" className="hover:text-white">
            Baza znanja
          </Link>{" "}
          <span>/</span> <span className="text-white">Rječnik</span>
        </nav>

        <header className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-400 backdrop-blur-sm border border-cyan-400/20">
            <BookOpen className="h-4 w-4" />
            {terms.length} pojmova
          </div>
          <h1 className="text-4xl font-bold text-white md:text-5xl">Poslovni rječnik</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            Svi pojmovi koje trebate znati za poslovanje u Hrvatskoj. Od PDV-a do fiskalizacije.
          </p>
        </header>

        {/* Letter navigation */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {letters.map((letter) => (
            <a
              key={letter}
              href={`#${letter}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 font-semibold text-white hover:bg-cyan-400/10 hover:text-cyan-400 hover:border-cyan-400/20"
            >
              {letter}
            </a>
          ))}
        </div>

        {/* Terms by letter */}
        <div className="space-y-10">
          {letters.map((letter) => (
            <section key={letter} id={letter}>
              <h2 className="mb-4 text-2xl font-bold text-white">{letter}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[letter].map((term) => (
                  <Link
                    key={term.slug}
                    href={`/rjecnik/${term.slug}`}
                    className="group flex items-center justify-between rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-4 transition-all hover:border-cyan-400/20 hover:bg-white/10"
                  >
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-cyan-400">
                        {term.frontmatter.term}
                      </h3>
                      <p className="mt-1 text-sm text-white/60 line-clamp-1">
                        {term.frontmatter.shortDefinition}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-cyan-400" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </SectionBackground>
  )
}
