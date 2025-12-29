"use client"

import Link from "next/link"
import { FileText, ScanText, Sparkles, Shield, Users, Landmark, ArrowRight } from "lucide-react"
import { FeatureStoryScroller } from "@/components/marketing/FeatureStoryScroller"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger, StaggerItem } from "@/components/motion/Stagger"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { HoverScale } from "@/components/ui/motion/HoverScale"

export function MarketingFeaturesClient() {
  return (
    <SectionBackground>
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <Stagger className="text-center">
          <StaggerItem>
            <h1 className="text-display text-4xl font-semibold md:text-5xl">Mogućnosti</h1>
          </StaggerItem>
          <StaggerItem>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/60">
              FiskAI je modularan: počnite s osnovama (paušalni obrt), a zatim dodajte e-račune,
              fiskalizaciju i napredne funkcije kako rastete.
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90"
              >
                Pogledaj cijene <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/10"
              >
                Započni besplatnu probu
              </Link>
            </div>
          </StaggerItem>
        </Stagger>

        <Reveal className="mt-12">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 md:p-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold text-cyan-400">Scrolly-telling</p>
              <h2 className="mt-2 text-2xl font-semibold md:text-3xl">
                Pokažimo vrijednost u akciji
              </h2>
              <p className="mt-3 text-sm text-white/60 md:text-base">
                Kako skrolate, desno se mijenja &quot;mini demo&quot; i vizualno potvrđuje ono što
                čitate.
              </p>
            </div>
            <div className="mt-8">
              <FeatureStoryScroller />
            </div>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <Reveal>
            <HoverScale>
              <GlassCard className="h-full">
                <div className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                  AI-first princip
                </div>
                <div className="text-sm text-white/60">
                  AI nikad ne &quot;mijenja istinu&quot; bez potvrde korisnika: prijedlozi su
                  vidljivi, reverzibilni i (idealno) auditabilni.
                </div>
              </GlassCard>
            </HoverScale>
          </Reveal>

          <Reveal>
            <HoverScale>
              <GlassCard className="h-full">
                <div className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <Shield className="h-5 w-5 text-cyan-400" />
                  Sigurnost i privatnost
                </div>
                <div className="text-sm text-white/60">
                  FiskAI treba imati jasan &quot;Trust Center&quot;: gdje su podaci, koliko se
                  čuvaju, kako se izvoze i brišu te kako radi AI obrada.
                  <div className="mt-3">
                    <Link
                      href="/security"
                      className="text-sm font-semibold text-cyan-400 hover:underline"
                    >
                      Pročitaj više
                    </Link>
                  </div>
                </div>
              </GlassCard>
            </HoverScale>
          </Reveal>

          <Reveal>
            <HoverScale>
              <GlassCard className="h-full">
                <div className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <FileText className="h-5 w-5 text-cyan-400" />
                  Računi (core)
                </div>
                <div className="text-sm text-white/60">
                  Kreiranje, slanje i praćenje računa, statusi, kupci, artikli, predlošci i izvozi.
                </div>
              </GlassCard>
            </HoverScale>
          </Reveal>

          <Reveal>
            <HoverScale>
              <GlassCard className="h-full">
                <div className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <ScanText className="h-5 w-5 text-cyan-400" />
                  Troškovi + skeniranje
                </div>
                <div className="text-sm text-white/60">
                  Skenirajte račun, automatski izvucite podatke i potvrdite unos (AI/OCR).
                </div>
              </GlassCard>
            </HoverScale>
          </Reveal>

          <Reveal className="md:col-span-2">
            <HoverScale>
              <GlassCard>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <Landmark className="h-5 w-5 text-cyan-400" />
                    E-računi i fiskalizacija 2.0
                  </div>
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-400">
                    Dolazi uskoro
                  </span>
                </div>
                <div className="text-sm text-white/60">
                  Priprema za integraciju s informacijskim posrednicima (npr. IE-Računi) i praćenje
                  statusa e-računa.
                </div>
              </GlassCard>
            </HoverScale>
          </Reveal>

          <Reveal className="md:col-span-2">
            <HoverScale>
              <GlassCard>
                <div className="flex items-center gap-2 text-lg font-semibold mb-4">
                  <Users className="h-5 w-5 text-cyan-400" />
                  Suradnja s knjigovođom
                </div>
                <div className="text-sm text-white/60">
                  Izvozi i audit trag omogućuju suradnju bez &quot;fascikla&quot; i ručnog
                  prepisivanja.
                </div>
              </GlassCard>
            </HoverScale>
          </Reveal>
        </div>
      </div>
    </SectionBackground>
  )
}
