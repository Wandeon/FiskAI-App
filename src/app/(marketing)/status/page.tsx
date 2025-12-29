import type { Metadata } from "next"
import { getDetailedHealth } from "@/lib/monitoring/system-health"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Status",
  description: "System status and health information for FiskAI platform.",
  alternates: {
    canonical: `${BASE_URL}/status`,
  },
}

// Force dynamic rendering - this page needs database access
export const dynamic = "force-dynamic"

export default async function StatusPage() {
  let health: Awaited<ReturnType<typeof getDetailedHealth>> | null = null
  let error: string | null = null

  try {
    health = await getDetailedHealth()
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error"
  }

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat("hr-HR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date)
  }

  return (
    <SectionBackground variant="dark" showGrid={true} showOrbs={true}>
      <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
        <h1 className="text-display text-4xl font-semibold text-white/90">Status sustava</h1>

        {error ? (
          <div className="mt-6 rounded-lg bg-red-500/10 backdrop-blur-sm border border-red-500/20 p-6 text-red-400">
            <h2 className="text-xl font-semibold">Greška prilikom provjere statusa</h2>
            <p className="mt-2">{error}</p>
          </div>
        ) : health ? (
          <div className="mt-6 space-y-6">
            <div
              className={`rounded-lg p-6 backdrop-blur-sm border ${
                health.status === "healthy"
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : health.status === "degraded"
                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Status:{" "}
                  {health.status === "healthy"
                    ? "Zdrav"
                    : health.status === "degraded"
                      ? "Delimično ometen"
                      : "Nedostupan"}
                </h2>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    health.status === "healthy"
                      ? "bg-green-500/20 text-green-400"
                      : health.status === "degraded"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {health.status === "healthy"
                    ? "OK"
                    : health.status === "degraded"
                      ? "POZOR"
                      : "KRITIČNO"}
                </span>
              </div>
              <p className="mt-2 text-white/60">Ažurirano: {formatTimestamp(health.timestamp)}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {health.metrics && (
                <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
                  <h3 className="text-lg font-semibold text-white/90">Metrike sustava</h3>
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-white/60">Korisnici</span>
                      <span className="font-medium text-white/90">{health.metrics.users}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Tvrtke</span>
                      <span className="font-medium text-white/90">{health.metrics.companies}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Računi</span>
                      <span className="font-medium text-white/90">{health.metrics.invoices}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Troškovi</span>
                      <span className="font-medium text-white/90">{health.metrics.expenses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Kontakti</span>
                      <span className="font-medium text-white/90">{health.metrics.contacts}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
                <h3 className="text-lg font-semibold text-white/90">Provjere zdravlja</h3>
                <div className="mt-4 space-y-3">
                  {health.checks.map((check, index) => (
                    <div key={index} className="flex justify-between items-start">
                      <span className="text-white/60">{check.name}</span>
                      <span
                        className={`font-medium ${
                          check.status === "passed"
                            ? "text-green-400"
                            : check.status === "warning"
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {check.status === "passed"
                          ? "PROŠLO"
                          : check.status === "warning"
                            ? "UPOZORENJE"
                            : "NEPROŠLO"}
                      </span>
                      {check.message && (
                        <span className="ml-2 text-sm text-white/50">{check.message}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 p-6">
            <p className="text-white/60">Učitavanje statusa...</p>
          </div>
        )}

        <div className="mt-12 rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h3 className="text-lg font-semibold text-white/90">API endpointi za nadgledanje</h3>
          <div className="mt-4 space-y-4">
            <div>
              <h4 className="font-medium text-white/90">Osnovna provjera zdravlja</h4>
              <code className="mt-1 block rounded bg-white/5 border border-white/10 p-3 font-mono text-sm text-cyan-400">
                GET /api/health
              </code>
            </div>
            <div>
              <h4 className="font-medium text-white/90">Detaljna provjera zdravlja</h4>
              <code className="mt-1 block rounded bg-white/5 border border-white/10 p-3 font-mono text-sm text-cyan-400">
                GET /api/health?detailed=true
              </code>
            </div>
            <div>
              <h4 className="font-medium text-white/90">
                Izvoz podataka tvrtke (za administratora)
              </h4>
              <code className="mt-1 block rounded bg-white/5 border border-white/10 p-3 font-mono text-sm text-cyan-400">
                GET /api/exports/company
              </code>
            </div>
          </div>
        </div>
      </div>
    </SectionBackground>
  )
}
