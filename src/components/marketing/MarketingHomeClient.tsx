"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger, StaggerItem } from "@/components/motion/Stagger"
import { PlexusBackground } from "@/components/marketing/PlexusBackground"
import { CountUp } from "@/components/marketing/CountUp"
import { Fiskalizacija2Wizard } from "@/components/marketing/Fiskalizacija2Wizard"
import { CountdownTimer } from "@/components/marketing/CountdownTimer"
import { QuickAccessToolbar } from "@/components/marketing/QuickAccessToolbar"
import { SwitchProviderCTA } from "@/components/marketing/SwitchProviderCTA"
import { MiniAssistant } from "@/components/marketing/MiniAssistant"
import { LatestNewsSection } from "@/components/news/LatestNewsSection"
import {
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  Calculator,
  CheckCircle2,
  FileText,
  HelpCircle,
  Receipt,
  ScanText,
  Scale,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react"

interface MarketingHomeClientProps {
  latestNews: Array<{
    slug: string
    title: string
    excerpt: string | null
    categoryName: string | null
    publishedAt: Date | null
  }>
}

export function MarketingHomeClient({ latestNews }: MarketingHomeClientProps) {
  return (
    <div>
      {/* COCKPIT HERO SECTION */}
      {/* @design-override: Hero uses hardcoded dark gradient for consistent cockpit aesthetic */}
      <section className="relative min-h-[90vh] overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        {/* Animated background effects */}
        <PlexusBackground className="opacity-40" />

        {/* Multiple glow orbs for cockpit effect */}
        {/* @design-override: Decorative orbs use vibrant raw colors for visual impact */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute left-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[120px]"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute right-[5%] top-[10%] h-[400px] w-[400px] rounded-full bg-indigo-500/15 blur-[100px]"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.15, 0.25, 0.15],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-[10%] left-[30%] h-[300px] w-[300px] rounded-full bg-cyan-500/10 blur-[80px]"
            animate={{
              x: [0, 50, 0],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Grid overlay for tech feel */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
          <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:items-start">
            {/* LEFT: Hero Content */}
            <Stagger className="space-y-8">
              {/* Tech credibility badge */}
              <StaggerItem>
                {/* @design-override: Badge on dark hero uses cyan for visibility */}
                <motion.div
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 backdrop-blur-sm"
                  whileHover={{ scale: 1.02, borderColor: "rgba(34, 211, 238, 0.5)" }}
                >
                  <Zap className="h-4 w-4" />
                  Jedno od tehnološki najnaprednijih financijskih rješenja u Hrvatskoj
                </motion.div>
              </StaggerItem>

              {/* Main headline - REBELLIOUS */}
              {/* @design-override: Hero text uses white for dark background contrast */}
              <StaggerItem>
                <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
                  <span className="block">Dok drugi kompliciraju,</span>
                  <motion.span
                    className="block bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent"
                    animate={{
                      backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    style={{ backgroundSize: "200% 200%" }}
                  >
                    mi pojednostavljujemo.
                  </motion.span>
                </h1>
              </StaggerItem>

              {/* Subheadline */}
              <StaggerItem>
                <p className="max-w-xl text-lg text-white/70 md:text-xl">
                  U svijetu loših softvera i komplicirane birokracije, FiskAI donosi mir.
                  <span className="text-white/90">
                    {" "}
                    Bez &quot;donosim fascikl&quot;. Bez mailova knjigovođi.
                  </span>
                </p>
              </StaggerItem>

              {/* CTAs */}
              {/* @design-override: Hero CTAs use vibrant cyan/blue for dark background */}
              <StaggerItem>
                <div className="flex flex-wrap gap-4">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Link
                      href="/register"
                      className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30"
                    >
                      Započni besplatno
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Link
                      href="/contact"
                      className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/30"
                    >
                      Zatraži demo
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Link
                      href="/alati"
                      className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-6 py-3.5 text-base font-semibold text-cyan-200 backdrop-blur-sm transition-all hover:bg-cyan-500/15 hover:border-cyan-400/50"
                    >
                      Istraži alate
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </motion.div>
                </div>
              </StaggerItem>

              {/* Feature badges */}
              <StaggerItem>
                <div className="flex flex-wrap gap-4 pt-4">
                  {[
                    { icon: Shield, text: "GDPR usklađeno" },
                    { icon: Sparkles, text: "AI za ubrzanje unosa" },
                    { icon: FileText, text: "E-računi spremni" },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <motion.div
                        key={item.text}
                        className="flex items-center gap-2 rounded-lg border border-border bg-surface/5 px-4 py-2 text-sm text-secondary"
                        whileHover={{
                          borderColor: "rgba(255,255,255,0.25)",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        }}
                      >
                        <Icon className="h-4 w-4 text-accent-light" />
                        {item.text}
                      </motion.div>
                    )
                  })}
                </div>
              </StaggerItem>
            </Stagger>

            {/* RIGHT: Fiskalizacija 2.0 Panel */}
            <div className="space-y-4 lg:pt-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Fiskalizacija2Wizard />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <CountdownTimer variant="compact" />
              </motion.div>
            </div>
          </div>

          {/* Quick Access Toolbar */}
          <motion.div
            className="mt-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <QuickAccessToolbar />
          </motion.div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-base to-transparent" />
      </section>

      {/* MINI ASSISTANT - Bridge between hero and features */}
      <MiniAssistant />

      {/* FEATURE CARDS */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <Stagger className="grid gap-6 md:grid-cols-3">
            <StaggerItem>
              <Link href="/features" className="group block">
                <Card className="card card-hover transition-transform group-hover:-translate-y-0.5">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-link" />
                        Računi i e-računi
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted">
                    Izdavanje, slanje i praćenje računa uz jasan status i audit trag.
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>

            <StaggerItem>
              <Link href="/features" className="group block">
                <Card className="card card-hover transition-transform group-hover:-translate-y-0.5">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <ScanText className="h-5 w-5 text-link" />
                        Troškovi + skeniranje
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted">
                    Slikajte račun, izvucite podatke i potvrdite unos u par klikova.
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>

            <StaggerItem>
              <Link href="/features" className="group block">
                <Card className="card card-hover transition-transform group-hover:-translate-y-0.5">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-link" />
                        Sigurnost i kontrola
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted">
                    Podaci pripadaju klijentu: izvoz, audit log i jasna pravila obrade.
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          </Stagger>
        </section>
      </Reveal>

      {/* Knowledge Hub - Wizard CTA Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-interactive to-blue-800">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_20%,rgba(96,165,250,0.35),transparent_55%),radial-gradient(700px_circle_at_80%_10%,rgba(99,102,241,0.35),transparent_52%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <Reveal className="space-y-6 text-foreground">
              <div className="inline-flex items-center gap-2 rounded-full bg-surface/20 px-4 py-1.5 text-sm font-medium">
                <HelpCircle className="h-4 w-4" />
                Centar znanja
              </div>
              <h2 className="text-3xl font-bold md:text-4xl text-balance">
                Ne znate koji oblik poslovanja vam treba?
              </h2>
              <p className="text-lg text-foreground/85">
                Paušalni obrt, obrt na dohodak, j.d.o.o., d.o.o.? Odgovorite na 4 jednostavna
                pitanja i saznajte koja opcija je najbolja za vas.
              </p>
              <div className="mobile-stack">
                <Link
                  href="/wizard"
                  className="btn-press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-surface px-6 py-3 text-sm font-semibold text-link hover:bg-surface/95"
                >
                  Pokreni čarobnjak
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/baza-znanja"
                  className="btn-press inline-flex min-h-[44px] items-center justify-center rounded-md border border-border bg-surface/10 px-6 py-3 text-sm font-semibold text-foreground hover:bg-surface/20"
                >
                  Otvori bazu znanja
                </Link>
              </div>
            </Reveal>

            <Stagger className="grid grid-cols-2 gap-4">
              {[
                {
                  href: "/usporedba/pocinjem-solo",
                  title: "Počinjem solo",
                  subtitle: "Paušal vs obrt vs j.d.o.o.",
                  icon: Briefcase,
                },
                {
                  href: "/usporedba/dodatni-prihod",
                  title: "Dodatni prihod",
                  subtitle: "Uz posao ili mirovinu",
                  icon: TrendingUp,
                },
                {
                  href: "/usporedba/firma",
                  title: "Osnivam firmu",
                  subtitle: "j.d.o.o. vs d.o.o.",
                  icon: Building2,
                },
                {
                  href: "/usporedba/preko-praga",
                  title: "Prelazim 60.000€",
                  subtitle: "PDV obveza i opcije",
                  icon: Scale,
                },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <StaggerItem key={item.href}>
                    <Link href={item.href} className="group block">
                      <div className="rounded-xl bg-surface/10 p-5 transition-all hover:bg-surface/20 hover:-translate-y-0.5">
                        <div className="flex items-start justify-between gap-3">
                          <Icon className="mb-3 h-8 w-8 text-foreground" />
                          <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
                        </div>
                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                        <p className="mt-1 text-sm text-muted">{item.subtitle}</p>
                      </div>
                    </Link>
                  </StaggerItem>
                )
              })}
            </Stagger>
          </div>
        </div>
      </section>

      {/* Guides Preview Section */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-display text-3xl font-semibold">Vodiči za poslovanje</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted">
              Detaljni vodiči o svakom obliku poslovanja u Hrvatskoj — porezi, doprinosi,
              registracija i obveze.
            </p>
          </div>
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                href: "/vodic/pausalni-obrt",
                title: "Paušalni obrt",
                description: "Najjednostavniji oblik. Do 60.000€ prihoda.",
              },
              {
                href: "/vodic/obrt-dohodak",
                title: "Obrt na dohodak",
                description: "Realni troškovi, PDV odbici.",
              },
              {
                href: "/vodic/doo",
                title: "J.D.O.O. / D.O.O.",
                description: "Ograničena odgovornost, više opcija.",
              },
              {
                href: "/vodic/freelancer",
                title: "Freelancer",
                description: "IT, dizajn, inozemni klijenti.",
              },
              {
                href: "/vodic/posebni-oblici",
                title: "Posebni oblici",
                description: "OPG, slobodna profesija, udruga.",
              },
            ].map((card) => (
              <StaggerItem key={card.href}>
                <Link href={card.href} className="group block">
                  <Card className="card h-full transition-all group-hover:shadow-lg group-hover:border-blue-300 group-hover:-translate-y-0.5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{card.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted">{card.description}</p>
                      <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-link group-hover:underline">
                        Saznaj više <ArrowRight className="h-3 w-3" />
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
          <div className="mt-8 text-center">
            <Link href="/vodic" className="text-sm font-semibold text-link hover:underline">
              Pregledaj sve vodiče →
            </Link>
          </div>
        </section>
      </Reveal>

      {/* Free Tools Section */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <Reveal className="mb-10 text-center">
            <h2 className="text-display text-3xl font-semibold">Besplatni alati</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted">
              Koristite naše besplatne alate za izračun poreza, generiranje uplatnica i praćenje
              rokova.
            </p>
          </Reveal>

          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href: "/alati/posd-kalkulator",
                title: "PO-SD Kalkulator",
                description: "Učitaj XML izvod iz banke i izračunaj primitke za PO-SD.",
                icon: FileText,
              },
              {
                href: "/alati/pdv-kalkulator",
                title: "PDV prag (60.000€)",
                description: "Procjena prelaska praga + projekcija do kraja godine.",
                icon: Calculator,
              },
              {
                href: "/alati/uplatnice",
                title: "Generator uplatnica",
                description: "HUB3 (PDF417) barkod za doprinose i poreze — spremno za skeniranje.",
                icon: Receipt,
              },
              {
                href: "/alati/kalendar",
                title: "Kalendar rokova",
                description: "Doprinosi, PDV prijave i ključni rokovi na jednom mjestu.",
                icon: Calendar,
              },
            ].map((tool) => {
              const Icon = tool.icon
              return (
                <StaggerItem key={tool.href}>
                  <Link href={tool.href} className="group block">
                    <Card className="card h-full transition-all group-hover:shadow-lg group-hover:border-blue-300 group-hover:-translate-y-0.5">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2">
                            <Icon className="h-5 w-5 text-link" />
                            {tool.title}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted">{tool.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                </StaggerItem>
              )
            })}
          </Stagger>

          <div className="mt-8 text-center">
            <Link href="/alati" className="text-sm font-semibold text-link hover:underline">
              Svi alati →
            </Link>
          </div>
        </div>
      </section>

      {/* Latest News Section */}
      <LatestNewsSection posts={latestNews} />

      {/* Early Access Program Section */}
      <section className="bg-gradient-to-b from-base to-blue-50">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <Reveal className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-info-bg px-4 py-1.5 text-sm font-medium text-link">
              <Sparkles className="h-4 w-4" />
              Program ranog pristupa
            </div>
            <h2 className="text-display text-3xl font-semibold">
              Pomozite nam izgraditi najbolji računovodstveni softver
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted">
              FiskAI je u aktivnom razvoju. Pridružite nam se kao rani korisnik i oblikujte
              budućnost moderne računovodstvene platforme za Hrvatsku.
            </p>
          </Reveal>

          <Stagger className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: CheckCircle2,
                title: "Utjecaj na razvoj",
                color: "bg-info-bg text-link",
                description:
                  "Vaš feedback direktno oblikuje prioritete razvoja. Predložite značajke koje vam trebaju.",
              },
              {
                icon: Zap,
                title: "Rani pristup novim značajkama",
                color: "bg-success-bg text-success-text",
                description:
                  "Budite prvi koji testiraju nove module: e-fakturiranje, fiskalizacija 2.0, AI asistent i više.",
              },
              {
                icon: Shield,
                title: "Transparentnost i povjerenje",
                color: "bg-surface-2 text-foreground",
                description:
                  "100% GDPR usklađeno, s potpunom kontrolom nad vašim podacima. Izvoz i migracija uvijek dostupni.",
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <StaggerItem key={item.title}>
                  <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm transition-transform hover:-translate-y-0.5">
                    <div className="mb-4 flex items-center gap-2">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center ${item.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <h3 className="mb-2 font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted">{item.description}</p>
                  </div>
                </StaggerItem>
              )
            })}
          </Stagger>

          <div className="mt-10 text-center">
            <div className="mb-8">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-interactive px-8 py-3.5 text-base font-semibold text-foreground shadow-lg shadow-accent/25 transition-all hover:shadow-xl hover:shadow-accent/30"
              >
                Pridružite se beta programu
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            <div className="inline-flex flex-wrap items-center justify-center gap-8 text-sm text-muted">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success-text" />
                Besplatan pristup tijekom beta razdoblja
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success-text" />
                Bez obveze
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success-text" />
                Vaši podaci pod vašom kontrolom
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Paušalni obrt section */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <Reveal className="space-y-4">
              <h2 className="text-display text-3xl font-semibold">
                Za paušalni obrt: jednostavno i kompletno
              </h2>
              <p className="text-sm text-muted">
                Cilj je da najjednostavniji korisnici dobiju sve što im treba: izdavanje računa,
                evidenciju troškova i &quot;paket za knjigovođu&quot; bez ručnog rada.
              </p>
              <div className="pt-2">
                <Link
                  href="/for/pausalni-obrt"
                  className="btn-press inline-flex items-center justify-center rounded-md bg-interactive px-5 py-3 text-sm font-semibold text-foreground hover:bg-interactive-hover min-h-[44px] md:min-h-0"
                >
                  Pogledaj landing za paušalni obrt <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <Card className="card">
                <CardHeader>
                  <CardTitle className="text-lg">Što dobivate odmah</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted">
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-link" /> Brzi onboarding s
                    checklistom
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-link" /> OCR + AI prijedlozi
                    kategorija za troškove
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-link" /> Izvoz podataka (računi,
                    troškovi, kontakti)
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-link" /> Priprema za e-račune /
                    fiskalizaciju 2.0
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Floating Switch Provider CTA */}
      <SwitchProviderCTA />
    </div>
  )
}
