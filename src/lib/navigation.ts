import {
  LayoutDashboard,
  FileText,
  Building2,
  BarChart3,
  Users,
  Package,
  Settings,
  UserCog,
  LifeBuoy,
  KeyRound,
  type LucideIcon
} from "lucide-react"

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  badge?: number
  children?: { name: string; href: string }[]
  module?: "invoicing" | "eInvoicing" | "expenses" | "banking" | "reports" | "settings"
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    title: "Pregled",
    items: [
      { name: "Nadzorna ploča", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Financije",
    items: [
      {
        name: "Dokumenti",
        href: "/documents",
        icon: FileText,
        module: "invoicing",
        children: [
          { name: "Svi dokumenti", href: "/documents" },
          { name: "Računi", href: "/documents?category=invoice" },
          { name: "E-Računi", href: "/documents?category=e-invoice" },
          { name: "Bankovni izvodi", href: "/documents?category=bank-statement" },
          { name: "Troškovi", href: "/documents?category=expense" },
        ]
      },
      { name: "Banka", href: "/banking", icon: Building2, module: "banking" },
      { name: "Izvještaji", href: "/reports", icon: BarChart3, module: "reports" },
    ],
  },
  {
    title: "Suradnja",
    items: [
      { name: "Računovođa", href: "/accountant", icon: UserCog },
      { name: "Podrška", href: "/support", icon: LifeBuoy },
    ],
  },
  {
    title: "Podaci",
    items: [
      { name: "Kontakti", href: "/contacts", icon: Users },
      { name: "Proizvodi", href: "/products", icon: Package },
    ],
  },
  {
    title: "Sustav",
    items: [
      { name: "Računovođe", href: "/settings/accountants", icon: KeyRound },
      { name: "Postavke", href: "/settings", icon: Settings, module: "settings" },
    ],
  },
]

// Helper to check if a path matches a nav item (including children)
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true
  if (item.children?.some(child => pathname === child.href)) return true
  // Check if pathname starts with item.href (for nested routes)
  if (pathname.startsWith(item.href + '/')) return true
  return false
}
