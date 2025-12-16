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
      <div className="not-prose mb-8 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/50 p-4">
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-blue-600" />
          <span className="text-sm text-blue-900">
            <strong>Pro tip:</strong> {description}
          </span>
        </div>
        <Link
          href={href}
          className="flex-shrink-0 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          {cta} →
        </Link>
      </div>
    )
  }

  if (position === "sidebar") {
    // Sticky sidebar card
    return (
      <div className="not-prose rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h4 className="mb-2 font-semibold text-gray-900">{title}</h4>
        <p className="mb-4 text-sm text-gray-600">{description}</p>
        <ul className="mb-4 space-y-2">
          {features.slice(0, 3).map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {feature}
            </li>
          ))}
        </ul>
        <Link
          href={href}
          className="block w-full rounded-lg bg-blue-600 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
        >
          {cta}
        </Link>
      </div>
    )
  }

  // Default: bottom CTA section
  return (
    <div className="not-prose my-12 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-8 text-white shadow-xl">
      <div className="mx-auto max-w-2xl text-center">
        <h3 className="mb-3 text-2xl font-bold">{title}</h3>
        <p className="mb-6 text-gray-300">{description}</p>
        <div className="mb-6 flex flex-wrap justify-center gap-4">
          {features.map((feature, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm"
            >
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              {feature}
            </div>
          ))}
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 font-semibold text-gray-900 transition-transform hover:scale-105"
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-4 text-xs text-gray-400">
          Besplatna proba • Bez kreditne kartice • Otkaži bilo kada
        </p>
      </div>
    </div>
  )
}
