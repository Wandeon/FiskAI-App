// src/components/knowledge-hub/comparison/GetStartedCTA.tsx
"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useVisitorStore } from "@/stores/visitor-store"

export function GetStartedCTA() {
  const { stage } = useVisitorStore()

  // Show more compelling CTA if user came from wizard
  const ctaText = stage === "recommendation" ? "Započni s FiskAI" : "Započni besplatno"
  const ctaTitle =
    stage === "recommendation" ? "Završite postavljanje tvrtke" : "Spremni za automatizaciju?"
  const ctaDescription =
    stage === "recommendation"
      ? "Sada kada znate koji oblik poslovanja vam odgovara, registrirajte se i FiskAI će vas provesti kroz postavljanje."
      : "FiskAI automatski prati prihode, rashode i rokove. Bez ručnog rada."

  return (
    <section className="mt-12 border-t border-white/10 pt-8">
      <div className="rounded-xl border border-focus/30 bg-gradient-to-r from-interactive/10 to-chart-1/10 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">{ctaTitle}</h3>
            <p className="mt-1 text-sm text-white/70">{ctaDescription}</p>
          </div>
          <Link
            href="/auth"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-interactive px-6 py-3 font-semibold text-white transition-all hover:bg-interactive-hover hover:scale-105 whitespace-nowrap"
          >
            {ctaText}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
