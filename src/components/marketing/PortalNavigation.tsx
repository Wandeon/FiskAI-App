"use client"

import { useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Calendar,
  ChevronDown,
  FileText,
  Newspaper,
  Search,
  Shield,
  Sparkles,
  Wrench,
  X,
  Scale,
  Building2,
  Receipt,
  Briefcase,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AuroraBackground } from "./AuroraBackground"
import { PortalCard, PortalLink } from "./PortalCard"

interface PortalNavigationProps {
  isOpen: boolean
  onClose: () => void
}

// Navigation data
const PROIZVOD = [
  {
    href: "/features",
    title: "Mogućnosti",
    description: "Računi, OCR, banke, izvještaji",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    href: "/security",
    title: "Sigurnost",
    description: "GDPR, passkeys, audit trag",
    icon: <Shield className="h-5 w-5" />,
  },
  {
    href: "/status",
    title: "Status sustava",
    description: "Dostupnost i incidenti",
    icon: <Shield className="h-5 w-5" />,
  },
  {
    href: "/prelazak",
    title: "Prijeđi na FiskAI",
    description: "Migracija bez stresa",
    icon: <ArrowRight className="h-5 w-5" />,
  },
]

const ALATI = [
  {
    href: "/alati",
    title: "Svi alati",
    description: "Kalkulatori i pomoćni alati",
    icon: <Wrench className="h-5 w-5" />,
    featured: true,
  },
  {
    href: "/alati/pdv-kalkulator",
    title: "PDV prag",
    description: "Koliko ste blizu 60.000€",
    icon: <Calculator className="h-5 w-5" />,
  },
  {
    href: "/alati/posd-kalkulator",
    title: "PO-SD kalkulator",
    description: "Doprinosi i porezi (paušal)",
    icon: <Calculator className="h-5 w-5" />,
  },
  {
    href: "/alati/uplatnice",
    title: "Generator uplatnica",
    description: "HUB3 barkod za plaćanja",
    icon: <Receipt className="h-5 w-5" />,
  },
  {
    href: "/alati/kalendar",
    title: "Kalendar rokova",
    description: "Rokovi i podsjetnici",
    icon: <Calendar className="h-5 w-5" />,
  },
  {
    href: "/alati/oib-validator",
    title: "OIB validator",
    description: "Provjera OIB-a",
    icon: <Shield className="h-5 w-5" />,
  },
]

const VODICI = [
  { href: "/vodic", title: "Svi vodiči", featured: true },
  { href: "/vodic/pausalni-obrt", title: "Paušalni obrt" },
  { href: "/vodic/obrt-dohodak", title: "Obrt na dohodak" },
  { href: "/vodic/doo", title: "D.O.O. / J.D.O.O." },
  { href: "/vodic/freelancer", title: "Freelancer" },
  { href: "/vodic/posebni-oblici", title: "Posebni oblici" },
]

const USPOREDBE = [
  { href: "/usporedba", title: "Sve usporedbe", featured: true },
  {
    href: "/usporedba/pocinjem-solo",
    title: "Počinjem solo",
    icon: <Briefcase className="h-4 w-4" />,
  },
  {
    href: "/usporedba/dodatni-prihod",
    title: "Dodatni prihod",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  { href: "/usporedba/firma", title: "Osnivam firmu", icon: <Building2 className="h-4 w-4" /> },
  { href: "/usporedba/preko-praga", title: "Preko 60k praga", icon: <Scale className="h-4 w-4" /> },
]

const BRZI_PRISTUP = [
  { href: "/znacajke", title: "Značajke", icon: <Sparkles className="h-4 w-4" /> },
  { href: "/cijene", title: "Cijene", icon: <Calculator className="h-4 w-4" /> },
  { href: "/vodici", title: "Vodiči", icon: <BookOpen className="h-4 w-4" /> },
  { href: "/o-nama", title: "O nama", icon: <Building2 className="h-4 w-4" /> },
  { href: "/kontakt", title: "Kontakt", icon: <FileText className="h-4 w-4" /> },
  { href: "/vijesti", title: "Vijesti", icon: <Newspaper className="h-4 w-4" /> },
  { href: "/fiskalizacija", title: "Fiskalizacija 2.0", badge: "Novo" },
]

const RESURSI = [
  { href: "/baza-znanja", title: "Baza znanja", featured: true },
  { href: "/kako-da", title: "Kako da..." },
  { href: "/rjecnik", title: "Rječnik" },
  { href: "/izvori", title: "Službeni izvori" },
  { href: "/metodologija", title: "Metodologija" },
  { href: "/urednicka-politika", title: "Urednička politika" },
]

export function PortalNavigation({ isOpen, onClose }: PortalNavigationProps) {
  // Open CommandPalette and close this portal
  const openSearch = () => {
    onClose()
    // Dispatch ⌘K event to open CommandPalette
    setTimeout(() => {
      const event = new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      })
      window.dispatchEvent(event)
    }, 100) // Small delay to let portal close first
  }

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }
    return undefined
  }, [isOpen, onClose])

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
    return undefined
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Portal overlay */}
          <motion.div
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-base/95"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
          >
            {/* Aurora background */}
            <AuroraBackground intensity="subtle" />

            {/* Content */}
            <div className="relative z-10 flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-surface/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                  Zatvori
                </button>
                {/* Search - opens CommandPalette */}
                <button
                  onClick={openSearch}
                  className="relative hidden items-center gap-2 rounded-lg border border-white/10 bg-surface/5 px-4 py-2 text-sm text-white/60 transition-colors hover:border-accent-light/30 hover:bg-surface/10 hover:text-white md:flex"
                >
                  <Search className="h-4 w-4" />
                  <span>Pretraži...</span>
                  <span className="ml-2 rounded bg-surface/10 px-1.5 py-0.5 text-xs text-white/50">
                    ⌘K
                  </span>
                </button>
                <div className="w-20" /> {/* Spacer for balance */}
              </div>

              {/* Navigation content */}
              <div className="flex-1 overflow-y-auto">
                {/* Desktop layout */}
                <div className="mx-auto hidden max-w-6xl px-6 py-8 md:block">
                  <div className="grid grid-cols-4 gap-8">
                    {/* Column 1: Proizvod */}
                    <div>
                      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-accent-light">
                        Proizvod
                      </h3>
                      <div className="space-y-2">
                        {PROIZVOD.map((item, i) => (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            <PortalCard
                              href={item.href}
                              icon={item.icon}
                              title={item.title}
                              description={item.description}
                              onClick={onClose}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Column 2: Alati */}
                    <div>
                      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-accent-light">
                        Alati
                      </h3>
                      <div className="space-y-2">
                        {ALATI.map((item, i) => (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.05 }}
                          >
                            <PortalCard
                              href={item.href}
                              icon={item.icon}
                              title={item.title}
                              description={item.description}
                              featured={item.featured}
                              onClick={onClose}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Column 3: Baza znanja */}
                    <div>
                      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-accent-light">
                        Baza znanja
                      </h3>

                      {/* Vodiči */}
                      <div className="mb-6">
                        <div className="mb-2 flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-white/50" />
                          <span className="text-sm font-medium text-white/70">Vodiči</span>
                        </div>
                        <div className="space-y-0.5">
                          {VODICI.map((item, i) => (
                            <motion.div
                              key={item.href}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.2 + i * 0.03 }}
                            >
                              <PortalLink
                                href={item.href}
                                onClick={onClose}
                                className={item.featured ? "font-semibold text-white" : ""}
                              >
                                {item.title}
                              </PortalLink>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Usporedbe */}
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <Scale className="h-4 w-4 text-white/50" />
                          <span className="text-sm font-medium text-white/70">Usporedbe</span>
                        </div>
                        <div className="space-y-0.5">
                          {USPOREDBE.map((item, i) => (
                            <motion.div
                              key={item.href}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 + i * 0.03 }}
                            >
                              <PortalLink
                                href={item.href}
                                onClick={onClose}
                                className={item.featured ? "font-semibold text-white" : ""}
                              >
                                {item.title}
                              </PortalLink>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Column 4: Brzi pristup + Resursi */}
                    <div>
                      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-accent-light">
                        Brzi pristup
                      </h3>
                      <div className="mb-6 space-y-1">
                        {BRZI_PRISTUP.map((item, i) => (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 + i * 0.03 }}
                          >
                            <Link
                              href={item.href}
                              onClick={onClose}
                              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-white/80 transition-all hover:bg-surface/5 hover:text-white"
                            >
                              {item.icon && <span className="text-white/50">{item.icon}</span>}
                              <span className="flex-1 font-medium">{item.title}</span>
                              {item.badge && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg0/20 px-2 py-0.5 text-[10px] font-semibold text-danger-text">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          </motion.div>
                        ))}
                      </div>

                      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-accent-light">
                        Resursi
                      </h3>
                      <div className="space-y-0.5">
                        {RESURSI.map((item, i) => (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.35 + i * 0.03 }}
                          >
                            <PortalLink
                              href={item.href}
                              onClick={onClose}
                              className={item.featured ? "font-semibold text-white" : ""}
                            >
                              {item.title}
                            </PortalLink>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile layout */}
                <div className="px-4 py-6 md:hidden">
                  {/* Mobile search - opens CommandPalette */}
                  <button
                    onClick={openSearch}
                    className="mb-6 flex w-full items-center gap-3 rounded-lg border border-white/10 bg-surface/5 px-4 py-3 text-sm text-white/60 transition-colors hover:border-accent-light/30 hover:bg-surface/10"
                  >
                    <Search className="h-4 w-4" />
                    <span className="flex-1 text-left">Pretraži...</span>
                  </button>

                  {/* Mobile accordions */}
                  <div className="space-y-3">
                    <MobileSection title="Proizvod" items={PROIZVOD} onNavigate={onClose} />
                    <MobileSection title="Alati" items={ALATI} onNavigate={onClose} defaultOpen />
                    <MobileSection
                      title="Vodiči"
                      items={VODICI.map((v) => ({ ...v, description: undefined }))}
                      onNavigate={onClose}
                    />
                    <MobileSection
                      title="Usporedbe"
                      items={USPOREDBE.map((u) => ({ ...u, description: undefined }))}
                      onNavigate={onClose}
                    />
                    <MobileSection
                      title="Resursi"
                      items={RESURSI.map((r) => ({ ...r, description: undefined }))}
                      onNavigate={onClose}
                    />

                    {/* Quick links */}
                    <div className="border-t border-white/10 pt-4">
                      {BRZI_PRISTUP.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className="flex items-center gap-3 rounded-lg px-4 py-3 text-white/80 transition-colors hover:bg-surface/5"
                        >
                          {item.icon}
                          <span className="flex-1 font-medium">{item.title}</span>
                          {item.badge && (
                            <span className="rounded-full bg-danger-bg0/20 px-2 py-0.5 text-[10px] font-semibold text-danger-text">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-white/10 px-6 py-4">
                <div className="mx-auto flex max-w-6xl items-center justify-between">
                  <Link
                    href="/login"
                    onClick={onClose}
                    className="text-sm font-medium text-white/70 transition-colors hover:text-white"
                  >
                    Prijava
                  </Link>

                  <Link
                    href="/register"
                    onClick={onClose}
                    className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-accent to-interactive px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:shadow-xl hover:shadow-accent/30"
                  >
                    Započni besplatno
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Mobile accordion section
function MobileSection({
  title,
  items,
  onNavigate,
  defaultOpen = false,
}: {
  title: string
  items: Array<{
    href: string
    title: string
    description?: string
    icon?: React.ReactNode
    featured?: boolean
  }>
  onNavigate: () => void
  defaultOpen?: boolean
}) {
  return (
    <details className="group rounded-xl border border-white/10 bg-surface/5" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-white">{title}</span>
        <ChevronDown className="h-4 w-4 text-white/50 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/10 px-2 py-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-surface/5",
              item.featured ? "font-semibold text-white" : "text-white/70"
            )}
          >
            {item.icon && <span className="text-white/50">{item.icon}</span>}
            <span className="flex-1">{item.title}</span>
            {item.description && <span className="text-xs text-white/40">{item.description}</span>}
          </Link>
        ))}
      </div>
    </details>
  )
}
