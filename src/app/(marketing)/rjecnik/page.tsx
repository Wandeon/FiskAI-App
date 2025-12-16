import { Metadata } from "next"
import Link from "next/link"
import { BookOpen, ArrowRight } from "lucide-react"
import { getAllGlossaryTerms } from "@/lib/knowledge-hub/mdx"

export const metadata: Metadata = {
  title: "Poslovni rječnik | FiskAI",
  description:
    "A-Z rječnik hrvatskih poslovnih i poreznih pojmova. PDV, OIB, JOPPD, fiskalizacija i više.",
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
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
          Baza znanja
        </Link>{" "}
        <span>/</span> <span className="text-[var(--foreground)]">Rječnik</span>
      </nav>

      <header className="mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
          <BookOpen className="h-4 w-4" />
          {terms.length} pojmova
        </div>
        <h1 className="text-4xl font-bold text-slate-900 md:text-5xl">Poslovni rječnik</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Svi pojmovi koje trebate znati za poslovanje u Hrvatskoj. Od PDV-a do fiskalizacije.
        </p>
      </header>

      {/* Letter navigation */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {letters.map((letter) => (
          <a
            key={letter}
            href={`#${letter}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-700 hover:bg-blue-100 hover:text-blue-700"
          >
            {letter}
          </a>
        ))}
      </div>

      {/* Terms by letter */}
      <div className="space-y-10">
        {letters.map((letter) => (
          <section key={letter} id={letter}>
            <h2 className="mb-4 text-2xl font-bold text-slate-900">{letter}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grouped[letter].map((term) => (
                <Link
                  key={term.slug}
                  href={`/rjecnik/${term.slug}`}
                  className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">
                      {term.frontmatter.term}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 line-clamp-1">
                      {term.frontmatter.shortDefinition}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
