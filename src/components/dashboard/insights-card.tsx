import type { ReactNode } from "react"
import { Lightbulb, Sparkles, Users, Boxes, ShieldCheck } from "lucide-react"

interface InsightsCardProps {
  companyName: string
  isVatPayer: boolean
  contactCount: number
  productCount: number
}

interface Insight {
  title: string
  description: string
  icon: ReactNode
}

export function InsightsCard({
  companyName,
  isVatPayer,
  contactCount,
  productCount,
}: InsightsCardProps) {
  const insights: Insight[] = [
    {
      title: "Pripremite PDV izvještaj",
      description: isVatPayer
        ? "Postavite podsjetnik za uplatu i filtrirajte račune po kvartalu kako bi PDV obveze bile jasne."
        : "Niste PDV obveznik – provjerite jesu li računi označeni s odgovarajućim PDV statusom.",
      icon: <ShieldCheck className="h-4 w-4 text-success-text" />,
    },
    {
      title: contactCount > 0 ? "Segmentirajte kontakte" : "Dodajte prvi kontakt",
      description:
        contactCount > 0
          ? "Iskoristite segmente (PDV, bez e-maila, bez e-računa) i spremite filtre za praćenje follow-upa."
          : "Dodajte barem jednog kupca/dobavljača kako biste mogli izdati račun i vidjeti onboarding metrike.",
      icon: <Users className="h-4 w-4 text-brand-600" />,
    },
    {
      title: productCount > 0 ? "Uskladite katalog" : "Dodajte proizvode/usluge",
      description:
        productCount > 0
          ? "Provjerite jesu li svi artikli s PDV kategorijom i jedinicom mjere. Razmislite o CSV importu za bulk ažuriranje."
          : "Kreirajte artikle koje najčešće koristite kako biste ubrzali ispunu e-računa.",
      icon: <Boxes className="h-4 w-4 text-link" />,
    },
    {
      title: "Iskoristite FiskAI asistenta",
      description:
        "Pitajte asistenta da pronađe račune u nacrtu, kreira draft e-računa iz ponude ili pripremi podsjetnik za kupca.",
      icon: <Sparkles className="h-4 w-4 text-purple-600" />,
    },
  ]

  return (
    <div className="card p-6">
      <div className="flex items-start gap-2">
        <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
          <Lightbulb className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Insighti</p>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            Što slijedi za {companyName}
          </h3>
          <p className="text-sm text-[var(--muted)]">
            Brze preporuke temeljene na statusu kontakata, PDV-u i katalogu.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.title}
            className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-3"
          >
            <div className="rounded-full bg-white/70 p-2 shadow-sm dark:bg-[var(--surface)]">
              {insight.icon}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">{insight.title}</p>
              <p className="text-sm text-[var(--muted)]">{insight.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
