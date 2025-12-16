import { Metadata } from "next"
import { NewsList } from "@/components/news/NewsList"
import { Newspaper } from "lucide-react"

export const metadata: Metadata = {
  title: "Porezne Vijesti | FiskAI",
  description:
    "Najnovije vijesti iz Porezne uprave, Narodnih novina i FINA-e za hrvatske poduzetnike. Automatizirani sažeci relevantni za vaše poslovanje.",
  keywords: ["porezne vijesti", "porezna uprava", "narodne novine", "FINA", "hrvatska"],
}

export default function VijestiPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
          <Newspaper className="h-4 w-4" />
          Automatizirano praćenje izvora
        </div>
        <h1 className="mb-4 text-4xl font-bold text-white">Porezne Vijesti</h1>
        <p className="mx-auto max-w-2xl text-lg text-white/60">
          Pratimo Poreznu upravu, Narodne novine, FINA-u i HGK. AI automatski filtrira i sažima
          vijesti relevantne za hrvatske poduzetnike.
        </p>
      </div>

      {/* News List */}
      <NewsList />

      {/* Sources Footer */}
      <div className="mt-12 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Izvori vijesti</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <SourceCard name="Porezna uprava" url="https://www.porezna-uprava.hr" />
          <SourceCard name="Narodne novine" url="https://narodne-novine.nn.hr" />
          <SourceCard name="FINA" url="https://www.fina.hr" />
          <SourceCard name="HGK" url="https://www.hgk.hr" />
        </div>
      </div>
    </div>
  )
}

function SourceCard({ name, url }: { name: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg bg-white/5 p-4 text-center transition-colors hover:bg-white/10"
    >
      <p className="font-medium text-white">{name}</p>
      <p className="text-xs text-white/50">{new URL(url).hostname}</p>
    </a>
  )
}
