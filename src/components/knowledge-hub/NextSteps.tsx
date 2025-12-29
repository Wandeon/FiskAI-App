"use client"

import Link from "next/link"
import { ArrowRight, Calculator, Scale, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useVisitorStore } from "@/stores/visitor-store"

interface NextStepsProps {
  tools?: Array<{
    title: string
    description: string
    href: string
  }>
  comparisons?: Array<{
    title: string
    description: string
    href: string
  }>
  className?: string
}

export function NextSteps({ tools, comparisons, className }: NextStepsProps) {
  const hasTools = tools && tools.length > 0
  const hasComparisons = comparisons && comparisons.length > 0
  const { stage } = useVisitorStore()

  // Show more compelling CTA if user came from wizard
  const ctaText = stage === "recommendation"
    ? "Započni s FiskAI"
    : "Započni besplatno"
  const ctaDescription = stage === "recommendation"
    ? "Završite registraciju i postavite tvrtku koja odgovara vašim potrebama."
    : "FiskAI automatski prati prihode, rashode i rokove. Bez ručnog rada."

  if (!hasTools && !hasComparisons) {
    return null
  }

  return (
    <section className={cn("mt-12 border-t border-white/10 pt-8", className)}>
      <div className="mb-6 flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-accent" />
        <h2 className="text-2xl font-bold text-white">Sljedeći koraci</h2>
      </div>

      <div className="space-y-6">
        {/* Related Tools */}
        {hasTools && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-white/60" />
              <h3 className="font-semibold text-white">Relevantni alati</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {tools.map((tool, index) => (
                <Link
                  key={index}
                  href={tool.href}
                  className="group rounded-lg border border-white/10 bg-white/5 p-4 transition-all hover:border-cyan-500/30 hover:bg-chart-7/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-white group-hover:text-accent transition-colors">
                        {tool.title}
                      </h4>
                      <p className="mt-1 text-sm text-white/60">{tool.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Related Comparisons */}
        {hasComparisons && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Scale className="h-5 w-5 text-white/60" />
              <h3 className="font-semibold text-white">Povezane usporedbe</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {comparisons.map((comparison, index) => (
                <Link
                  key={index}
                  href={comparison.href}
                  className="group rounded-lg border border-white/10 bg-white/5 p-4 transition-all hover:border-cyan-500/30 hover:bg-chart-7/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-white group-hover:text-accent transition-colors">
                        {comparison.title}
                      </h4>
                      <p className="mt-1 text-sm text-white/60">{comparison.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA to register/try FiskAI */}
        <div className="rounded-xl border border-focus/30 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Spremni za automatizaciju?</h3>
              <p className="mt-1 text-sm text-white/70">
                {ctaDescription}
              </p>
            </div>
            <Link
              href="/auth"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-interactive px-6 py-3 font-semibold text-white transition-all hover:bg-interactive-hover hover:scale-105"
            >
              {ctaText}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
