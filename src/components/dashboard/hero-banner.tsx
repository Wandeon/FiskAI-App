import Link from "next/link"
import { cn } from "@/lib/utils"
import { Sparkles, ShieldCheck, Clock, ArrowRight, Users } from "lucide-react"

interface HeroBannerProps {
  userName: string
  companyName: string
  legalForm: string | null
  draftInvoices: number
  providerConfigured: boolean
  contactCount: number
  className?: string
}

const buttonBaseStyles =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 h-10 px-4 py-2"

export function HeroBanner({
  userName,
  companyName,
  legalForm,
  draftInvoices,
  providerConfigured,
  contactCount,
  className,
}: HeroBannerProps) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-3xl surface-gradient shadow-glow", className)}
    >
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_60%)]" />
      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-white/80">
            <Sparkles className="icon-sm" />
            FiskAI asistent
          </div>
          <h2 className="text-display text-3xl font-semibold">Dobrodošli natrag, {userName}!</h2>
          <p className="text-sm text-white/80">
            {companyName} • {contactCount} kontakata •{" "}
            {providerConfigured ? "Posrednik spojen" : "Konfigurirajte posrednika"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/e-invoices/new"
            className="surface-glass rounded-2xl border-white/20 p-4 transition hover:bg-white/20 text-foreground"
          >
            <p className="text-xs uppercase tracking-wide text-secondary">Sljedeći korak</p>
            <p className="text-lg font-semibold text-foreground">Kreirajte e-račun</p>
            <p className="mt-1 text-sm text-foreground flex items-center gap-1">
              <ArrowRight className="icon-md" /> brzo iz nacrta
            </p>
          </Link>
          <div className="surface-glass rounded-2xl border-white/20 p-4 text-foreground">
            <p className="text-xs uppercase tracking-wide text-secondary">Nacrti</p>
            <div className="mt-1 flex items-end gap-2">
              <p className="text-3xl font-semibold text-foreground">{draftInvoices}</p>
              <p className="text-sm text-foreground">računa</p>
            </div>
            <p className="mt-1 text-sm text-foreground flex items-center gap-1">
              <Clock className="icon-md" /> spremni za slanje
            </p>
          </div>
          <div className="surface-glass rounded-2xl border-white/20 p-4 text-foreground">
            <p className="text-xs uppercase tracking-wide text-secondary">Status posrednika</p>
            <div className="mt-1 flex items-center gap-2">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  providerConfigured ? "bg-success-bg" : "bg-warning-bg"
                )}
              >
                <ShieldCheck
                  className={cn(
                    "icon-md",
                    providerConfigured ? "text-success-text" : "text-warning-text"
                  )}
                />
              </div>
              <div>
                <p className="text-base font-semibold">
                  {providerConfigured ? "Spremni za fiskalizaciju" : "Povežite posrednika"}
                </p>
                <p className="text-xs text-foreground">
                  {providerConfigured
                    ? "E-računi se mogu slati odmah"
                    : "Završite postavke u minutama"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/assistant"
              className={cn(buttonBaseStyles, "bg-white text-brand-700 hover:bg-white/90")}
            >
              <Sparkles className="icon-md mr-2" />
              Pitaj FiskAI asistenta
            </Link>
            <Link
              href="mailto:?subject=Poziv%20na%20FiskAI&body=Pridru%C5%BEi%20se%20mojoj%20tvrtki%20na%20FiskAI%20platformi."
              className={cn(
                buttonBaseStyles,
                "border border-white/40 text-white hover:bg-white/10"
              )}
            >
              <Users className="icon-md mr-2" />
              Pošalji poziv na email
            </Link>
          </div>
          <p className="text-xs text-white/70">
            Savjet: povežite posrednika i izdajte prvi fiskalizirani račun u 3 koraka.
          </p>
        </div>
      </div>
    </div>
  )
}
