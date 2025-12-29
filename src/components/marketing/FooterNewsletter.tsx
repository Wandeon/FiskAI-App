"use client"

import { useState, useTransition } from "react"
import { Mail, Loader2, Check } from "lucide-react"
import { subscribeToNewsletter } from "@/app/actions/newsletter"
import { toast } from "@/lib/toast"

export function FooterNewsletter() {
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
      const result = await subscribeToNewsletter(email, "marketing_footer")

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
    <div className="space-y-3">
      <p className="text-sm font-semibold text-white">Newsletter</p>
      <p className="text-sm text-white/60">
        Primajte tjedni pregled najvažnijih poreznih vijesti direktno na email.
      </p>

      {isSubmitted ? (
        <div className="flex items-center gap-2 rounded-lg border border-success-border bg-success-bg px-4 py-3 text-sm text-success-text">
          <Check className="h-4 w-4 flex-shrink-0" />
          <span>Uspješno ste se pretplatili!</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vas.email@example.com"
              disabled={isPending}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/40 transition-colors focus:border-focus focus:bg-white/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-interactive px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-interactive-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Pretplaćujem...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Mail className="h-4 w-4" />
                Pretplati se
              </span>
            )}
          </button>
        </form>
      )}

      <p className="text-xs text-white/40">Bez spama. Možete se odjaviti bilo kada.</p>
    </div>
  )
}
