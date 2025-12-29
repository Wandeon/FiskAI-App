import Link from "next/link"
import {
  Calculator,
  Scale,
  Calendar,
  CreditCard,
  BarChart3,
  ArrowRight,
  Shield,
  FileText,
} from "lucide-react"
import type { Metadata } from "next"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { HoverScale } from "@/components/ui/motion/HoverScale"
import { FadeIn } from "@/components/ui/motion/FadeIn"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "Besplatni alati za poslovanje | FiskAI",
  description:
    "Besplatni kalkulatori i alati za hrvatske poduzetnike - doprinosi, porezi, uplatnice i više.",
  alternates: {
    canonical: `${BASE_URL}/alati`,
  },
}

const tools = [
  {
    slug: "kalkulator-doprinosa",
    title: "Kalkulator doprinosa",
    description: "Izračunajte mjesečne doprinose za MIO i HZZO",
    icon: Calculator,
  },
  {
    slug: "kalkulator-poreza",
    title: "Kalkulator poreza",
    description: "Izračunajte paušalni porez na temelju prihoda",
    icon: BarChart3,
  },
  {
    slug: "pdv-kalkulator",
    title: "PDV prag (60.000€)",
    description: "Provjerite koliko ste blizu praga i kada postajete PDV obveznik",
    icon: Scale,
  },
  {
    slug: "uplatnice",
    title: "Generator uplatnica",
    description: "Generirajte HUB3 barkod za uplate doprinosa i poreza",
    icon: CreditCard,
  },
  {
    slug: "kalendar",
    title: "Kalendar rokova",
    description: "Podsjetnik za važne rokove prijava i uplata",
    icon: Calendar,
  },
  {
    slug: "oib-validator",
    title: "OIB Validator",
    description: "Provjerite valjanost OIB-a (Osobni identifikacijski broj)",
    icon: Shield,
  },
  {
    slug: "e-racun",
    title: "E-Račun Generator",
    description: "Generirajte UBL 2.1 XML e-račune prema hrvatskim standardima",
    icon: FileText,
  },
]

export default function ToolsIndexPage() {
  return (
    <SectionBackground>
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <nav className="mb-6 text-sm text-white/60">
          <Link href="/baza-znanja" className="hover:text-white/90">
            Baza znanja
          </Link>{" "}
          <span className="text-white/60">/</span> <span className="text-white/90">Alati</span>
        </nav>

        <FadeIn>
          <header className="text-center">
            <h1 className="text-display text-4xl font-semibold md:text-5xl">Besplatni alati</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
              Kalkulatori i pomoćni alati za hrvatske poduzetnike. Potpuno besplatno, bez
              registracije.
            </p>
          </header>
        </FadeIn>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link key={tool.slug} href={`/alati/${tool.slug}`} className="group">
              <HoverScale>
                <GlassCard className="h-full cursor-pointer">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10">
                    <tool.icon className="h-6 w-6 text-cyan-500" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-white">{tool.title}</h3>
                    <ArrowRight className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-2 text-sm text-white/60">{tool.description}</p>
                </GlassCard>
              </HoverScale>
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <GlassCard className="border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 p-6">
            <p className="text-sm text-white/90">
              Trebate širu sliku (paušal vs obrt vs d.o.o.)?{" "}
              <Link href="/wizard" className="font-semibold text-cyan-400 hover:text-cyan-300">
                Pokrenite čarobnjak
              </Link>{" "}
              ili otvorite{" "}
              <Link
                href="/usporedba/pocinjem-solo"
                className="font-semibold text-cyan-400 hover:text-cyan-300"
              >
                usporedbe
              </Link>
              .
            </p>
          </GlassCard>
        </div>
      </div>
    </SectionBackground>
  )
}
