"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Laptop,
  ReceiptText,
  Search,
  Shapes,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { HoverScale } from "@/components/ui/motion/HoverScale"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/Reveal"

type GuideListItem = {
  slug: string
  title: string
  description: string
}

type GuideGroup = "Sve" | "Paušalni" | "Obrt" | "D.O.O." | "Freelancer" | "Posebni"

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function getGroup(slug: string): GuideGroup {
  if (slug.includes("pausalni")) return "Paušalni"
  if (slug.startsWith("obrt")) return "Obrt"
  if (slug.includes("doo") || slug.includes("jdoo")) return "D.O.O."
  if (slug.includes("freelancer")) return "Freelancer"
  if (slug.includes("posebni")) return "Posebni"
  return "Sve"
}

function getIcon(slug: string) {
  const group = getGroup(slug)
  if (group === "Paušalni") return ReceiptText
  if (group === "Obrt") return BriefcaseBusiness
  if (group === "D.O.O.") return Building2
  if (group === "Freelancer") return Laptop
  return Shapes
}

export function GuidesExplorer({ guides }: { guides: GuideListItem[] }) {
  const reduce = useReducedMotion()
  const [query, setQuery] = useState("")
  const [group, setGroup] = useState<GuideGroup>("Sve")

  const featured = useMemo(() => {
    const preferred = guides.find((g) => g.slug === "pausalni-obrt")
    return preferred ?? guides[0]
  }, [guides])

  const filters: Array<{ id: GuideGroup; label: string }> = [
    { id: "Sve", label: "Sve" },
    { id: "Paušalni", label: "Paušalni" },
    { id: "Obrt", label: "Obrt" },
    { id: "D.O.O.", label: "D.O.O." },
    { id: "Freelancer", label: "Freelancer" },
    { id: "Posebni", label: "Posebni" },
  ]

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    return guides
      .filter((g) => g.slug !== featured?.slug)
      .filter((g) => (group === "Sve" ? true : getGroup(g.slug) === group))
      .filter((g) => {
        if (!q) return true
        return normalize(`${g.title} ${g.description}`).includes(q)
      })
  }, [featured?.slug, group, guides, query])

  return (
    <div className="mt-10">
      {featured && group === "Sve" && query.trim().length === 0 && (
        <Reveal className="mb-10">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 md:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_circle_at_0%_0%,rgba(6,182,212,0.16),transparent_60%),radial-gradient(700px_circle_at_100%_20%,rgba(99,102,241,0.12),transparent_55%)]" />
            <div className="relative grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">
                  <Sparkles className="h-4 w-4" />
                  Preporučeni početak
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-white/90 md:text-3xl">
                  {featured.title}
                </h2>
                <p className="mt-2 text-sm text-white/60 md:text-base">{featured.description}</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Button asChild variant="primary" size="default">
                    <Link href={`/vodic/${featured.slug}`}>
                      Otvori vodič <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="default">
                    <Link href="/wizard">Nisam siguran/na — pokreni čarobnjak</Link>
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
                <p className="text-sm font-semibold text-white/90">Kako koristiti bazu znanja</p>
                <ul className="mt-3 space-y-2 text-sm text-white/60">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    Krenite s vodičem, zatim otvorite usporedbe.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    Koristite kalkulatore za brzu procjenu.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    Spremite link i vratite se kasnije.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      <div className="mb-8 grid gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 md:grid-cols-[1fr_auto] md:items-center">
        <label className="relative">
          <span className="sr-only">Pretraži vodiče</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pretraži vodiče (npr. paušalni, d.o.o., freelancer)…"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm pl-10 pr-3 text-sm text-white/90 placeholder:text-white/40 outline-none transition-shadow focus:ring-2 focus:ring-cyan-500/30"
          />
        </label>

        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setGroup(filter.id)}
              className={cn(
                "rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                group === filter.id
                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 text-center">
          <p className="text-sm font-semibold text-white/90">Nema rezultata</p>
          <p className="mt-2 text-sm text-white/60">
            Pokušajte s drugim pojmom ili vratite filter na &quot;Sve&quot;.
          </p>
        </div>
      ) : (
        <motion.div layout className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((guide) => {
              const Icon = getIcon(guide.slug)
              return (
                <motion.div
                  key={guide.slug}
                  layout
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: 10 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link href={`/vodic/${guide.slug}`} className="group block h-full">
                    <HoverScale className="h-full">
                      <GlassCard hover={false} className="h-full p-6">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-white/90">{guide.title}</h3>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 transition-transform group-hover:scale-105">
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                        <p className="mb-4 text-sm text-white/60">{guide.description}</p>
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 transition-all group-hover:gap-3 group-hover:underline">
                          Otvori vodič <ArrowRight className="h-4 w-4" />
                        </span>
                      </GlassCard>
                    </HoverScale>
                  </Link>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
