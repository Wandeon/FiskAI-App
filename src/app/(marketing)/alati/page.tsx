import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Calculator,
  Scale,
  Calendar,
  CreditCard,
  BarChart3,
  ArrowRight,
  Shield,
  FileText,
} from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Besplatni alati za poslovanje | FiskAI",
  description:
    "Besplatni kalkulatori i alati za hrvatske poduzetnike - doprinosi, porezi, uplatnice i više.",
}

const tools = [
  {
    slug: "kalkulator-doprinosa",
    title: "Kalkulator doprinosa",
    description: "Izračunajte mjesečne doprinose za MIO i HZZO",
    icon: Calculator,
  },
  {
    slug: "kalkulator-poreza",
    title: "Kalkulator poreza",
    description: "Izračunajte paušalni porez na temelju prihoda",
    icon: BarChart3,
  },
  {
    slug: "pdv-kalkulator",
    title: "PDV prag (60.000€)",
    description: "Provjerite koliko ste blizu praga i kada postajete PDV obveznik",
    icon: Scale,
  },
  {
    slug: "uplatnice",
    title: "Generator uplatnica",
    description: "Generirajte HUB3 barkod za uplate doprinosa i poreza",
    icon: CreditCard,
  },
  {
    slug: "kalendar",
    title: "Kalendar rokova",
    description: "Podsjetnik za važne rokove prijava i uplata",
    icon: Calendar,
  },
  {
    slug: "oib-validator",
    title: "OIB Validator",
    description: "Provjerite valjanost OIB-a (Osobni identifikacijski broj)",
    icon: Shield,
  },
  {
    slug: "e-racun",
    title: "E-Račun Generator",
    description: "Generirajte UBL 2.1 XML e-račune prema hrvatskim standardima",
    icon: FileText,
  },
]

export default function ToolsIndexPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
          Baza znanja
        </Link>{" "}
        <span className="text-[var(--muted)]">/</span>{" "}
        <span className="text-[var(--foreground)]">Alati</span>
      </nav>

      <header className="text-center">
        <h1 className="text-display text-4xl font-semibold md:text-5xl">Besplatni alati</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Kalkulatori i pomoćni alati za hrvatske poduzetnike. Potpuno besplatno, bez registracije.
        </p>
      </header>

      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link key={tool.slug} href={`/alati/${tool.slug}`} className="group">
            <Card className="card card-hover h-full cursor-pointer">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10">
                  <tool.icon className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{tool.title}</span>
                  <ArrowRight className="h-4 w-4 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--muted)]">{tool.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-blue-200 bg-blue-50 p-6">
        <p className="text-sm">
          Trebate širu sliku (paušal vs obrt vs d.o.o.)?{" "}
          <Link href="/wizard" className="font-semibold text-blue-700 hover:underline">
            Pokrenite čarobnjak
          </Link>{" "}
          ili otvorite{" "}
          <Link
            href="/usporedba/pocinjem-solo"
            className="font-semibold text-blue-700 hover:underline"
          >
            usporedbe
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
