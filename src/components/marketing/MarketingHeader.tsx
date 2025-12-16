"use client"

import { useEffect, useId, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ComplianceTrafficLight } from "./ComplianceTrafficLight"
import { LifecycleSelector } from "./LifecycleSelector"

type NavItem = { href: string; label: string }

const NAV_ITEMS: NavItem[] = [
  { href: "/features", label: "Mogućnosti" },
  { href: "/alati", label: "Alati" },
  { href: "/pricing", label: "Cijene" },
  { href: "/baza-znanja", label: "Baza znanja" },
  { href: "/security", label: "Sigurnost" },
  { href: "/contact", label: "Kontakt" },
]

function NavLink({ href, label }: NavItem & { label: string }) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`))

  return (
    <Link
      href={href}
      className={cn(
        "text-sm font-medium transition-colors",
        isActive ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
      )}
    >
      {label}
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
        "btn-press inline-flex min-h-[44px] items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 md:min-h-0",
        variant === "default" && "bg-blue-600 text-white hover:bg-blue-700",
        variant === "outline" &&
          "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]"
      )}
    >
      {children}
    </Link>
  )
}

export function MarketingHeader() {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--glass-surface)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="text-sm font-semibold tracking-tight">FiskAI</span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
            beta
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Glavna navigacija">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LifecycleSelector className="hidden lg:flex" />
          <ComplianceTrafficLight className="hidden sm:block" />
          <LinkButton href="/login" variant="outline">
            Prijava
          </LinkButton>
          <LinkButton href="/register">Započni</LinkButton>
          <button
            type="button"
            className="btn-press inline-flex min-h-[44px] items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--foreground)] hover:bg-[var(--surface-secondary)] md:hidden"
            aria-label={open ? "Zatvori izbornik" : "Otvori izbornik"}
            aria-controls={panelId}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        id={panelId}
        className={cn(
          "md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
          "relative z-30"
        )}
      >
        <div
          className={cn(
            "fixed inset-0 bg-black/40 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
        <div
          className={cn(
            "fixed right-0 top-0 h-full w-[min(92vw,360px)] border-l border-[var(--border)] bg-[var(--surface)] shadow-elevated transition-transform",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-semibold">Navigacija</p>
            <button
              type="button"
              className="btn-press inline-flex min-h-[44px] items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 hover:bg-[var(--surface-secondary)]"
              aria-label="Zatvori izbornik"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-col gap-2 px-4 py-4" aria-label="Mobilna navigacija">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="list-item-interactive font-medium"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 grid gap-2 border-t border-[var(--border)] pt-4">
              <LinkButton href="/login" variant="outline">
                Prijava
              </LinkButton>
              <LinkButton href="/register">Započni besplatno</LinkButton>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
