import { Metadata } from "next"
import { ExternalLink } from "lucide-react"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "Službeni izvori | FiskAI",
  description: "Popis službenih izvora koje FiskAI koristi za ažuriranje sadržaja i kalkulatora.",
  alternates: {
    canonical: `${BASE_URL}/izvori`,
  },
}

const sources = [
  {
    name: "Porezna uprava Republike Hrvatske",
    url: "https://www.porezna-uprava.hr",
    description: "Službene upute, obrasci, e-Porezna sustav",
    category: "Državna tijela",
  },
  {
    name: "Narodne novine",
    url: "https://narodne-novine.nn.hr",
    description: "Službeni glasnik - zakoni, pravilnici, uredbe",
    category: "Državna tijela",
  },
  {
    name: "Ministarstvo financija",
    url: "https://mfin.gov.hr",
    description: "Fiskalna politika, proračun, javni dug",
    category: "Državna tijela",
  },
  {
    name: "FINA",
    url: "https://www.fina.hr",
    description: "Registri, e-poslovanje, platni promet",
    category: "Agencije",
  },
  {
    name: "HZZO",
    url: "https://www.hzzo.hr",
    description: "Zdravstveno osiguranje, doprinosi",
    category: "Agencije",
  },
  {
    name: "HZMO",
    url: "https://www.mirovinsko.hr",
    description: "Mirovinsko osiguranje, MIO doprinosi",
    category: "Agencije",
  },
  {
    name: "Hrvatska gospodarska komora",
    url: "https://www.hgk.hr",
    description: "Poslovne informacije, registri, NKD",
    category: "Komore",
  },
  {
    name: "Hrvatska obrtnička komora",
    url: "https://www.hok.hr",
    description: "Obrtni registar, obrtnice, cehovi",
    category: "Komore",
  },
  {
    name: "e-Građani",
    url: "https://gov.hr",
    description: "Digitalne javne usluge, e-Obrt, e-Tvrtka",
    category: "e-Usluge",
  },
]

export default function IzvoriPage() {
  const categories = [...new Set(sources.map((s) => s.category))]

  return (
    <SectionBackground variant="dark" showGrid={true} showOrbs={true}>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-4 text-4xl font-bold text-white">Službeni izvori</h1>
        <p className="mb-12 text-lg text-white/60">
          FiskAI koristi isključivo službene izvore za ažuriranje sadržaja i kalkulatora. Ovdje je
          potpuni popis.
        </p>

        {categories.map((category) => (
          <div key={category} className="mb-10">
            <h2 className="mb-4 text-xl font-semibold text-white">{category}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {sources
                .filter((s) => s.category === category)
                .map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-xl border border-white/10 bg-surface/5 backdrop-blur-sm p-5 transition-colors hover:bg-surface/10"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="font-semibold text-white">{source.name}</h3>
                      <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-primary" />
                    </div>
                    <p className="text-sm text-white/60">{source.description}</p>
                    <p className="mt-2 text-xs text-white/40">{new URL(source.url).hostname}</p>
                  </a>
                ))}
            </div>
          </div>
        ))}

        <div className="mt-12 rounded-xl border border-white/10 bg-surface/5 backdrop-blur-sm p-6">
          <h2 className="mb-2 font-semibold text-white">Kako pratimo promjene?</h2>
          <p className="text-sm text-white/60">
            Automatizirano pratimo RSS feedove ključnih izvora. Svaka promjena propisa okida pregled
            relevantnog sadržaja. Pogledajte našu{" "}
            <a href="/urednicka-politika" className="text-primary hover:underline">
              uredničku politiku
            </a>
            .
          </p>
        </div>
      </div>
    </SectionBackground>
  )
}
