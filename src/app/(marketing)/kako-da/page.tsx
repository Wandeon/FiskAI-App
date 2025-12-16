import { Metadata } from "next"
import Link from "next/link"
import { FileText, ArrowRight, Clock } from "lucide-react"
import { getAllHowTos } from "@/lib/knowledge-hub/mdx"

export const metadata: Metadata = {
  title: "Kako da... | Vodiči korak po korak | FiskAI",
  description:
    "Praktični vodiči za sve porezne i administrativne zadatke. PO-SD, fiskalizacija, PDV registracija i više.",
}

export default async function HowToListingPage() {
  const howtos = await getAllHowTos()

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
          Baza znanja
        </Link>{" "}
        <span>/</span> <span className="text-[var(--foreground)]">Kako da...</span>
      </nav>

      <header className="mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
          <FileText className="h-4 w-4" />
          Korak po korak
        </div>
        <h1 className="text-4xl font-bold text-slate-900 md:text-5xl">Kako da...</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Praktični vodiči za sve administrativne zadatke. S primjerima i screenshot-ima.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {howtos.map((howto) => (
          <Link
            key={howto.slug}
            href={`/kako-da/${howto.slug}`}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-md"
          >
            <h2 className="mb-2 text-lg font-semibold text-slate-900 group-hover:text-green-600">
              {howto.frontmatter.title}
            </h2>
            <p className="mb-4 flex-1 text-slate-600">{howto.frontmatter.description}</p>
            <div className="flex items-center justify-between">
              {howto.frontmatter.totalTime && (
                <span className="flex items-center gap-1 text-sm text-slate-500">
                  <Clock className="h-4 w-4" />
                  {howto.frontmatter.totalTime.replace("PT", "").replace("M", " min")}
                </span>
              )}
              <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                Čitaj vodič
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {howtos.length === 0 && <p className="text-center text-slate-500">Vodiči dolaze uskoro...</p>}
    </div>
  )
}
