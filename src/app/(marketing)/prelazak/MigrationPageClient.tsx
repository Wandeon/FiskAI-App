"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Heart,
  HelpCircle,
  MessageCircle,
  RefreshCw,
  Shield,
  Sparkles,
  Upload,
  Users,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger, StaggerItem } from "@/components/motion/Stagger"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const painPoints = [
  "Previše klikova za jednostavan račun",
  "Spor support koji ne razumije tvoje potrebe",
  "Sučelje iz 2010. godine",
  "Skupo za ono što dobiješ",
  "Strah od promjene jer si već uložio vrijeme",
]

const migrationSteps = [
  {
    step: 1,
    title: "Izvezi podatke",
    description: "Preuzmi CSV/Excel iz starog softvera. Većina ih ima tu opciju.",
    time: "2 min",
    icon: Download,
  },
  {
    step: 2,
    title: "Uvezi u FiskAI",
    description: "Jednostavan drag & drop. AI prepoznaje stupce automatski.",
    time: "2 min",
    icon: Upload,
  },
  {
    step: 3,
    title: "Provjeri i kreni",
    description: "Pregledaj uvezene podatke, ispravi ako treba, i gotovo.",
    time: "1 min",
    icon: CheckCircle2,
  },
]

const supportedFormats = [
  { name: "CSV", description: "Univerzalni format" },
  { name: "Excel (.xlsx)", description: "Microsoft Excel" },
  { name: "XML", description: "Strukturirani podaci" },
  { name: "JSON", description: "Za developere" },
]

const faqs = [
  {
    question: "Hoću li izgubiti stare račune?",
    answer:
      "Ne. Stari računi ostaju u starom softveru. FiskAI uvozi samo podatke koje trebaš: kupce, artikle, predloške. Stari računi ti ionako trebaju tamo gdje jesu — za arhivu.",
  },
  {
    question: "Što ako nešto pođe po zlu tijekom uvoza?",
    answer:
      "Uvoz nikada ne briše izvorne podatke. Možeš pokušati koliko god puta trebaš. Plus, naš support ti pomaže besplatno s prvim uvozom.",
  },
  {
    question: "Koliko zaista traje migracija?",
    answer:
      "Za većinu korisnika: 5 minuta. Ako imaš tisuće kontakata ili artikala, možda 10-15 minuta. Ali to je jednokratno — i nikad više ne moraš o tome razmišljati.",
  },
  {
    question: "Mogu li isprobati prije nego potpuno prijeđem?",
    answer:
      "Apsolutno. Koristi oba paralelno koliko god trebaš. FiskAI ima besplatan plan — nema pritiska. Kad budeš spreman, jednostavno prestani koristiti stari.",
  },
]

export function MigrationPageClient() {
  return (
    <div>
      {/* Hero - Empathetic */}
      <SectionBackground variant="hero">
        <div className="mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-24">
          <Stagger className="space-y-6 text-center">
            <StaggerItem>
              <div className="inline-flex items-center gap-2 rounded-full bg-surface/10 backdrop-blur-sm px-4 py-2 text-sm font-medium text-rose-300">
                <Heart className="h-4 w-4" />
                Razumijemo te
              </div>
            </StaggerItem>

            <StaggerItem>
              <h1 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl">
                Promjena softvera ne mora
                <br />
                <span className="text-rose-400">biti noćna mora.</span>
              </h1>
            </StaggerItem>

            <StaggerItem>
              <p className="mx-auto max-w-2xl text-lg text-white/60">
                Znaš onaj osjećaj kad shvatiš da tvoj trenutni alat radi protiv tebe, ali misliš da
                je prekasno za promjenu? Nije.
                <span className="font-medium text-white"> 5 minuta. To je sve.</span>
              </p>
            </StaggerItem>

            <StaggerItem>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-interactive px-8 py-4 text-base font-semibold text-white shadow-lg transition-colors hover:opacity-90"
                  >
                    Započni besplatno
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </motion.div>
                <Link
                  href="#kako"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-surface/5 backdrop-blur-sm px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-surface/10"
                >
                  Kako to funkcionira?
                </Link>
              </div>
            </StaggerItem>
          </Stagger>
        </div>
      </SectionBackground>

      {/* Pain Points - We Get It */}
      <SectionBackground variant="dark">
        <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <Reveal className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">Zvuči poznato?</h2>
          </Reveal>

          <Stagger className="flex flex-wrap justify-center gap-3">
            {painPoints.map((point, i) => (
              <StaggerItem key={i}>
                <motion.div
                  className="rounded-full border border-white/10 bg-surface/5 backdrop-blur-sm px-4 py-2 text-sm text-white/60"
                  whileHover={{
                    scale: 1.05,
                    borderColor: "rgba(244,63,94,0.5)",
                    backgroundColor: "rgba(244,63,94,0.1)",
                  }}
                >
                  {point}
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal className="mt-10 text-center">
            <p className="text-lg text-white/60">
              Ako si označio bar jednu — <span className="font-semibold text-white">nisi sam.</span>
              <br />I da, postoji bolje.
            </p>
          </Reveal>
        </div>
      </SectionBackground>

      {/* 3-Step Migration */}
      <SectionBackground variant="subtle" id="kako">
        <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <Reveal className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-success-bg0/10 backdrop-blur-sm px-4 py-2 text-sm font-medium text-green-300">
              <Clock className="h-4 w-4" />5 minuta ukupno
            </div>
            <h2 className="text-3xl font-bold text-white md:text-4xl">Tri koraka. To je sve.</h2>
          </Reveal>

          <Stagger className="grid gap-6 md:grid-cols-3">
            {migrationSteps.map((step) => {
              const Icon = step.icon
              return (
                <StaggerItem key={step.step}>
                  <Card className="relative h-full border-white/10 bg-surface/5 backdrop-blur-sm">
                    <div className="absolute -top-3 left-6">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-interactive text-sm font-bold text-white">
                        {step.step}
                      </span>
                    </div>
                    <CardHeader className="pt-8">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle className="text-lg text-white">{step.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-3 text-sm text-white/60">{step.description}</p>
                      <p className="text-xs font-medium text-success-text">⏱️ {step.time}</p>
                    </CardContent>
                  </Card>
                </StaggerItem>
              )
            })}
          </Stagger>
        </div>
      </SectionBackground>

      {/* Supported Formats */}
      <SectionBackground variant="dark">
        <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <Reveal className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-info-bg backdrop-blur-sm px-4 py-2 text-sm font-medium text-info-text">
                <FileSpreadsheet className="h-4 w-4" />
                Uvoz podataka
              </div>
              <h2 className="text-3xl font-bold text-white">Tvoji podaci. Tvoj format.</h2>
              <p className="text-lg text-white/60">
                Bez obzira iz kojeg softvera dolaziš, FiskAI razumije tvoje podatke. AI automatski
                prepoznaje stupce i mapira ih na prava polja.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {supportedFormats.map((format) => (
                  <div
                    key={format.name}
                    className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-3"
                  >
                    <p className="font-medium text-white">{format.name}</p>
                    <p className="text-xs text-white/60">{format.description}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-info-bg backdrop-blur-sm p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-white">AI asistent</span>
                </div>
                <p className="mb-4 text-sm text-white/60">
                  &quot;Vidim da imaš stupce &apos;Ime kupca&apos;, &apos;OIB&apos; i
                  &apos;Email&apos;. Mapirat ću ih automatski. Želiš li pregledati prije
                  uvoza?&quot;
                </p>
                <div className="flex gap-2">
                  <button className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white">
                    Da, pregledaj
                  </button>
                  <button className="rounded-lg border border-white/20 bg-surface/5 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white">
                    Uvezi odmah
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </SectionBackground>

      {/* What Gets Imported */}
      <SectionBackground variant="subtle">
        <div className="mx-auto max-w-5xl px-4 py-16 md:px-6">
          <Reveal className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-white">Što možeš uvesti?</h2>
            <p className="mt-2 text-white/60">Sve što ti treba za nastavak rada</p>
          </Reveal>

          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Users, title: "Kupci/Kontakti", desc: "Ime, OIB, adresa, email" },
              { icon: FileSpreadsheet, title: "Artikli/Usluge", desc: "Naziv, cijena, PDV stopa" },
              {
                icon: RefreshCw,
                title: "Ponavljajući računi",
                desc: "Predlošci za brzo izdavanje",
              },
              { icon: Shield, title: "Postavke tvrtke", desc: "Logo, IBAN, potpis" },
            ].map((item) => {
              const Icon = item.icon
              return (
                <StaggerItem key={item.title}>
                  <Card className="h-full border-white/10 bg-surface/5 backdrop-blur-sm text-center">
                    <CardContent className="pt-6">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-interactive/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <p className="font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-xs text-white/60">{item.desc}</p>
                    </CardContent>
                  </Card>
                </StaggerItem>
              )
            })}
          </Stagger>
        </div>
      </SectionBackground>

      {/* FAQ */}
      <SectionBackground variant="dark">
        <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
          <Reveal className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-warning-bg0/10 backdrop-blur-sm px-4 py-2 text-sm font-medium text-amber-300">
              <HelpCircle className="h-4 w-4" />
              Česta pitanja
            </div>
            <h2 className="text-3xl font-bold text-white">Imaš pitanja?</h2>
          </Reveal>

          <Stagger className="space-y-4">
            {faqs.map((faq, i) => (
              <StaggerItem key={i}>
                <details className="group rounded-xl border border-white/10 bg-surface/5 backdrop-blur-sm">
                  <summary className="flex cursor-pointer items-center justify-between p-4 font-medium text-white">
                    {faq.question}
                    <span className="ml-4 text-white/40 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="border-t border-white/10 p-4 text-sm text-white/60">
                    {faq.answer}
                  </div>
                </details>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </SectionBackground>

      {/* Support Promise */}
      <SectionBackground variant="hero">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center md:px-6">
          <Reveal className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-surface/10 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white">
              <MessageCircle className="h-4 w-4" />
              Ljudski support
            </div>
            <h2 className="text-3xl font-bold text-white md:text-4xl">Nisi sam u ovome.</h2>
            <p className="mx-auto max-w-2xl text-lg text-white/60">
              Naš tim ti pomaže s prvim uvozom — besplatno. Bez chatbota, bez čekanja. Pravi ljudi
              koji razumiju tvoje probleme.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-surface px-8 py-4 text-base font-semibold text-foreground transition-colors hover:bg-surface/90"
              >
                <Zap className="h-5 w-5" />
                Započni besplatno
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-surface/5 backdrop-blur-sm px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-surface/10"
              >
                Razgovaraj s nama
              </Link>
            </div>
          </Reveal>
        </div>
      </SectionBackground>
    </div>
  )
}
