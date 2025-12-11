import Link from "next/link"
import { cn } from "@/lib/utils"
import { Sparkles, ShieldCheck, Clock, ArrowRight, Users } from "lucide-react"

interface HeroBannerProps {
  userName: string
  companyName: string
  draftInvoices: number
  providerConfigured: boolean
  contactCount: number
  className?: string
}

const buttonBaseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 h-10 px-4 py-2"

export function HeroBanner({
  userName,
  companyName,
  draftInvoices,
  providerConfigured,
  contactCount,
  className,
}: HeroBannerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-brand-600 via-brand-600 to-indigo-700 text-white shadow-[0_20px_50px_rgba(15,23,42,0.35)]",
        className
      )}
    >
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25),_transparent_50%)]" />
      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-white/80">
            <Sparkles className="h-3.5 w-3.5" />
            FiskAI asistent
          </div>
          <h2 className="text-3xl font-semibold">
            Dobrodošli natrag, {userName}!
          </h2>
          <p className="text-sm text-white/80">
            {companyName} • {contactCount} kontakata • {providerConfigured ? "Posrednik spojen" : "Konfigurirajte posrednika"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/e-invoices/new" className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm transition hover:bg-white/20">
            <p className="text-xs uppercase tracking-wide text-white/70">Sljedeći korak</p>
            <p className="text-lg font-semibold">Kreirajte e-račun</p>
            <p className="mt-1 text-sm text-white/80 flex items-center gap-1">
              <ArrowRight className="h-4 w-4" /> brzo iz nacrta
            </p>
          </Link>
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-white/70">Nacrti</p>
            <div className="mt-1 flex items-end gap-2">
              <p className="text-3xl font-semibold">{draftInvoices}</p>
              <p className="text-sm text-white/80">računa</p>
            </div>
            <p className="mt-1 text-sm text-white/80 flex items-center gap-1">
              <Clock className="h-4 w-4" /> spremni za slanje
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-white/70">Status posrednika</p>
            <div className="mt-1 flex items-center gap-2">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                providerConfigured ? "bg-emerald-500/20" : "bg-yellow-500/20"
              )}>
                <ShieldCheck className={cn(
                  "h-5 w-5",
                  providerConfigured ? "text-emerald-300" : "text-yellow-200"
                )} />
              </div>
              <div>
                <p className="text-base font-semibold">
                  {providerConfigured ? "Spremni za fiskalizaciju" : "Povežite posrednika"}
                </p>
                <p className="text-xs text-white/80">
                  {providerConfigured ? "E-računi se mogu slati odmah" : "Završite postavke u minutama"}
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
              <Sparkles className="h-4 w-4 mr-2" />
              Pitaj FiskAI asistenta
            </Link>
            <Link
              href="mailto:?subject=Poziv%20na%20FiskAI&body=Pridru%C5%BEi%20se%20mojoj%20tvrtki%20na%20FiskAI%20platformi."
              className={cn(buttonBaseStyles, "border border-white/40 text-white hover:bg-white/10")}
            >
              <Users className="h-4 w-4 mr-2" />
              Pozovi računovodstvo
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
