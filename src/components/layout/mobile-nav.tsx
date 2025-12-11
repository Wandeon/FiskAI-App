'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Nadzorna ploča", href: "/dashboard", icon: "📊" },
  { name: "Dokumenti", href: "/invoices", icon: "📋" },
  { name: "E-Računi", href: "/e-invoices", icon: "📄" },
  { name: "Troškovi", href: "/expenses", icon: "💸" },
  { name: "Banka", href: "/banking", icon: "🏦" },
  { name: "Izvještaji", href: "/reports", icon: "📈" },
  { name: "Kontakti", href: "/contacts", icon: "👥" },
  { name: "Proizvodi", href: "/products", icon: "📦" },
  { name: "Postavke", href: "/settings", icon: "⚙️" },
]

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const handleClose = () => setIsOpen(false)

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-40 md:hidden rounded-md bg-white p-2 shadow-md border border-gray-200"
        aria-label="Open menu"
      >
        <svg
          className="h-6 w-6 text-gray-700"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-out Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-xl transition-transform duration-300 md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900">FiskAI</h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1 hover:bg-gray-100"
            aria-label="Close menu"
          >
            <svg
              className="h-6 w-6 text-gray-700"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClose}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <span>{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  )
}
