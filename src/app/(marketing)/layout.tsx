import Link from "next/link"
import { cn } from "@/lib/utils"

function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
    >
      {children}
    </Link>
  )
}

function LinkButton({
  href,
  variant = "default",
  children,
}: {
  href: string
  variant?: "default" | "outline"
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 min-h-[44px] md:min-h-0",
        variant === "default" && "bg-blue-600 text-white hover:bg-blue-700",
        variant === "outline" && "border border-gray-300 bg-white hover:bg-gray-50"
      )}
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
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--glass-surface)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">FiskAI</span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
              beta
            </span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <NavLink href="/features">Mogućnosti</NavLink>
            <NavLink href="/pricing">Cijene</NavLink>
            <NavLink href="/security">Sigurnost</NavLink>
            <NavLink href="/contact">Kontakt</NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <LinkButton href="/login" variant="outline">
              Prijava
            </LinkButton>
            <LinkButton href="/register">Započni</LinkButton>
          </div>
        </div>
      </header>

      <div>{children}</div>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-3 md:px-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold">FiskAI</p>
            <p className="text-sm text-[var(--muted)]">
              AI-first računovodstveni asistent za Hrvatsku, u razvoju.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Linkovi</p>
            <div className="flex flex-col gap-2">
              <NavLink href="/features">Mogućnosti</NavLink>
              <NavLink href="/pricing">Cijene</NavLink>
              <NavLink href="/security">Sigurnost</NavLink>
              <NavLink href="/contact">Kontakt</NavLink>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Legal</p>
            <div className="flex flex-col gap-2">
              <NavLink href="/privacy">Privatnost</NavLink>
              <NavLink href="/terms">Uvjeti korištenja</NavLink>
            </div>
            <p className="pt-2 text-xs text-[var(--muted)]">
              © {new Date().getFullYear()} FiskAI. Sva prava pridržana.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

