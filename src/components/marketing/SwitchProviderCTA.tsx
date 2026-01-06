"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, X, Heart, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface SwitchProviderCTAProps {
  className?: string
  showAfterScroll?: number // pixels to scroll before showing
}

export function SwitchProviderCTA({ className, showAfterScroll = 600 }: SwitchProviderCTAProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Check if already dismissed in this session
    const dismissed = sessionStorage.getItem("switch-cta-dismissed")
    if (dismissed) {
      setIsDismissed(true)
      return
    }

    const handleScroll = () => {
      if (window.scrollY > showAfterScroll) {
        setIsVisible(true)
      }
    }

    window.addEventListener("scroll", handleScroll)
    // Check initial scroll position
    handleScroll()

    return () => window.removeEventListener("scroll", handleScroll)
  }, [showAfterScroll])

  const handleDismiss = () => {
    setIsDismissed(true)
    sessionStorage.setItem("switch-cta-dismissed", "true")
  }

  if (isDismissed) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn("fixed bottom-6 left-1/2 z-50 -translate-x-1/2", className)}
        >
          <div className="relative">
            {/* Gentle pulse glow */}
            <motion.div
              className="absolute inset-0 rounded-full bg-interactive/20 blur-xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Main CTA pill */}
            <div className="relative flex items-center gap-2 rounded-full border border-white/20 bg-surface-dark px-4 py-2.5 shadow-2xl backdrop-blur-sm">
              {/* Empathetic icon */}
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <Heart className="h-4 w-4 text-danger-text" />
              </motion.div>

              {/* Message */}
              <span className="text-sm text-white/90">Umoran od svog trenutnog softvera?</span>

              {/* CTA Link */}
              <Link
                href="/prelazak"
                className="group ml-1 flex items-center gap-1 rounded-full bg-interactive px-3 py-1 text-sm font-medium text-white transition-all hover:bg-interactive-hover"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Prijeđi lako</span>
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>

              {/* Dismiss button */}
              <button
                onClick={handleDismiss}
                className="ml-1 rounded-full p-1 text-white/40 transition-colors hover:bg-surface/10 hover:text-white/70"
                aria-label="Zatvori"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Alternative: Inline banner version for specific pages
export function SwitchProviderBanner({ className }: { className?: string }) {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-danger-border bg-gradient-to-r from-danger-bg to-warning-bg",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-bg">
            <Heart className="h-5 w-5 text-danger-icon" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              Razumijemo — promjena softvera djeluje zastrašujuće.
            </p>
            <p className="text-sm text-secondary">
              Ali što ako vam kažemo da prijenos traje samo 5 minuta?
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/prelazak"
            className="inline-flex items-center gap-2 rounded-lg bg-surface-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-surface-darker"
          >
            <RefreshCw className="h-4 w-4" />
            Saznaj kako
          </Link>
          <button
            onClick={() => setIsDismissed(true)}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-1 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
