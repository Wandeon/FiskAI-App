import type { Metadata } from "next"
import { getDetailedHealth } from "@/lib/monitoring/system-health"

export const metadata: Metadata = {
  title: "FiskAI — Status",
  description: "System status and health information for FiskAI platform.",
}

export default async function StatusPage() {
  let health: Awaited<ReturnType<typeof getDetailedHealth>> | null = null;
  let error: string | null = null;

  try {
    health = await getDetailedHealth();
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('hr-HR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
      <h1 className="text-display text-4xl font-semibold">Status sustava</h1>
      
      {error ? (
        <div className="mt-6 rounded-lg bg-red-50 p-6 text-red-800">
          <h2 className="text-xl font-semibold">Greška prilikom provjere statusa</h2>
          <p className="mt-2">{error}</p>
        </div>
      ) : health ? (
        <div className="mt-6 space-y-6">
          <div className={`rounded-lg p-6 ${
            health.status === 'healthy' 
              ? 'bg-green-50 text-green-800' 
              : health.status === 'degraded'
              ? 'bg-yellow-50 text-yellow-800'
              : 'bg-red-50 text-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Status: {health.status === 'healthy' ? 'Zdrav' : health.status === 'degraded' ? 'Delimično ometen' : 'Nedostupan'}
              </h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                health.status === 'healthy' 
                  ? 'bg-green-100 text-green-800' 
                  : health.status === 'degraded'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {health.status === 'healthy' ? 'OK' : health.status === 'degraded' ? 'POZOR' : 'KRITIČNO'}
              </span>
            </div>
            <p className="mt-2">
              Ažurirano: {formatTimestamp(health.timestamp)}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {health.metrics && (
              <div className="rounded-lg border bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900">Metrike sustava</h3>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Korisnici</span>
                    <span className="font-medium">{health.metrics.users}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tvrtke</span>
                    <span className="font-medium">{health.metrics.companies}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Računi</span>
                    <span className="font-medium">{health.metrics.invoices}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Troškovi</span>
                    <span className="font-medium">{health.metrics.expenses}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Kontakti</span>
                    <span className="font-medium">{health.metrics.contacts}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-white p-6">
              <h3 className="text-lg font-semibold text-gray-900">Provjere zdravlja</h3>
              <div className="mt-4 space-y-3">
                {health.checks.map((check, index) => (
                  <div key={index} className="flex justify-between items-start">
                    <span className="text-gray-600">{check.name}</span>
                    <span className={`font-medium ${
                      check.status === 'passed' 
                        ? 'text-green-600' 
                        : check.status === 'warning'
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}>
                      {check.status === 'passed' ? 'PROŠLO' : check.status === 'warning' ? 'UPOZORENJE' : 'NEPROŠLO'}
                    </span>
                    {check.message && (
                      <span className="ml-2 text-sm text-gray-500">{check.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg bg-gray-50 p-6">
          <p className="text-gray-600">Učitavanje statusa...</p>
        </div>
      )}

      <div className="mt-12 rounded-lg border bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">API endpointi za nadgledanje</h3>
        <div className="mt-4 space-y-4">
          <div>
            <h4 className="font-medium">Osnovna provjera zdravlja</h4>
            <code className="mt-1 block rounded bg-gray-100 p-3 font-mono text-sm">GET /api/health</code>
          </div>
          <div>
            <h4 className="font-medium">Detaljna provjera zdravlja</h4>
            <code className="mt-1 block rounded bg-gray-100 p-3 font-mono text-sm">GET /api/health?detailed=true</code>
          </div>
          <div>
            <h4 className="font-medium">Izvoz podataka tvrtke (za administratora)</h4>
            <code className="mt-1 block rounded bg-gray-100 p-3 font-mono text-sm">GET /api/exports/company</code>
          </div>
        </div>
      </div>
    </div>
  )
}