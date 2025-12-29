import type { Metadata } from "next"
import Link from "next/link"
import { getAllGuides, getAllComparisons } from "@/lib/knowledge-hub/mdx"
import { BookOpen, Calculator, GitCompare, Sparkles, ArrowRight } from "lucide-react"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { HoverScale } from "@/components/ui/motion/HoverScale"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "Baza znanja | FiskAI",
  description:
    "Vodiči, usporedbe i besplatni alati za hrvatske poduzetnike: paušalni obrt, obrt na dohodak, j.d.o.o., d.o.o. i PDV prag.",
  alternates: {
    canonical: `${BASE_URL}/baza-znanja`,
  },
}

export default async function KnowledgeBasePage() {
  const guides = getAllGuides().slice(0, 6)
  const comparisons = (await getAllComparisons()).slice(0, 6)

  return (
    <SectionBackground variant="mesh">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <header className="text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400">
            <Sparkles className="h-4 w-4" />
            Centar znanja
          </div>
          <h1 className="mt-6 text-display text-4xl font-semibold md:text-5xl">
            Baza znanja + besplatni alati za hrvatske poduzetnike
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
            Brzo pronađite odgovor: koji oblik poslovanja ima smisla, što se mijenja kad prijeđete
            60.000€ i koje su vaše obveze — bez registracije.
          </p>
        </header>

        <section className="mt-12 grid gap-6 md:grid-cols-4">
          <Link href="/wizard" className="group">
            <HoverScale>
              <GlassCard className="h-full p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <Sparkles className="h-5 w-5 text-cyan-400" />
                    Čarobnjak
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-4 text-sm text-white/60">
                  Odgovorite na 4 pitanja i dobijte preporuku + vodič.
                </p>
              </GlassCard>
            </HoverScale>
          </Link>

          <Link href="/vodic" className="group">
            <HoverScale>
              <GlassCard className="h-full p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <BookOpen className="h-5 w-5 text-cyan-400" />
                    Vodiči
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-4 text-sm text-white/60">
                  Detaljno: porezi, doprinosi, registracija i obveze.
                </p>
              </GlassCard>
            </HoverScale>
          </Link>

          <Link href="/usporedba/pocinjem-solo" className="group">
            <HoverScale>
              <GlassCard className="h-full p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <GitCompare className="h-5 w-5 text-cyan-400" />
                    Usporedbe
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-4 text-sm text-white/60">
                  Tablice i kalkulatori za odluku (paušal vs obrt vs d.o.o.).
                </p>
              </GlassCard>
            </HoverScale>
          </Link>

          <Link href="/alati" className="group">
            <HoverScale>
              <GlassCard className="h-full p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-base font-semibold">
                    <Calculator className="h-5 w-5 text-cyan-400" />
                    Alati
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-4 text-sm text-white/60">
                  PDV prag, porez, doprinosi, uplatnice i kalendar rokova.
                </p>
              </GlassCard>
            </HoverScale>
          </Link>
        </section>

        {!!comparisons.length && (
          <section className="mt-14">
            <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-display text-3xl font-semibold text-white">Usporedbe</h2>
                <p className="mt-2 text-sm text-white/60">
                  Brza odluka uz tablice i kalkulator troškova.
                </p>
              </div>
              <Link href="/usporedba/pocinjem-solo" className="text-sm font-semibold text-cyan-400">
                Otvori sve usporedbe →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {comparisons.map((comparison) => (
                <Link
                  key={comparison.slug}
                  href={`/usporedba/${comparison.slug}`}
                  className="group"
                >
                  <HoverScale>
                    <GlassCard className="h-full p-6">
                      <h3 className="text-base font-semibold">{comparison.frontmatter.title}</h3>
                      <p className="mt-3 text-sm text-white/60">
                        {comparison.frontmatter.description}
                      </p>
                      <span className="mt-3 block text-xs font-semibold text-cyan-400 group-hover:underline">
                        Otvori →
                      </span>
                    </GlassCard>
                  </HoverScale>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!!guides.length && (
          <section className="mt-14">
            <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-display text-3xl font-semibold text-white">Vodiči</h2>
                <p className="mt-2 text-sm text-white/60">
                  Kompletni vodiči po obliku poslovanja (s hrvatskim terminima).
                </p>
              </div>
              <Link href="/vodic" className="text-sm font-semibold text-cyan-400">
                Pregledaj vodiče →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {guides.map((guide) => (
                <Link key={guide.slug} href={`/vodic/${guide.slug}`} className="group">
                  <HoverScale>
                    <GlassCard className="h-full p-6">
                      <h3 className="text-base font-semibold">{guide.frontmatter.title}</h3>
                      <p className="mt-3 text-sm text-white/60">{guide.frontmatter.description}</p>
                      <span className="mt-3 block text-xs font-semibold text-cyan-400 group-hover:underline">
                        Otvori →
                      </span>
                    </GlassCard>
                  </HoverScale>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </SectionBackground>
  )
}
