import Link from "next/link"
import { Brain, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"

const buttonBaseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 h-10 px-4 py-2 mt-4 w-full"

export function ActionCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">FiskAI asistent</p>
            <p className="text-sm text-[var(--muted)]">Pitaj bilo što o financijama, računima ili zakonima</p>
          </div>
        </div>
        <Link
          href="/assistant"
          className={cn(buttonBaseStyles, "bg-blue-600 text-white hover:bg-blue-700")}
        >
          Pokreni asistenta
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Pozovi računovođu</p>
            <p className="text-sm text-[var(--muted)]">Podijelite FiskAI pristup s timom ili vanjskim partnerom</p>
          </div>
        </div>
        <Link
          href="mailto:?subject=Poziv%20na%20FiskAI&body=Pridru%C5%BEi%20se%20mojoj%20tvrtki%20na%20FiskAI."
          className={cn(buttonBaseStyles, "border border-emerald-100 bg-white text-emerald-600 hover:bg-emerald-50")}
        >
          Pošalji pozivnicu
        </Link>
      </div>
    </div>
  )
}
