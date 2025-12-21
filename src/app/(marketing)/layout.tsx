import Link from "next/link"
import { MarketingHeader } from "@/components/marketing/MarketingHeader"
import { MarketingAnalyticsInit } from "@/components/marketing/marketing-analytics-init"
import { ComplianceProgressBar } from "@/components/marketing/ComplianceProgressBar"

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-white/60 transition-colors hover:text-white"
    >
      {children}
    </Link>
  )
}

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="marketing-surface min-h-[calc(100vh-var(--header-height))]">
      <MarketingHeader />
      <MarketingAnalyticsInit />

      <div className="pb-16">{children}</div>
      <ComplianceProgressBar />

      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-2 lg:grid-cols-5 md:px-6">
          <div className="space-y-3 lg:col-span-2">
            <div>
              <p className="text-sm font-semibold text-white">FiskAI</p>
              <p className="text-sm text-white/60 mt-1">
                AI-first računovodstveni asistent za Hrvatsku. Beta program.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-white/50">PODUZEĆE I KONTAKT</p>
              <div className="space-y-1 text-sm text-white/70">
                <p className="font-medium text-white">Metrica d.o.o.</p>
                <p>Radnička cesta 80, 10000 Zagreb</p>
                <p>OIB: 12345678901</p>
                <p>IBAN: HR1234567890123456789 (ZABA)</p>
                <p>
                  Email:{" "}
                  <a href="mailto:kontakt@fiskai.hr" className="text-cyan-400 hover:underline">
                    kontakt@fiskai.hr
                  </a>
                </p>
                <p>
                  Tel:{" "}
                  <a href="tel:+38512345678" className="text-cyan-400 hover:underline">
                    +385 1 234 5678
                  </a>
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">Linkovi</p>
            <div className="flex flex-col gap-2">
              <NavLink href="/features">Mogućnosti</NavLink>
              <NavLink href="/pricing">Cijene</NavLink>
              <NavLink href="/security">Sigurnost</NavLink>
              <NavLink href="/contact">Kontakt</NavLink>
              <NavLink href="/status">Status sustava</NavLink>
              <NavLink href="/for/pausalni-obrt">Za paušalni obrt</NavLink>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">Legal</p>
            <div className="flex flex-col gap-2">
              <NavLink href="/privacy">Privatnost</NavLink>
              <NavLink href="/terms">Uvjeti korištenja</NavLink>
              <NavLink href="/dpa">DPA (Obrada podataka)</NavLink>
              <NavLink href="/cookies">Kolačići</NavLink>
              <NavLink href="/ai-data-policy">AI politika</NavLink>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">Transparentnost</p>
            <div className="flex flex-col gap-2">
              <NavLink href="/metodologija">Metodologija</NavLink>
              <NavLink href="/urednicka-politika">Urednička politika</NavLink>
              <NavLink href="/izvori">Službeni izvori</NavLink>
            </div>
            <div className="pt-4">
              <p className="text-xs font-medium text-white/50">PODRŠKA</p>
              <p className="text-xs text-white/60 mt-1">
                Odgovor unutar 24h radnim danima. Hitni slučajevi: +385 1 234 5679
              </p>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-6xl border-t border-white/10 px-4 py-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-xs text-white/60">
              © {new Date().getFullYear()} Metrica d.o.o. (FiskAI). Sva prava pridržana.
            </p>
            <div className="flex items-center gap-6">
              <a href="/status" className="text-xs text-white/60 hover:text-white">
                Status sustava
              </a>
              <a href="/sitemap.xml" className="text-xs text-white/60 hover:text-white">
                Sitemap
              </a>
              <a href="/robots.txt" className="text-xs text-white/60 hover:text-white">
                Robots.txt
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
