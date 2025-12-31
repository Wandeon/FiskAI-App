import Link from "next/link"
import { ArrowRight, CheckCircle2, Zap } from "lucide-react"

interface GuideUpsellSectionProps {
  title?: string
  description?: string
  cta?: string
  href?: string
  features?: string[]
  position?: "top" | "bottom" | "sidebar"
}

export function GuideUpsellSection({
  title = "Spremni za automatizaciju?",
  description = "FiskAI automatizira sve što ste upravo pročitali.",
  cta = "Započni besplatno",
  href = "/register",
  features = [
    "Automatsko izdavanje računa",
    "Evidencija troškova sa skeniranjem",
    "Izvoz za knjigovođu",
  ],
  position = "bottom",
}: GuideUpsellSectionProps) {
  if (position === "top") {
    // Subtle banner at the top
    return (
      <div className="not-prose mb-8 flex items-center justify-between rounded-lg border border-focus/20 bg-interactive/10 p-4">
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-link" />
          <span className="text-sm text-white">
            <strong>Pro tip:</strong> {description}
          </span>
        </div>
        <Link
          href={href}
          className="flex-shrink-0 text-sm font-medium text-link hover:text-blue-300"
        >
          {cta} →
        </Link>
      </div>
    )
  }

  if (position === "sidebar") {
    // Sticky sidebar card
    return (
      <div className="not-prose rounded-xl border border-white/10 bg-surface/5 p-5 shadow-sm">
        <h4 className="mb-2 font-semibold text-white">{title}</h4>
        <p className="mb-4 text-sm text-white/70">{description}</p>
        <ul className="mb-4 space-y-2">
          {features.slice(0, 3).map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-white/90">
              <CheckCircle2 className="h-4 w-4 text-success" />
              {feature}
            </li>
          ))}
        </ul>
        <Link
          href={href}
          className="block w-full rounded-lg bg-interactive py-2 text-center text-sm font-medium text-white hover:bg-interactive-hover"
        >
          {cta}
        </Link>
      </div>
    )
  }

  // Default: bottom CTA section
  return (
    <div className="not-prose my-12 rounded-2xl bg-gradient-to-br from-base to-surface-elevated p-8 text-white shadow-xl">
      <div className="mx-auto max-w-2xl text-center">
        <h3 className="mb-3 text-2xl font-bold">{title}</h3>
        <p className="mb-6 text-muted">{description}</p>
        <div className="mb-6 flex flex-wrap justify-center gap-4">
          {features.map((feature, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-full bg-surface/10 px-4 py-2 text-sm"
            >
              <CheckCircle2 className="h-4 w-4 text-success-text" />
              {feature}
            </div>
          ))}
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-lg bg-surface px-8 py-3 font-semibold text-foreground transition-transform hover:scale-105"
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-4 text-xs text-muted">
          Besplatna proba • Bez kreditne kartice • Otkaži bilo kada
        </p>
      </div>
    </div>
  )
}
