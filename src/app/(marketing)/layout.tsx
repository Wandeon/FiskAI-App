import Link from "next/link"
import { MarketingHeader } from "@/components/marketing/MarketingHeader"
import { MarketingAnalyticsInit } from "@/components/marketing/marketing-analytics-init"
import { ComplianceProgressBar } from "@/components/marketing/ComplianceProgressBar"

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
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
    <div className="min-h-[calc(100vh-var(--header-height))]">
      <MarketingHeader />
      <MarketingAnalyticsInit />

      <div className="pb-16">{children}</div>
      <ComplianceProgressBar />

      <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4 md:px-6">
          <div className="space-y-3 md:col-span-2">
            <div>
              <p className="text-sm font-semibold">FiskAI</p>
              <p className="text-sm text-[var(--muted)] mt-1">
                AI-first računovodstveni asistent za Hrvatsku. Beta program.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--muted)]">PODUZEĆE I KONTAKT</p>
              <div className="space-y-1 text-sm">
                <p className="font-medium">Metrica d.o.o.</p>
                <p>Radnička cesta 80, 10000 Zagreb</p>
                <p>OIB: 12345678901</p>
                <p>IBAN: HR1234567890123456789 (ZABA)</p>
                <p>
                  Email:{" "}
                  <a href="mailto:kontakt@fiskai.hr" className="text-blue-700 hover:underline">
                    kontakt@fiskai.hr
                  </a>
                </p>
                <p>
                  Tel:{" "}
                  <a href="tel:+38512345678" className="text-blue-700 hover:underline">
                    +385 1 234 5678
                  </a>
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold">Linkovi</p>
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
            <p className="text-sm font-semibold">Legal & Podrška</p>
            <div className="flex flex-col gap-2">
              <NavLink href="/privacy">Privatnost</NavLink>
              <NavLink href="/terms">Uvjeti korištenja</NavLink>
              <NavLink href="/dpa">DPA (Obrada podataka)</NavLink>
              <NavLink href="/cookies">Kolačići</NavLink>
              <NavLink href="/ai-data-policy">AI politika</NavLink>
            </div>
            <div className="pt-4">
              <p className="text-xs font-medium text-[var(--muted)]">PODRŠKA</p>
              <p className="text-xs text-[var(--muted)] mt-1">
                Odgovor unutar 24h radnim danima. Hitni slučajevi: +385 1 234 5679
              </p>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-6xl border-t border-[var(--border)] px-4 py-4 md:px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-xs text-[var(--muted)]">
              © {new Date().getFullYear()} Metrica d.o.o. (FiskAI). Sva prava pridržana.
            </p>
            <div className="flex items-center gap-6">
              <a
                href="/status"
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Status sustava
              </a>
              <a
                href="/sitemap.xml"
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Sitemap
              </a>
              <a
                href="/robots.txt"
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Robots.txt
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
