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
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-rose-50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_circle_at_30%_20%,rgba(244,63,94,0.08),transparent_50%)]" />

        <div className="relative mx-auto max-w-5xl px-4 py-16 md:px-6 md:py-24">
          <Stagger className="space-y-6 text-center">
            <StaggerItem>
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-2 text-sm font-medium text-rose-700">
                <Heart className="h-4 w-4" />
                Razumijemo te
              </div>
            </StaggerItem>

            <StaggerItem>
              <h1 className="text-4xl font-bold text-slate-900 md:text-5xl lg:text-6xl">
                Promjena softvera ne mora
                <br />
                <span className="text-rose-600">biti noćna mora.</span>
              </h1>
            </StaggerItem>

            <StaggerItem>
              <p className="mx-auto max-w-2xl text-lg text-slate-600">
                Znaš onaj osjećaj kad shvatiš da tvoj trenutni alat radi protiv tebe, ali misliš da
                je prekasno za promjenu? Nije.
                <span className="font-medium text-slate-900"> 5 minuta. To je sve.</span>
              </p>
            </StaggerItem>

            <StaggerItem>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg transition-colors hover:bg-slate-800"
                  >
                    Započni besplatno
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </motion.div>
                <Link
                  href="#kako"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Kako to funkcionira?
                </Link>
              </div>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* Pain Points - We Get It */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <Reveal className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">Zvuči poznato?</h2>
          </Reveal>

          <Stagger className="flex flex-wrap justify-center gap-3">
            {painPoints.map((point, i) => (
              <StaggerItem key={i}>
                <motion.div
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600"
                  whileHover={{
                    scale: 1.05,
                    borderColor: "rgb(244,63,94)",
                    backgroundColor: "rgb(255,241,242)",
                  }}
                >
                  {point}
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>

          <Reveal className="mt-10 text-center">
            <p className="text-lg text-slate-600">
              Ako si označio bar jednu —{" "}
              <span className="font-semibold text-slate-900">nisi sam.</span>
              <br />I da, postoji bolje.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 3-Step Migration */}
      <section id="kako" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <Reveal className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
              <Clock className="h-4 w-4" />5 minuta ukupno
            </div>
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Tri koraka. To je sve.
            </h2>
          </Reveal>

          <Stagger className="grid gap-6 md:grid-cols-3">
            {migrationSteps.map((step) => {
              const Icon = step.icon
              return (
                <StaggerItem key={step.step}>
                  <Card className="relative h-full border-slate-200 bg-white">
                    <div className="absolute -top-3 left-6">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                        {step.step}
                      </span>
                    </div>
                    <CardHeader className="pt-8">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                        <Icon className="h-6 w-6 text-slate-700" />
                      </div>
                      <CardTitle className="text-lg">{step.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-3 text-sm text-slate-600">{step.description}</p>
                      <p className="text-xs font-medium text-green-600">⏱️ {step.time}</p>
                    </CardContent>
                  </Card>
                </StaggerItem>
              )
            })}
          </Stagger>
        </div>
      </section>

      {/* Supported Formats */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <Reveal className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
                <FileSpreadsheet className="h-4 w-4" />
                Uvoz podataka
              </div>
              <h2 className="text-3xl font-bold text-slate-900">Tvoji podaci. Tvoj format.</h2>
              <p className="text-lg text-slate-600">
                Bez obzira iz kojeg softvera dolaziš, FiskAI razumije tvoje podatke. AI automatski
                prepoznaje stupce i mapira ih na prava polja.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {supportedFormats.map((format) => (
                  <div
                    key={format.name}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="font-medium text-slate-900">{format.name}</p>
                    <p className="text-xs text-slate-500">{format.description}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-slate-900">AI asistent</span>
                </div>
                <p className="mb-4 text-sm text-slate-600">
                  &quot;Vidim da imaš stupce &apos;Ime kupca&apos;, &apos;OIB&apos; i
                  &apos;Email&apos;. Mapirat ću ih automatski. Želiš li pregledati prije
                  uvoza?&quot;
                </p>
                <div className="flex gap-2">
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
                    Da, pregledaj
                  </button>
                  <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                    Uvezi odmah
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* What Gets Imported */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <Reveal className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-slate-900">Što možeš uvesti?</h2>
            <p className="mt-2 text-slate-600">Sve što ti treba za nastavak rada</p>
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
                  <Card className="h-full border-slate-200 bg-white text-center">
                    <CardContent className="pt-6">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                        <Icon className="h-6 w-6 text-blue-600" />
                      </div>
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
                    </CardContent>
                  </Card>
                </StaggerItem>
              )
            })}
          </Stagger>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <Reveal className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-700">
              <HelpCircle className="h-4 w-4" />
              Česta pitanja
            </div>
            <h2 className="text-3xl font-bold text-slate-900">Imaš pitanja?</h2>
          </Reveal>

          <Stagger className="space-y-4">
            {faqs.map((faq, i) => (
              <StaggerItem key={i}>
                <details className="group rounded-xl border border-slate-200 bg-slate-50">
                  <summary className="flex cursor-pointer items-center justify-between p-4 font-medium text-slate-900">
                    {faq.question}
                    <span className="ml-4 text-slate-400 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="border-t border-slate-200 p-4 text-sm text-slate-600">
                    {faq.answer}
                  </div>
                </details>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Support Promise */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-16 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-6">
          <Reveal className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium">
              <MessageCircle className="h-4 w-4" />
              Ljudski support
            </div>
            <h2 className="text-3xl font-bold md:text-4xl">Nisi sam u ovome.</h2>
            <p className="mx-auto max-w-2xl text-lg text-white/80">
              Naš tim ti pomaže s prvim uvozom — besplatno. Bez chatbota, bez čekanja. Pravi ljudi
              koji razumiju tvoje probleme.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 transition-colors hover:bg-white/90"
              >
                <Zap className="h-5 w-5" />
                Započni besplatno
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/20"
              >
                Razgovaraj s nama
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
