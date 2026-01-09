import type { Metadata } from "next"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { ExternalLink, CheckCircle2 } from "lucide-react"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"
const APP_URL = "https://app.fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI — Status",
  description: "Status sustava i informacije o dostupnosti FiskAI platforme.",
  alternates: { canonical: `${BASE_URL}/status` },
}

// STATIC PAGE - No runtime DB access
export default function StatusPage() {
  return (
    <SectionBackground variant="dark" showGrid={true} showOrbs={true}>
      <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
        <h1 className="text-display text-4xl font-semibold text-white/90">Status sustava</h1>

        <div className="mt-6 space-y-6">
          <div className="rounded-lg p-6 backdrop-blur-sm border bg-success-bg0/10 border-success-border/20 text-success-text">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6" />
              <h2 className="text-xl font-semibold">Sustav operativan</h2>
            </div>
            <p className="mt-2 text-white/60">
              Za detaljni status u realnom vremenu, posjetite kontrolnu plocu aplikacije.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-6">
            <h3 className="text-lg font-semibold text-white/90">
              Provjera statusa u realnom vremenu
            </h3>
            <p className="mt-2 text-white/60">
              Detaljne metrike sustava, provjere zdravlja i statistike dostupne su u aplikaciji.
            </p>
            <div className="mt-4">
              <a
                href={`${APP_URL}/status`}
                className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-accent to-interactive px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Otvori kontrolnu plocu
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-6">
            <h3 className="text-lg font-semibold text-white/90">API endpoint za monitoring</h3>
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="font-medium text-white/90">Osnovna provjera zdravlja</h4>
                <code className="mt-1 block rounded bg-surface/5 border border-white/10 p-3 font-mono text-sm text-primary">
                  GET {APP_URL}/api/health
                </code>
              </div>
              <div>
                <h4 className="font-medium text-white/90">Detaljna provjera zdravlja</h4>
                <code className="mt-1 block rounded bg-surface/5 border border-white/10 p-3 font-mono text-sm text-primary">
                  GET {APP_URL}/api/health?detailed=true
                </code>
              </div>
              <p className="text-sm text-white/60">
                Vraca JSON s statusom sustava. Za integraciju s monitoring alatima.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-surface/5 backdrop-blur-sm p-6">
            <h3 className="text-lg font-semibold text-white/90">Kontakt za hitne slucajeve</h3>
            <p className="mt-2 text-white/60">
              Ako imate problema s pristupom sustavu ili kriticne tehnicke probleme:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li>
                Email:{" "}
                <a href="mailto:podrska@fiskai.hr" className="text-primary hover:underline">
                  podrska@fiskai.hr
                </a>
              </li>
              <li>Odgovor unutar 24h radnim danima</li>
            </ul>
          </div>
        </div>
      </div>
    </SectionBackground>
  )
}
