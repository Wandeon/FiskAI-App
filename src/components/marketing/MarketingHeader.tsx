"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, Grid3X3, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { PortalNavigation } from "./PortalNavigation"
import { CommandPalette } from "@/components/ui/command-palette"
import { Logo } from "@/components/ui/Logo"

const NAV_LINKS = [
  { href: "/znacajke", label: "Značajke" },
  { href: "/cijene", label: "Cijene" },
  { href: "/vodici", label: "Vodiči" },
  { href: "/o-nama", label: "O nama" },
  { href: "/kontakt", label: "Kontakt" },
]

interface MarketingHeaderProps {
  isLoggedIn?: boolean
}

export function MarketingHeader({ isLoggedIn = false }: MarketingHeaderProps) {
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll() // Check initial state

    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Note: ⌘K is handled by CommandPalette component

  return (
    <>
      {/* @design-override: Marketing header always uses dark colors for cockpit aesthetic */}
      <motion.header
        className={cn(
          "fixed left-0 right-0 top-0 z-30 transition-all duration-300",
          isScrolled
            ? "border-b border-white/10 bg-slate-950/85 shadow-lg shadow-black/20 backdrop-blur-xl backdrop-saturate-150"
            : "border-b border-white/5 bg-transparent"
        )}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/">
              <Logo size="sm" variant="white" />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 md:flex" aria-label="Glavna navigacija">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "relative px-4 py-2 text-sm font-medium transition-all",
                      isActive
                        ? "text-white text-glow-cyan"
                        : "text-white/70 hover:text-white hover:text-glow-cyan",
                      "group"
                    )}
                  >
                    <span className="relative z-10">{link.label}</span>

                    {/* Glow effect on hover */}
                    <span
                      className={cn(
                        "absolute inset-0 -z-10 rounded-lg opacity-0 transition-opacity",
                        "bg-gradient-to-b from-white/5 to-transparent",
                        "group-hover:opacity-100"
                      )}
                    />

                    {/* Animated underline - @design-override: dark header cyan colors */}
                    <motion.span
                      className="absolute bottom-1 left-4 right-4 h-px bg-gradient-to-r from-cyan-400 to-blue-400"
                      initial={false}
                      animate={{
                        scaleX: isActive ? 1 : 0,
                        opacity: isActive ? 1 : 0,
                      }}
                      whileHover={{ scaleX: 1, opacity: 0.7 }}
                      transition={{ duration: 0.2 }}
                      style={{ originX: 0 }}
                    />
                  </Link>
                )
              })}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Search - CommandPalette */}
              <CommandPalette />

              {/* Istraži button - Desktop - @design-override: Dark header button uses hardcoded values */}
              <motion.button
                onClick={() => setPortalOpen(true)}
                className="group relative hidden items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition-all hover:border-transparent hover:bg-white/10 md:inline-flex"
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(34, 211, 238, 0)",
                    "0 0 20px 2px rgba(34, 211, 238, 0.15)",
                    "0 0 0 0 rgba(34, 211, 238, 0)",
                  ],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {/* Rotating gradient border */}
                <span className="absolute -inset-px -z-10 overflow-hidden rounded-lg">
                  <motion.span
                    className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(34,211,238,0.8)_360deg)]"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <span className="absolute inset-px rounded-[7px] bg-slate-950/90" />
                </span>

                {/* Glow on hover - @design-override */}
                <span className="absolute -inset-1 -z-20 rounded-xl bg-gradient-to-r from-cyan-500/40 via-blue-500/40 to-indigo-500/40 opacity-0 blur-md transition-opacity group-hover:opacity-100" />

                <Grid3X3 className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                <span>Istraži</span>
              </motion.button>

              {/* Mobile menu button - @design-override: dark header */}
              <button
                onClick={() => setPortalOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white/90 transition-colors hover:bg-white/10 md:hidden"
                aria-label="Otvori navigaciju"
              >
                <Grid3X3 className="h-5 w-5" />
              </button>

              {/* Primary CTA - changes based on login state */}
              {/* @design-override: Header CTAs use vibrant colors for visibility */}
              {isLoggedIn ? (
                <a
                  href="https://app.fiskai.hr/dashboard"
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30"
                >
                  <span className="hidden sm:inline">Otvori aplikaciju</span>
                  <span className="sm:hidden">Aplikacija</span>
                  <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />

                  {/* Shimmer effect */}
                  <motion.span
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ["0%", "200%"] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 3,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Glow on hover */}
                  <span className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 opacity-0 blur-md transition-opacity group-hover:opacity-50" />
                </a>
              ) : (
                <Link
                  href="/register"
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-500/30"
                >
                  <span className="hidden sm:inline">Započni</span>
                  <span className="sm:hidden">Start</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />

                  {/* Shimmer effect */}
                  <motion.span
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ["0%", "200%"] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 3,
                      ease: "easeInOut",
                    }}
                  />

                  {/* Glow on hover */}
                  <span className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 blur-md transition-opacity group-hover:opacity-50" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Subtle bottom glow when scrolled */}
        <AnimatePresence>
          {isScrolled && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
      </motion.header>

      {/* Portal navigation */}
      <PortalNavigation isOpen={portalOpen} onClose={() => setPortalOpen(false)} />
    </>
  )
}
