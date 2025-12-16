"use client"

import Link from "next/link"
import { ArrowRight, Scale } from "lucide-react"

interface Comparison {
  slug: string
  title: string
  description: string
}

export function ComparisonsExplorer({ comparisons }: { comparisons: Comparison[] }) {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      {comparisons.map((comparison) => (
        <Link
          key={comparison.slug}
          href={`/usporedba/${comparison.slug}`}
          className="group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:border-blue-300 hover:shadow-md"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <Scale className="h-5 w-5 text-blue-600" />
          </div>
          <h3 className="font-semibold text-[var(--foreground)] group-hover:text-blue-600">
            {comparison.title}
          </h3>
          <p className="mt-1 flex-1 text-sm text-[var(--muted)]">{comparison.description}</p>
          <div className="mt-4 flex items-center gap-1 text-sm font-medium text-blue-600">
            Pročitaj usporedbu
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      ))}
    </div>
  )
}
