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
      <section className="relative min-h-[90vh] overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        {/* Animated background effects */}
        <PlexusBackground className="opacity-40" />

        {/* Multiple glow orbs for cockpit effect */}
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
                <motion.div
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 backdrop-blur-sm"
                  whileHover={{ scale: 1.02, borderColor: "rgba(34, 211, 238, 0.5)" }}
                >
                  <Zap className="h-4 w-4" />
                  Jedno od tehnološki najnaprednijih financijskih rješenja u Hrvatskoj
                </motion.div>
              </StaggerItem>

              {/* Main headline - REBELLIOUS */}
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
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80"
                        whileHover={{
                          borderColor: "rgba(255,255,255,0.25)",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        }}
                      >
                        <Icon className="h-4 w-4 text-cyan-400" />
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
                <Fiskalizacija2Wizard variant="compact" />
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
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* FEATURE CARDS */}
      <Reveal asChild>
        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <Stagger className="grid gap-6 md:grid-cols-3">
            <StaggerItem>
              <Link href="/features" className="group block">
                <Card className="card card-hover transition-transform group-hover:-translate-y-0.5">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Računi i e-računi
                      </span>
                      <ArrowRight className="h-4 w-4 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-[var(--muted)]">
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
                        <ScanText className="h-5 w-5 text-blue-600" />
                        Troškovi + skeniranje
                      </span>
                      <ArrowRight className="h-4 w-4 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-[var(--muted)]">
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
                        <Shield className="h-5 w-5 text-blue-600" />
                        Sigurnost i kontrola
                      </span>
                      <ArrowRight className="h-4 w-4 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-[var(--muted)]">
                    Podaci pripadaju klijentu: izvoz, audit log i jasna pravila obrade.
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          </Stagger>
        </section>
      </Reveal>

      {/* Knowledge Hub - Wizard CTA Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_20%,rgba(96,165,250,0.35),transparent_55%),radial-gradient(700px_circle_at_80%_10%,rgba(99,102,241,0.35),transparent_52%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <Reveal className="space-y-6 text-white">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium">
                <HelpCircle className="h-4 w-4" />
                Centar znanja
              </div>
              <h2 className="text-3xl font-bold md:text-4xl text-balance">
                Ne znate koji oblik poslovanja vam treba?
              </h2>
              <p className="text-lg text-white/85">
                Paušalni obrt, obrt na dohodak, j.d.o.o., d.o.o.? Odgovorite na 4 jednostavna
                pitanja i saznajte koja opcija je najbolja za vas.
              </p>
              <div className="mobile-stack">
                <Link
                  href="/wizard"
                  className="btn-press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-blue-700 hover:bg-white/95"
                >
                  Pokreni čarobnjak
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/baza-znanja"
                  className="btn-press inline-flex min-h-[44px] items-center justify-center rounded-md border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20"
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
                      <div className="rounded-xl bg-white/10 p-5 transition-all hover:bg-white/20 hover:-translate-y-0.5">
                        <div className="flex items-start justify-between gap-3">
                          <Icon className="mb-3 h-8 w-8 text-white" />
                          <ArrowRight className="h-4 w-4 text-white/70 transition-transform group-hover:translate-x-0.5" />
                        </div>
                        <h3 className="font-semibold text-white">{item.title}</h3>
                        <p className="mt-1 text-sm text-white/70">{item.subtitle}</p>
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
      <Reveal asChild>
        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-display text-3xl font-semibold">Vodiči za poslovanje</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--muted)]">
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
                      <p className="text-xs text-[var(--muted)]">{card.description}</p>
                      <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-blue-700 group-hover:underline">
                        Saznaj više <ArrowRight className="h-3 w-3" />
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
          <div className="mt-8 text-center">
            <Link href="/vodic" className="text-sm font-semibold text-blue-700 hover:underline">
              Pregledaj sve vodiče →
            </Link>
          </div>
        </section>
      </Reveal>

      {/* Free Tools Section */}
      <section className="bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <Reveal className="mb-10 text-center">
            <h2 className="text-display text-3xl font-semibold">Besplatni alati</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--muted)]">
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
                            <Icon className="h-5 w-5 text-blue-600" />
                            {tool.title}
                          </span>
                          <ArrowRight className="h-4 w-4 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-[var(--muted)]">{tool.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                </StaggerItem>
              )
            })}
          </Stagger>

          <div className="mt-8 text-center">
            <Link href="/alati" className="text-sm font-semibold text-blue-700 hover:underline">
              Svi alati →
            </Link>
          </div>
        </div>
      </section>

      {/* Latest News Section */}
      <LatestNewsSection posts={latestNews} />

      {/* Testimonials & Trust Section */}
      <section className="bg-gradient-to-b from-white to-blue-50">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <Reveal className="mb-10 text-center">
            <h2 className="text-display text-3xl font-semibold">
              Pouzdano od strane obrtnika i knjigovođa
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--muted)]">
              FiskAI pomaže paušalnim obrtnicima, VAT obrtima i knjigovođama u cijeloj Hrvatskoj.
            </p>
          </Reveal>

          <Stagger className="grid gap-6 md:grid-cols-3">
            {[
              {
                initials: "MK",
                name: "Marko K.",
                role: "Paušalni obrt, IT usluge",
                color: "bg-blue-100 text-blue-700",
                quote:
                  "Prije sam trošio 5-6 sati mjesečno na administraciju. Sada mi treba sat vremena za sve. Izvoz za knjigovođu je game-changer.",
              },
              {
                initials: "AK",
                name: "Ana K.",
                role: "Knjigovođa, računovodstveni ured",
                color: "bg-green-100 text-green-700",
                quote:
                  "Klijenti mi šalju uredne izvozne pakete umjesto fotografija računa. Smanjuje vrijeme obrade za 70% i eliminira greške pri prepisivanju.",
              },
              {
                initials: "IP",
                name: "Ivan P.",
                role: "VAT obrt, građevinarstvo",
                color: "bg-purple-100 text-purple-700",
                quote:
                  "AI OCR za skeniranje računa je nevjerojatan. Uštedio mi je 10-15 sati mjesečno na unosu troškova. Priprema za e-račune je plus za budućnost.",
              },
            ].map((t) => (
              <StaggerItem key={t.initials}>
                <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm transition-transform hover:-translate-y-0.5">
                  <div className="mb-4 flex items-center gap-2">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${t.color}`}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-xs text-[var(--muted)]">{t.role}</p>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--muted)] italic mb-4">&quot;{t.quote}&quot;</p>
                  <div className="flex items-center gap-1" aria-label="Ocjena 5 od 5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <svg
                        key={i}
                        className="h-4 w-4 text-yellow-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          <div className="mt-10 text-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-8">
              <div className="text-center">
                <CountUp
                  value={500}
                  className="text-2xl font-bold text-blue-700"
                  format={(v) => `${Math.round(v)}+`}
                />
                <p className="text-xs text-[var(--muted)]">Izdanih računa mjesečno</p>
              </div>
              <div className="text-center">
                <CountUp
                  value={80}
                  className="text-2xl font-bold text-blue-700"
                  format={(v) => `${Math.round(v)}%`}
                />
                <p className="text-xs text-[var(--muted)]">Manje vremena na administraciju</p>
              </div>
              <div className="text-center">
                <CountUp
                  value={100}
                  className="text-2xl font-bold text-blue-700"
                  format={(v) => `${Math.round(v)}%`}
                />
                <p className="text-xs text-[var(--muted)]">GDPR usklađeno</p>
              </div>
              <div className="text-center">
                <CountUp
                  value={24}
                  className="text-2xl font-bold text-blue-700"
                  format={(v) => `${Math.round(v)}h`}
                />
                <p className="text-xs text-[var(--muted)]">Vrijeme odgovora podrške</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Paušalni obrt section */}
      <section className="bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <Reveal className="space-y-4">
              <h2 className="text-display text-3xl font-semibold">
                Za paušalni obrt: jednostavno i kompletno
              </h2>
              <p className="text-sm text-[var(--muted)]">
                Cilj je da najjednostavniji korisnici dobiju sve što im treba: izdavanje računa,
                evidenciju troškova i &quot;paket za knjigovođu&quot; bez ručnog rada.
              </p>
              <div className="pt-2">
                <Link
                  href="/for/pausalni-obrt"
                  className="btn-press inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 min-h-[44px] md:min-h-0"
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
                <CardContent className="space-y-2 text-sm text-[var(--muted)]">
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600" /> Brzi onboarding s
                    checklistom
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600" /> OCR + AI prijedlozi
                    kategorija za troškove
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600" /> Izvoz podataka
                    (računi, troškovi, kontakti)
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600" /> Priprema za e-račune /
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
