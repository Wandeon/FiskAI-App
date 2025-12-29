"use client"

import { useState, useTransition } from "react"
import { Mail, Loader2, Check } from "lucide-react"
import { subscribeToNewsletter } from "@/app/actions/newsletter"
import { toast } from "@/lib/toast"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { FadeIn } from "@/components/ui/motion/FadeIn"

export function NewsletterSignup() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error("Molimo unesite email adresu")
      return
    }

    startTransition(async () => {
      const result = await subscribeToNewsletter(email, "vijesti_sidebar")

      if (result.success) {
        setIsSubmitted(true)
        setEmail("")
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    })
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
          Primajte tjedni pregled najvažnijih poreznih vijesti direktno na email.
        </p>

        {isSubmitted ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-success/10 px-4 py-3 text-sm text-green-300">
            <Check className="h-4 w-4 flex-shrink-0" />
            <span>Uspješno ste se pretplatili!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vas.email@example.com"
                disabled={isPending}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/40 transition-colors focus:border-cyan-500/50 focus:bg-white/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:from-cyan-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pretplaćujem...
                </span>
              ) : (
                "Pretplati se"
              )}
            </button>
          </form>
        )}

        <p className="mt-3 text-xs text-white/40">
          Bez spama. Možete se odjaviti bilo kada.
        </p>
      </GlassCard>
    </FadeIn>
  )
}
