"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { CheckCircle2, Shield, Users, FileText, Zap, Globe } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useAnimatedNumber } from "@/hooks/use-animated-number"
import { cn } from "@/lib/utils"
import { Reveal } from "@/components/motion/Reveal"
import { Stagger, StaggerItem } from "@/components/motion/Stagger"
import { FaqAccordion } from "@/components/marketing/FaqAccordion"

type Billing = "monthly" | "annual"

type Plan = {
  id: string
  badge: string
  badgeClassName: string
  priceMonthly: number
  priceAccent?: "blue" | "purple"
  description: string
  bullets: string[]
  ctaLabel: string
  ctaHref: string
  ctaClassName: string
  footnote: string
  highlighted?: boolean
}

const DISCOUNT = 0.1

function formatEuro(amount: number) {
  return `${amount}€`
}

function annualTotal(monthly: number) {
  return Math.round(monthly * 12 * (1 - DISCOUNT))
}

function annualSavings(monthly: number) {
  return Math.round(monthly * 12 - annualTotal(monthly))
}

function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  const animated = useAnimatedNumber(value, { durationMs: 520 })
  return <span className={className}>{formatEuro(Math.round(animated))}</span>
}

export function MarketingPricingClient() {
  const reduceMotion = useReducedMotion()
  const [billing, setBilling] = useState<Billing>("monthly")

  const plans: Plan[] = useMemo(
    () => [
      {
        id: "pausalni",
        badge: "Paušalni obrt",
        badgeClassName: "bg-blue-100 text-blue-800",
        priceMonthly: 39,
        priceAccent: "blue",
        description: "Savršeno za paušalni obrt do 50 računa mjesečno",
        bullets: [
          "Do 50 računa mjesečno",
          "Neograničeno troškova (OCR uključen)",
          "Izvoz za knjigovođu (CSV/Excel/PDF)",
          "1 korisnik (vlasnik)",
          "Email podrška unutar 24h",
        ],
        ctaLabel: "Započni besplatnu probu",
        ctaHref: "/register",
        ctaClassName: "bg-blue-600 hover:bg-blue-700",
        footnote: "Nema kreditne kartice • Možete otkazati bilo kada",
      },
      {
        id: "doo-standard",
        badge: "D.O.O. Standard",
        badgeClassName: "bg-blue-600 text-white",
        priceMonthly: 99,
        priceAccent: "blue",
        description: "Za d.o.o. i VAT obrt do 200 računa mjesečno",
        bullets: [
          "Do 200 računa mjesečno",
          "PDV obrada i JOPPD priprema",
          "E-računi (send/receive)",
          "Do 3 korisnika",
          "Glavna knjiga i financijski izvještaji",
          "Telefonska podrška unutar 4h",
        ],
        ctaLabel: "Započni besplatnu 30-dnevnu probu",
        ctaHref: "/register",
        ctaClassName: "bg-blue-600 hover:bg-blue-700",
        footnote: "Besplatna migracija podataka za d.o.o.",
        highlighted: true,
      },
      {
        id: "enterprise",
        badge: "Enterprise",
        badgeClassName: "bg-purple-100 text-purple-800",
        priceMonthly: 199,
        priceAccent: "purple",
        description: "Za veće d.o.o. i grupe tvrtki",
        bullets: [
          "Neograničeno računa",
          "Više tvrtki u grupi",
          "Do 10 korisnika",
          "Napredno knjigovodstvo",
          "Dedicated account manager",
          "SLA 99.9% dostupnosti",
        ],
        ctaLabel: "Kontaktirajte prodaju",
        ctaHref: "/contact",
        ctaClassName: "bg-purple-600 hover:bg-purple-700",
        footnote: "Timska obuka i prilagođena implementacija",
      },
    ],
    []
  )

  const toggleId = "billing-toggle"

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <Reveal>
        <Stagger className="mb-10 text-center">
          <StaggerItem>
            <h1 className="text-display text-4xl font-semibold md:text-5xl">
              Transparentne cijene za svaku vrstu poslovanja
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted)]">
              Od paušalnog obrta do d.o.o. tvrtki — cijene koje rastu s vama. Bez skrivenih
              troškova, bez ugovorne obveze.
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800">
              <Shield className="h-4 w-4" />
              14-dnevna besplatna proba za sve pakete
            </div>
          </StaggerItem>
        </Stagger>
      </Reveal>

      <Reveal>
        <div className="mx-auto mb-10 flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
          <p className="text-sm font-semibold">Odaberite način naplate</p>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "text-sm font-medium",
                billing === "monthly" ? "" : "text-[var(--muted)]"
              )}
            >
              Mjesečno
            </span>
            <button
              id={toggleId}
              type="button"
              role="switch"
              aria-checked={billing === "annual"}
              onClick={() => setBilling((prev) => (prev === "monthly" ? "annual" : "monthly"))}
              className={cn(
                "relative h-9 w-16 rounded-full border transition-colors",
                billing === "annual"
                  ? "border-blue-600 bg-blue-600"
                  : "border-[var(--border)] bg-[var(--surface-secondary)]"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-transform",
                  billing === "annual" ? "translate-x-8" : "translate-x-1"
                )}
              />
              <span className="sr-only">Prebaci na godišnje</span>
            </button>
            <span
              className={cn(
                "text-sm font-medium",
                billing === "annual" ? "" : "text-[var(--muted)]"
              )}
            >
              Godišnje
            </span>
            <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
              Uštedi 10%
            </span>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Godišnje prikazuje efektivnu mjesečnu cijenu, naplaćuje se jednom godišnje.
          </p>
        </div>
      </Reveal>

      <Reveal>
        <div className="mb-16 grid gap-8 md:grid-cols-3">
          {plans.map((plan) => {
            const isAnnual = billing === "annual"
            const effectiveMonthly = isAnnual
              ? Math.round(annualTotal(plan.priceMonthly) / 12)
              : plan.priceMonthly
            const billedAnnually = annualTotal(plan.priceMonthly)
            const savings = annualSavings(plan.priceMonthly)

            const cardBase =
              "rounded-2xl border bg-white p-8 transition-shadow will-change-transform"
            const hover = "hover:shadow-lg"

            return (
              <motion.div
                key={plan.id}
                whileHover={reduceMotion ? undefined : { scale: 1.015, y: -2 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className={cn(
                  cardBase,
                  hover,
                  plan.highlighted &&
                    "relative border-2 border-blue-300 bg-gradient-to-b from-blue-50 to-white shadow-lg"
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1 text-sm font-semibold text-white">
                      Najpopularnije
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <div className="mb-4">
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold",
                        plan.badgeClassName
                      )}
                    >
                      {plan.badge}
                    </div>
                  </div>

                  <div className="mb-3 flex items-baseline">
                    <AnimatedPrice value={effectiveMonthly} className="text-4xl font-bold" />
                    <span className="ml-2 text-[var(--muted)]">/ mjesečno</span>
                  </div>

                  {billing === "annual" && (
                    <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                      Naplata: {formatEuro(billedAnnually)} godišnje • Ušteda {formatEuro(savings)}
                    </div>
                  )}

                  <p className="text-sm text-[var(--muted)]">{plan.description}</p>
                </div>

                <ul className="mb-8 space-y-3">
                  {plan.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaHref}
                  className={cn(
                    "block w-full rounded-md px-6 py-3 text-center text-sm font-semibold text-white transition-colors",
                    plan.ctaClassName
                  )}
                >
                  {plan.ctaLabel}
                </Link>
                <p className="mt-3 text-center text-xs text-[var(--muted)]">{plan.footnote}</p>
              </motion.div>
            )
          })}
        </div>
      </Reveal>

      <Reveal>
        <div className="mb-16 rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-8 text-center">
          <div className="mx-auto max-w-2xl">
            <div className="mb-6">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                <Users className="h-4 w-4" />
                Besplatno za knjigovođe
              </div>
              <h2 className="mb-2 text-2xl font-semibold">
                Pridružite se knjigovođama koji koriste FiskAI
              </h2>
              <p className="text-sm text-[var(--muted)]">
                Registrirani knjigovođe dobivaju besplatni pristup za suradnju s klijentima.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <p className="font-medium">Uredni izvozi</p>
                <p className="text-xs text-[var(--muted)]">CSV/Excel s PDF prilozima</p>
              </div>
              <div className="space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <p className="font-medium">Pristup klijentima</p>
                <p className="text-xs text-[var(--muted)]">Direktna komunikacija</p>
              </div>
              <div className="space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <p className="font-medium">70% manje rada</p>
                <p className="text-xs text-[var(--muted)]">Manje ručnog unosa</p>
              </div>
            </div>

            <div className="mt-8">
              <Link
                href="/for/accountants"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Registrirajte se kao knjigovođa
              </Link>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Potrebna verifikacija OIB-a i certifikata
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="mb-16 rounded-2xl border border-[var(--border)] bg-white p-8">
          <h2 className="mb-6 text-center text-2xl font-semibold">Dodaci (opcionalno)</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] p-6">
              <div className="mb-4">
                <div className="text-2xl font-bold">1€</div>
                <p className="text-sm text-[var(--muted)]">po dodatnom računu</p>
              </div>
              <p className="text-sm font-medium">Dodatni računi</p>
              <p className="text-xs text-[var(--muted)]">Za paušalni plan iznad 50 računa</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-6">
              <div className="mb-4">
                <div className="text-2xl font-bold">15€</div>
                <p className="text-sm text-[var(--muted)]">po korisniku mjesečno</p>
              </div>
              <p className="text-sm font-medium">Dodatni korisnici</p>
              <p className="text-xs text-[var(--muted)]">Za sve planove</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-6">
              <div className="mb-4">
                <div className="text-2xl font-bold">30€</div>
                <p className="text-sm text-[var(--muted)]">mjesečno</p>
              </div>
              <p className="text-sm font-medium">Napredni AI OCR</p>
              <p className="text-xs text-[var(--muted)]">Veća točnost za kompleksne račune</p>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="mb-12 rounded-2xl border border-[var(--border)] bg-white p-8">
          <h2 className="mb-6 text-2xl font-semibold">Često postavljana pitanja</h2>
          <FaqAccordion
            items={[
              {
                question: "Kako funkcionira besplatna proba?",
                answer:
                  "Besplatna proba traje 14 dana za paušalni plan i 30 dana za d.o.o. plan. Ne trebate kreditnu karticu. Nakon probnog razdoblja možete nastaviti ili otkazati bez penala.",
              },
              {
                question: "Što ako premašim limit računa?",
                answer:
                  "Dobit ćete obavijest i opcije nadogradnje. Paušalni plan može imati dodatak po računu iznad 50 (do dogovorenog maksimuma), a d.o.o. plan po računu iznad 200.",
              },
              {
                question: "Kako funkcionira otkazivanje?",
                answer:
                  "Možete otkazati bilo kada. Pristup ostaje aktivan do kraja plaćenog razdoblja, a prije/poslije možete izvesti sve podatke (CSV/Excel/JSON).",
              },
              {
                question: "Postoji li dugoročna obveza?",
                answer:
                  "Ne. Svi planovi su mjesečni bez ugovorne obveze. Ako želite, nudimo popust za godišnje plaćanje.",
              },
              {
                question: "Koje su opcije plaćanja?",
                answer:
                  "Kartice (Visa/Mastercard/Maestro) i bankovni transfer za hrvatske tvrtke. Za d.o.o. tvrtke izdajemo račune s PDV-om.",
              },
            ]}
          />
        </div>
      </Reveal>

      <Reveal>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <p className="font-semibold">Bez rizika</p>
              <p className="text-xs text-[var(--muted)]">14-30 dana besplatne probe</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white">
                <Globe className="h-6 w-6 text-blue-600" />
              </div>
              <p className="font-semibold">Podaci u EU</p>
              <p className="text-xs text-[var(--muted)]">GDPR usklađeno, podaci u Njemačkoj</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <p className="font-semibold">Podrška na hrvatskom</p>
              <p className="text-xs text-[var(--muted)]">Telefon i email unutar 24h</p>
            </div>
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm">
              Imate pitanja o cijenama?{" "}
              <Link href="/contact" className="font-semibold text-blue-700 hover:underline">
                Kontaktirajte nas
              </Link>{" "}
              ili pozovite na{" "}
              <a href="tel:+38512345678" className="font-semibold text-blue-700 hover:underline">
                +385 1 234 5678
              </a>
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
