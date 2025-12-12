import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "FiskAI — Cijene",
  description: "Cijene i paketi za FiskAI (beta).",
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <div className="space-y-3">
        <h1 className="text-display text-4xl font-semibold">Cijene</h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          FiskAI je u beta fazi. Cijene i paketi će se stabilizirati kroz prve korisnike — cilj je transparentno i bez “skrivenih troškova”.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <Card className="card card-hover">
          <CardHeader>
            <CardTitle>Starter</CardTitle>
            <p className="text-sm text-[var(--muted)]">paušalni obrt</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--muted)]">
            <p>Računi, troškovi, osnovni izvještaji, izvozi.</p>
            <p className="text-xs">Cijena: po dogovoru tijekom beta programa.</p>
            <Link href="/register" className="inline-flex font-semibold text-blue-700 hover:underline">
              Započni
            </Link>
          </CardContent>
        </Card>

        <Card className="card card-hover border-blue-200">
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <p className="text-sm text-[var(--muted)]">VAT obrt / d.o.o.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--muted)]">
            <p>Napredniji workflow, više korisnika, priprema za e-račune/fiskalizaciju.</p>
            <p className="text-xs">Cijena: po dogovoru tijekom beta programa.</p>
            <Link href="/contact" className="inline-flex font-semibold text-blue-700 hover:underline">
              Zatraži demo
            </Link>
          </CardContent>
        </Card>

        <Card className="card card-hover">
          <CardHeader>
            <CardTitle>ERP</CardTitle>
            <p className="text-sm text-[var(--muted)]">timovi i procesi</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--muted)]">
            <p>Moduli: banke, skladište, plaće, temeljnice, izvještaji (roadmap).</p>
            <p className="text-xs">Cijena: enterprise / po modulu.</p>
            <Link href="/contact" className="inline-flex font-semibold text-blue-700 hover:underline">
              Kontakt
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-display text-2xl font-semibold">Beta program</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Ako želite biti među prvim korisnicima, cilj je dobiti povratne informacije i brzo iterirati. U zamjenu nudimo bržu podršku i rani utjecaj na roadmap.
        </p>
        <div className="mt-4">
          <Link href="/contact" className="inline-flex font-semibold text-blue-700 hover:underline">
            Javite se za beta pristup
          </Link>
        </div>
      </div>
    </div>
  )
}

