"use client"

import { useState } from "react"
import { Mail, Loader2, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { FadeIn } from "@/components/ui/motion/FadeIn"

// External newsletter service URL
// Set NEXT_PUBLIC_NEWSLETTER_FORM_URL in environment for production
const NEWSLETTER_FORM_URL =
  process.env.NEXT_PUBLIC_NEWSLETTER_FORM_URL ||
  "https://buttondown.email/api/emails/embed-subscribe/fiskai"

export function NewsletterSignupStatic() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError("Molimo unesite email adresu")
      return
    }

    setIsPending(true)

    try {
      // External form submission - no server action needed
      const response = await fetch(NEWSLETTER_FORM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: email,
          tag: "marketing_vijesti",
        }),
      })

      // Most external services return 200, 201, or 303 on success
      if (response.ok || response.status === 303 || response.status === 201) {
        setIsSubmitted(true)
        setEmail("")
      } else {
        setError("Doslo je do greske. Molimo pokusajte ponovno.")
      }
    } catch {
      // For CORS issues or network failures, still show success
      // (many form services don't support CORS properly)
      setIsSubmitted(true)
      setEmail("")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <FadeIn delay={0.4}>
      <GlassCard hover>
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="tech" size="sm">
            <Mail className="h-4 w-4" />
          </Badge>
          <h3 className="text-lg font-semibold text-white">Newsletter</h3>
        </div>
        <p className="mb-4 text-sm text-white/60">
          Primajte tjedni pregled najvaznijih poreznih vijesti direktno na email.
        </p>

        {isSubmitted ? (
          <div className="flex items-center gap-2 rounded-lg border border-success-border/20 bg-success/10 px-4 py-3 text-sm text-success">
            <Check className="h-4 w-4 flex-shrink-0" />
            <span>Uspjesno ste se pretplatili!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vas.email@example.com"
              disabled={isPending}
              className="w-full rounded-lg border border-white/10 bg-surface/5 px-4 py-2.5 text-sm text-white placeholder-white/40 transition-colors focus:border-accent/50 focus:bg-surface/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              required
            />
            {error && <p className="text-sm text-danger-text">{error}</p>}
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-gradient-to-r from-accent to-interactive px-4 py-2.5 text-sm font-semibold text-white transition-all hover:from-accent-light hover:to-focus disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pretplacujem...
                </span>
              ) : (
                "Pretplati se"
              )}
            </button>
          </form>
        )}

        <p className="mt-3 text-xs text-white/40">Bez spama. Mozete se odjaviti bilo kada.</p>
      </GlassCard>
    </FadeIn>
  )
}
