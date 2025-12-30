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
  ShoppingCart,
  Bot,
  Calculator,
  Shield,
  Landmark,
  Receipt,
  FolderOpen,
  type LucideIcon,
} from "lucide-react"
import { ModuleKey } from "@/lib/modules/definitions"

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  badge?: number
  children?: { name: string; href: string }[]
  module?: ModuleKey
  showFor?: string[] // Legal forms that should see this item (e.g., ["OBRT_PAUSAL"])
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    title: "Pregled",
    items: [
      {
        name: "Nadzorna ploča",
        href: "/dashboard",
        icon: LayoutDashboard,
        module: "platform-core",
      },
    ],
  },
  {
    title: "Financije",
    items: [
      { name: "Blagajna", href: "/pos", icon: ShoppingCart, module: "pos" },
      { name: "Računi", href: "/invoices", icon: FileText, module: "invoicing" },
      { name: "Troškovi", href: "/expenses", icon: Receipt, module: "expenses" },
      {
        name: "Dokumenti",
        href: "/documents",
        icon: FolderOpen,
        module: "documents",
        children: [
          { name: "Svi dokumenti", href: "/documents" },
          { name: "E-Računi", href: "/documents?category=e-invoice" },
          { name: "Bankovni izvodi", href: "/documents?category=bank-statement" },
          { name: "Troškovi", href: "/documents?category=expense" },
          { name: "Ponavljajući troškovi", href: "/expenses/recurring" },
        ],
      },
      { name: "Banka", href: "/banking", icon: Building2, module: "banking" },
      {
        name: "Paušalni Hub",
        href: "/pausalni",
        icon: Calculator,
        module: "pausalni",
        showFor: ["OBRT_PAUSAL"],
      },
      {
        name: "Porez na dobit",
        href: "/corporate-tax",
        icon: Landmark,
        module: "corporate-tax",
        showFor: ["DOO", "JDOO"],
      },
      {
        name: "Izvještaji",
        href: "/reports",
        icon: BarChart3,
        module: "reports-basic",
        children: [
          { name: "Svi izvještaji", href: "/reports" },
          { name: "PO-SD izvještaj", href: "/reports/pausalni-obrt" },
        ],
      },
    ],
  },
  {
    title: "Suradnja",
    items: [
      { name: "Računovođa", href: "/accountant", icon: UserCog, module: "platform-core" },
      { name: "Podrška", href: "/support", icon: LifeBuoy, module: "platform-core" },
    ],
  },
  {
    title: "Podaci",
    items: [
      { name: "Kontakti", href: "/contacts", icon: Users },
      { name: "Proizvodi", href: "/products", icon: Package },
      { name: "Article Agent", href: "/article-agent", icon: Bot, module: "ai-assistant" },
    ],
  },
  {
    title: "Sustav",
    items: [
      {
        name: "Usklađenost",
        href: "/compliance",
        icon: Shield,
        module: "platform-core",
        showFor: ["OBRT_PAUSAL", "OBRT_REAL", "OBRT_VAT", "DOO", "JDOO"],
      },
      { name: "Postavke", href: "/settings", icon: Settings, module: "platform-core" },
    ],
  },
]

// Helper to check if a path matches a nav item (including children)
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true
  if (item.children?.some((child) => pathname === child.href)) return true
  // Check if pathname starts with item.href (for nested routes)
  if (pathname.startsWith(item.href + "/")) return true
  return false
}
