import Link from "next/link"
import { Rocket, ArrowRight, Sparkles } from "lucide-react"

interface ToolUpsellCardProps {
  title?: string
  description?: string
  features?: string[]
  ctaText?: string
  ctaLink?: string
  variant?: "default" | "compact" | "inline"
}

export function ToolUpsellCard({
  title = "Automatiziraj s FiskAI",
  description = "Prestani raditi ručno. FiskAI automatizira sve što si upravo izračunao/la.",
  features = [
    "Automatsko praćenje prihoda i rashoda",
    "Pametni podsjetnici za rokove",
    "Izvoz za knjigovođu jednim klikom",
  ],
  ctaText = "Započni besplatno",
  ctaLink = "/register",
  variant = "default",
}: ToolUpsellCardProps) {
  if (variant === "inline") {
    return (
      <div className="my-4 flex items-center justify-between gap-4 rounded-lg border border-focus/20 bg-interactive/10 p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-blue-400" />
          <p className="text-sm text-white">
            <strong>Želiš ovo automatizirati?</strong> FiskAI to radi za tebe.
          </p>
        </div>
        <Link
          href={ctaLink}
          className="flex-shrink-0 rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
        >
          {ctaText}
        </Link>
      </div>
    )
  }

  if (variant === "compact") {
    return (
      <div className="my-6 rounded-xl border border-focus/20 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 p-4">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-interactive">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-white">{title}</h4>
            <p className="mt-1 text-sm text-white/70">{description}</p>
            <Link
              href={ctaLink}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              {ctaText} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Default - full card
  return (
    <div className="my-8 overflow-hidden rounded-xl border border-info-border bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg">
      <div className="p-6 text-white">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
            <Rocket className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-sm text-blue-100">Besplatna proba • Bez kreditne kartice</p>
          </div>
        </div>
        <p className="mb-4 text-blue-100">{description}</p>
        <ul className="mb-6 space-y-2">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
                ✓
              </span>
              {feature}
            </li>
          ))}
        </ul>
        <Link
          href={ctaLink}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-link shadow-md transition-transform hover:scale-105 hover:shadow-lg"
        >
          {ctaText}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
