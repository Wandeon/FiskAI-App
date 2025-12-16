import { Metadata } from "next"
import { DeadlineCalendar } from "@/components/knowledge-hub/tools/DeadlineCalendar"

export const metadata: Metadata = {
  title: "Kalendar Rokova 2025 | FiskAI",
  description: "Svi važni porezni rokovi za 2025. godinu na jednom mjestu.",
}

export default function CalendarPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Kalendar Rokova 2025</h1>
        <p className="text-lg text-gray-600">Ne propustite važne rokove za prijave i uplate.</p>
      </header>

      <DeadlineCalendar year={2025} />
    </div>
  )
}
