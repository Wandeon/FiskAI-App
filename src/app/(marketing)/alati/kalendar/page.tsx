import { Metadata } from "next"
import Link from "next/link"
import { DeadlineCalendar } from "@/components/knowledge-hub/tools/DeadlineCalendar"
import { Bell, ArrowRight, Calendar } from "lucide-react"

export const metadata: Metadata = {
  title: "Kalendar Rokova 2025 | FiskAI",
  description: "Svi važni porezni rokovi za 2025. godinu na jednom mjestu.",
}

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 md:px-6">
      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
          Baza znanja
        </Link>{" "}
        <span className="text-[var(--muted)]">/</span>{" "}
        <Link href="/alati" className="hover:text-[var(--foreground)]">
          Alati
        </Link>{" "}
        <span className="text-[var(--muted)]">/</span>{" "}
        <span className="text-[var(--foreground)]">Kalendar</span>
      </nav>

      <header>
        <h1 className="text-display text-4xl font-semibold">Kalendar rokova 2025</h1>
        <p className="mt-4 text-[var(--muted)]">Ne propustite važne rokove za prijave i uplate.</p>
      </header>

      <div className="mt-8">
        <DeadlineCalendar year={2025} />
      </div>

      {/* Upsell Section */}
      <section className="mt-12 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Bell className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Nikad ne propusti rok</h3>
            <p className="mt-1 text-sm text-blue-100">
              FiskAI šalje automatske podsjetnike 7 dana, 3 dana i 1 dan prije svakog roka. Plus
              generirane uplatnice spremne za plaćanje.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-blue-100">
              <li className="flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Personalizirani kalendar za vaš obrt
              </li>
              <li className="flex items-center gap-2">
                <span>✓</span> Email i push notifikacije
              </li>
              <li className="flex items-center gap-2">
                <span>✓</span> Sinkronizacija s Google/Apple kalendarom
              </li>
            </ul>
            <Link
              href="/register"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Aktiviraj podsjetnike <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
