import { Metadata } from "next"
import Link from "next/link"
import { DeadlineCalendar } from "@/components/knowledge-hub/tools/DeadlineCalendar"
import { Bell, ArrowRight, Calendar } from "lucide-react"
import { FAQ } from "@/components/content/FAQ"
import { generateWebApplicationSchema } from "@/lib/schema/webApplication"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { DEADLINES, ADDITIONAL_DEADLINES } from "@/lib/fiscal-data"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: `Kalendar Rokova ${DEADLINES.year} | FiskAI`,
  description: `Svi važni porezni rokovi za ${DEADLINES.year}. godinu na jednom mjestu.`,
  alternates: {
    canonical: `${BASE_URL}/alati/kalendar`,
  },
}

const calendarYear = DEADLINES.year
const formatDayMonth = (dateString: string, year: number) => {
  const [day, month] = dateString.split(".").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
  })
}

const posdQ4Deadline = formatDayMonth(ADDITIONAL_DEADLINES.posdQuarterly.dates[0], calendarYear + 1)
const contributionsDay = DEADLINES.contributions.monthly.dates[0]
const dohodakDeadline = formatDayMonth(DEADLINES.annualFiling.dohodak.dates[0], calendarYear)
const posdAnnualDeadline = formatDayMonth(ADDITIONAL_DEADLINES.posd.dates[0], calendarYear)
const pdvDeadline = formatDayMonth(ADDITIONAL_DEADLINES.pdv.quarterly.dates[0], calendarYear)

const faq = [
  {
    q: "Kada je rok za PO-SD za Q4?",
    a: `${posdQ4Deadline} sljedeće godine.`,
  },
  {
    q: "Kada se plaćaju doprinosi za paušalce?",
    a: `Do ${contributionsDay}. u mjesecu za prethodni mjesec.`,
  },
  {
    q: "Koji su godišnji porezni rokovi?",
    a: `DOH do ${dohodakDeadline}, godišnji PO-SD do ${posdAnnualDeadline}, PDV-K do ${pdvDeadline}.`,
  },
]

export default function CalendarPage() {
  const webAppSchema = generateWebApplicationSchema({
    name: "Porezni Kalendar",
    description: `Svi važni porezni rokovi za ${calendarYear}. godinu na jednom mjestu.`,
    url: "https://fiskai.hr/alati/kalendar",
  })

  return (
    <SectionBackground>
      <div className="mx-auto max-w-5xl px-4 py-14 md:px-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
        />
        <nav className="mb-6 text-sm text-white/60">
          <Link href="/baza-znanja" className="hover:text-white/90">
            Baza znanja
          </Link>{" "}
          <span className="text-white/60">/</span>{" "}
          <Link href="/alati" className="hover:text-white/90">
            Alati
          </Link>{" "}
          <span className="text-white/60">/</span> <span className="text-white/90">Kalendar</span>
        </nav>

        <header>
          <h1 className="text-display text-4xl font-semibold">Kalendar rokova {calendarYear}</h1>
          <p className="mt-4 text-white/60">Ne propustite važne rokove za prijave i uplate.</p>
        </header>

        <div className="mt-8">
          <DeadlineCalendar year={calendarYear} />
        </div>

        {/* Upsell Section */}
        <section className="mt-12 rounded-xl border border-info-border bg-gradient-to-r from-interactive to-interactive p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-surface/20">
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
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-surface px-5 py-2.5 text-sm font-semibold text-primary hover:bg-info-bg"
              >
                Aktiviraj podsjetnike <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <FAQ items={faq} />
      </div>
    </SectionBackground>
  )
}
