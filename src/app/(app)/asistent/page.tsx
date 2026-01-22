import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Asistent | FiskAI",
  description: "AI asistent za regulatorne upite.",
}

/**
 * Assistant page - temporarily unavailable
 *
 * The AI assistant has been moved to the fiskai-intelligence platform
 * as part of the architectural split. Integration with the Intelligence API
 * is planned for a future release.
 */
export default function AppAssistantPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Regulatorni asistent</h1>
        <p className="text-muted-foreground">
          AI asistent za regulatorne upite s podacima vaše tvrtke.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <div className="rounded-full bg-muted p-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </div>
          <h2 className="text-lg font-medium">Uskoro dostupno</h2>
          <p className="max-w-md text-center text-muted-foreground">
            Radimo na poboljšanju regulatornog asistenta. Ova značajka bit će ponovno dostupna
            uskoro s poboljšanom podrškom za regulatorne upite.
          </p>
          <Link
            href="/cc"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Povratak na nadzornu ploču
          </Link>
        </div>
      </div>
    </div>
  )
}
