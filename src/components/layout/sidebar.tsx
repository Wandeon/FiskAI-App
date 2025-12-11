"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Nadzorna ploča", href: "/dashboard", icon: "📊" },
  { name: "Dokumenti", href: "/invoices", icon: "📋" },
  { name: "E-Računi", href: "/e-invoices", icon: "📄" },
  { name: "Kontakti", href: "/contacts", icon: "👥" },
  { name: "Proizvodi", href: "/products", icon: "📦" },
  { name: "Postavke", href: "/settings", icon: "⚙️" },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r border-gray-200 bg-white">
      <nav className="flex flex-col gap-1 p-4">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
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
  )
}
