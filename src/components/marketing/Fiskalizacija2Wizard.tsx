"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Rocket,
  Building2,
  Briefcase,
  User,
  HelpCircle,
  FileText,
  Clock,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

type BusinessType = "pausalni" | "obrt-dohodak" | "doo" | "freelancer" | "starting" | null

interface BusinessOption {
  id: BusinessType
  label: string
  icon: typeof Building2
  description: string
}

const businessOptions: BusinessOption[] = [
  {
    id: "pausalni",
    label: "Paušalni obrtnik",
    icon: User,
    description: "Do 60.000 EUR/god, bez knjigovodstva",
  },
  {
    id: "obrt-dohodak",
    label: "Obrt na dohodak",
    icon: Briefcase,
    description: "Vodim knjige, imam knjigovođu",
  },
  {
    id: "doo",
    label: "D.O.O. / J.D.O.O.",
    icon: Building2,
    description: "Društvo s ograničenom odgovornošću",
  },
  {
    id: "freelancer",
    label: "Freelancer",
    icon: Lightbulb,
    description: "Samostalna djelatnost, uglavnom IT",
  },
  {
    id: "starting",
    label: "Tek počinjem",
    icon: HelpCircle,
    description: "Još razmišljam koju formu odabrati",
  },
]

interface FiskalizacijaResult {
  staysTheSame: string[]
  changes: string[]
  todos: { task: string; details: string }[]
  fiskaiHelps: string[]
  urgency: "low" | "medium" | "high"
}

const results: Record<NonNullable<BusinessType>, FiskalizacijaResult> = {
  pausalni: {
    staysTheSame: [
      "Paušalna osnovica i porezni razredi",
      "Mjesečni doprinosi (262 EUR)",
      "Kvartalni porez na dohodak",
      "Bez obveze vođenja knjiga",
    ],
    changes: [
      "E-računi OBVEZNI od 01.01.2026",
      "Potreban digitalni certifikat (FINA)",
      "Računi moraju biti u UBL 2.1 formatu",
      "Obvezna arhiva e-računa 11 godina",
    ],
    todos: [
      { task: "Nabavi FINA certifikat", details: "~150 EUR, traje 5-7 dana" },
      { task: "Odaberi softver za e-račune", details: "FiskAI = besplatan start" },
      { task: "Testiraj slanje prvog e-računa", details: "5 minuta u FiskAI" },
      { task: "Obavijesti svoje kupce", details: "Email predložak u FiskAI" },
    ],
    fiskaiHelps: [
      "Automatski generira UBL 2.1 XML",
      "Validira OIB, IBAN i adrese prije slanja",
      "Podsjeća na rokove i prati status",
      "Besplatno za do 20 računa mjesečno",
    ],
    urgency: "medium",
  },
  "obrt-dohodak": {
    staysTheSame: [
      "Vođenje poslovnih knjiga",
      "Odbitak poslovnih troškova",
      "Suradnja s knjigovođom",
      "PDV obveze (ako ste u sustavu)",
    ],
    changes: [
      "E-računi OBVEZNI od 01.01.2026",
      "Knjiženje iz strukturiranih e-računa",
      "Automatska razmjena s kupcima/dobavljačima",
      "Integracija s knjigovodstvenim softverom",
    ],
    todos: [
      { task: "Nabavi FINA certifikat", details: "Ako već nemaš za e-potpis" },
      { task: "Provjeri s knjigovođom", details: "Podržava li njihov softver UBL 2.1?" },
      { task: "Testiraj primanje e-računa", details: "Od dobavljača koji već šalju" },
      { task: "Postavi automatsko knjiženje", details: "FiskAI → izvoz za knjigovođu" },
    ],
    fiskaiHelps: [
      "Prima i šalje e-račune automatski",
      "Izvoz u formatima za sve knjigovođe",
      "AI kategorizacija troškova",
      "Usklađivanje s bankovnim izvodom",
    ],
    urgency: "medium",
  },
  doo: {
    staysTheSame: [
      "Dvojno knjigovodstvo",
      "Porez na dobit (10-18%)",
      "Obvezna revizija (ako primjenjivo)",
      "Godišnji financijski izvještaji",
    ],
    changes: [
      "E-računi OBVEZNI od 01.01.2026",
      "B2B razmjena isključivo elektronski",
      "Strukturirani podaci za automatsko knjiženje",
      "Digitalna arhiva s pravnom valjanošću",
    ],
    todos: [
      { task: "Audit trenutnog sustava", details: "Podržava li e-račune?" },
      { task: "Razgovaraj s IT/računovodstvom", details: "Plan migracije" },
      { task: "Testiraj s ključnim partnerima", details: "Dobavljači i kupci" },
      { task: "Definiraj workflow", details: "Tko odobrava, tko šalje?" },
    ],
    fiskaiHelps: [
      "Enterprise-grade e-računi",
      "Multi-user s pravima pristupa",
      "API integracije s ERP sustavima",
      "Compliance izvještaji i audit trail",
    ],
    urgency: "high",
  },
  freelancer: {
    staysTheSame: [
      "Normativni troškovi (25-50%)",
      "Fleksibilnost u radu",
      "Rad s inozemnim klijentima",
      "Jednostavna administracija",
    ],
    changes: [
      "E-računi za HR klijente od 2026",
      "Inozemni klijenti — bez promjena",
      "Potreban certifikat za domaće B2B",
      "Strukturirani format za domaće račune",
    ],
    todos: [
      { task: "Kategoriziraj klijente", details: "HR vs. inozemstvo" },
      { task: "Za HR klijente: pripremi e-račune", details: "FINA certifikat" },
      { task: "Za strane: nastavi kao do sada", details: "PDF računi OK" },
      { task: "Razmisli o automatizaciji", details: "Ušteda vremena" },
    ],
    fiskaiHelps: [
      "Dual-mode: e-računi HR + PDF inozemstvo",
      "Multi-valutni računi (EUR, USD, GBP)",
      "Automatski tečaj HNB-a",
      "Izvoz za poreznu prijavu",
    ],
    urgency: "low",
  },
  starting: {
    staysTheSame: [
      "Izbor pravne forme je na tebi",
      "Početni troškovi ovise o formi",
      "Knjigovodstvo ovisi o formi",
      "PDV prag ostaje 60.000 EUR",
    ],
    changes: [
      "E-računi obvezni od 01.01.2026",
      "Odaberi softver koji to podržava",
      "Kreni s digitalnim od početka",
      "Izbjegni migraciju kasnije",
    ],
    todos: [
      { task: "Odaberi pravnu formu", details: "Paušal vs. obrt vs. d.o.o." },
      { task: "Kreni digitalno od dana 1", details: "Bez papira, bez fascikla" },
      { task: "Postavi FiskAI", details: "Besplatno za početnike" },
      { task: "Izdaj prvi račun", details: "Za 5 minuta, odmah" },
    ],
    fiskaiHelps: [
      "Vodič za odabir pravne forme",
      "Besplatni start bez kreditne",
      "Raste s tobom — od paušala do d.o.o.",
      "Sve na jednom mjestu od početka",
    ],
    urgency: "low",
  },
}

export function Fiskalizacija2Wizard({ className }: { className?: string }) {
  const [selected, setSelected] = useState<BusinessType>(null)
  const [showResults, setShowResults] = useState(false)

  const handleSelect = (type: BusinessType) => {
    setSelected(type)
  }

  const handleShowResults = () => {
    if (selected) {
      setShowResults(true)
    }
  }

  const handleBack = () => {
    setShowResults(false)
  }

  const handleClose = () => {
    setShowResults(false)
    setSelected(null)
  }

  return (
    <div className={cn("relative", className)}>
      <AnimatePresence mode="wait">
        {!showResults ? (
          <motion.div
            key="selector"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-white/10 bg-surface/5 p-5 backdrop-blur-sm"
          >
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-info-icon" />
              <h3 className="font-semibold text-white">Fiskalizacija 2.0 i ja</h3>
            </div>
            <p className="mb-4 text-sm text-white/70">Što se mijenja za tebe?</p>

            <div className="mb-4 space-y-2">
              {businessOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                      selected === option.id
                        ? "border-focus bg-interactive-secondary text-white"
                        : "border-white/10 bg-surface/5 text-white/80 hover:border-white/20 hover:bg-surface/10"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        selected === option.id ? "bg-interactive" : "bg-surface/10"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{option.label}</p>
                      <p className="text-xs text-white/50 truncate">{option.description}</p>
                    </div>
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full border-2 transition-all",
                        selected === option.id ? "border-focus bg-interactive" : "border-white/30"
                      )}
                    >
                      {selected === option.id && (
                        <CheckCircle2 className="h-full w-full text-white" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleShowResults}
              disabled={!selected}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
                selected
                  ? "bg-interactive text-white hover:bg-interactive-hover"
                  : "bg-surface/10 text-white/40 cursor-not-allowed"
              )}
            >
              Pokaži što se mijenja
              <ArrowRight className="h-4 w-4" />
            </button>

            <p className="mt-3 text-center text-xs text-white/40">⏱️ 2 minute • Bez registracije</p>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-white/10 bg-surface/5 p-5 backdrop-blur-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-white/60 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Natrag
              </button>
              <button onClick={handleClose} className="text-white/60 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {selected && <Fiskalizacija2Results type={selected} result={results[selected]} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Fiskalizacija2Results({
  type,
  result,
}: {
  type: NonNullable<BusinessType>
  result: FiskalizacijaResult
}) {
  const option = businessOptions.find((o) => o.id === type)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-interactive">
          {option && <option.icon className="h-4 w-4 text-white" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{option?.label}</p>
          <p className="text-xs text-white/50">Fiskalizacija 2.0</p>
        </div>
      </div>

      {/* What stays / What changes - compact */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-success-bg p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-success-icon">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ostaje isto
          </p>
          <ul className="space-y-1">
            {result.staysTheSame.slice(0, 3).map((item, i) => (
              <li key={i} className="text-xs text-white/70">
                • {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg bg-warning-bg p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-warning-icon">
            <AlertTriangle className="h-3.5 w-3.5" />
            Mijenja se
          </p>
          <ul className="space-y-1">
            {result.changes.slice(0, 3).map((item, i) => (
              <li key={i} className="text-xs text-white/70">
                • {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* TODO List */}
      <div className="rounded-lg bg-surface/5 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white">
          <Clock className="h-3.5 w-3.5 text-info-icon" />
          Tvoj TODO do 2026:
        </p>
        <ul className="space-y-1.5">
          {result.todos.slice(0, 3).map((todo, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 h-3.5 w-3.5 rounded border border-white/30" />
              <span className="text-white/80">{todo.task}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* FiskAI CTA */}
      <div className="rounded-lg border border-info-border bg-info-bg p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-info-icon">
          <Rocket className="h-3.5 w-3.5" />
          FiskAI ti pomaže:
        </p>
        <ul className="mb-3 space-y-1">
          {result.fiskaiHelps.slice(0, 2).map((item, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-white/70">
              <CheckCircle2 className="h-3 w-3 text-success-icon" />
              {item}
            </li>
          ))}
        </ul>
        <Link
          href="/register"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-interactive px-4 py-2 text-sm font-semibold text-white hover:bg-interactive-hover"
        >
          Kreni besplatno
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

// Full page version for dedicated route
export function Fiskalizacija2FullPage() {
  const [selected, setSelected] = useState<BusinessType>(null)

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
      <div className="mb-10 text-center">
        <h1 className="text-display text-4xl font-bold">Fiskalizacija 2.0 i ja</h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          E-računi postaju obvezni od 1. siječnja 2026. Saznaj što to znači za tebe.
        </p>
      </div>

      <div className="mb-8">
        <p className="mb-4 text-sm font-semibold text-[var(--muted)]">Ja sam...</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {businessOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
                  selected === option.id
                    ? "border-focus bg-info-bg ring-2 ring-focus/20"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-blue-300"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    selected === option.id
                      ? "bg-interactive text-white"
                      : "bg-[var(--surface-secondary)]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{option.label}</p>
                  <p className="text-sm text-[var(--muted)]">{option.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg"
          >
            <Fiskalizacija2FullResults type={selected} result={results[selected]} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Fiskalizacija2FullResults({
  type,
  result,
}: {
  type: NonNullable<BusinessType>
  result: FiskalizacijaResult
}) {
  const option = businessOptions.find((o) => o.id === type)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-interactive">
          {option && <option.icon className="h-6 w-6 text-white" />}
        </div>
        <div>
          <h2 className="text-xl font-bold">Fiskalizacija 2.0 za {option?.label}</h2>
          <p className="text-sm text-[var(--muted)]">Što se mijenja od 01.01.2026.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-success-bg p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-success-text">
            <CheckCircle2 className="h-5 w-5" />
            Što ostaje isto
          </h3>
          <ul className="space-y-2">
            {result.staysTheSame.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-success-text">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-success-bg0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl bg-warning-bg p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-warning-text">
            <AlertTriangle className="h-5 w-5" />
            Što se mijenja
          </h3>
          <ul className="space-y-2">
            {result.changes.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-warning-text">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-warning-bg0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Clock className="h-5 w-5 text-link" />
          Tvoj TODO (do 01.01.2026)
        </h3>
        <ul className="space-y-3">
          {result.todos.map((todo, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 items-center justify-center rounded border border-[var(--border)] bg-surface text-xs font-medium">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{todo.task}</p>
                <p className="text-sm text-[var(--muted)]">{todo.details}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-info-border bg-gradient-to-br from-info-bg to-surface-2 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-info-text">
          <Rocket className="h-5 w-5" />
          Kako FiskAI pomaže
        </h3>
        <ul className="mb-5 grid gap-2 sm:grid-cols-2">
          {result.fiskaiHelps.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-info-text">
              <CheckCircle2 className="h-4 w-4 text-success-text" />
              {item}
            </li>
          ))}
        </ul>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-lg bg-interactive px-6 py-3 font-semibold text-white hover:bg-interactive-hover"
        >
          Započni besplatno s FiskAI
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
