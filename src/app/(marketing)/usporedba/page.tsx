import { Metadata } from "next"
import Link from "next/link"
import { getAllComparisons } from "@/lib/knowledge-hub/mdx"
import { ComparisonsExplorer } from "./ComparisonsExplorer"

export const metadata: Metadata = {
  title: "Usporedbe oblika poslovanja | FiskAI",
  description:
    "Usporedite različite oblike poslovanja u Hrvatskoj: paušalni obrt, obrt dohodaš, d.o.o., freelance i više.",
}

export default async function ComparisonsIndexPage() {
  const allComparisons = await getAllComparisons()
  const comparisons = allComparisons.map((c) => ({
    slug: c.slug,
    title: c.frontmatter.title,
    description: c.frontmatter.description,
  }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
          Baza znanja
        </Link>{" "}
        <span className="text-[var(--muted)]">/</span>{" "}
        <span className="text-[var(--foreground)]">Usporedbe</span>
      </nav>

      <header className="text-center">
        <h1 className="text-display text-4xl font-semibold md:text-5xl">
          Usporedbe oblika poslovanja
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Pronađite idealan oblik poslovanja za vašu situaciju. Detaljne usporedbe poreza, doprinosa
          i administrativnih obveza.
        </p>
      </header>

      <ComparisonsExplorer comparisons={comparisons} />
    </div>
  )
}
