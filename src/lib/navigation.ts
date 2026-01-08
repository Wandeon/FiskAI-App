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
  Command,
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
  legacy?: boolean // Mark legacy routes that will be deprecated
}

export const LEGACY_ROUTES = [
  "/dashboard",
  "/invoices",
  "/expenses",
  "/banking",
  "/contacts",
  "/products",
  "/pos",
  "/reports",
] as const

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    title: "Pregled",
    items: [
      {
        name: "Kontrolni centar",
        href: "/control-center",
        icon: Command,
        module: "platform-core",
      },
      {
        name: "Nadzorna ploča",
        href: "/dashboard",
        icon: LayoutDashboard,
        module: "platform-core",
        legacy: true,
      },
    ],
  },
  {
    title: "Financije",
    items: [
      { name: "Blagajna", href: "/pos", icon: ShoppingCart, module: "pos", legacy: true },
      { name: "Računi", href: "/invoices", icon: FileText, module: "invoicing", legacy: true },
      { name: "E-Računi", href: "/e-invoices", icon: Receipt, module: "e-invoicing" },
      { name: "Troškovi", href: "/expenses", icon: Receipt, module: "expenses", legacy: true },
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
      { name: "Banka", href: "/banking", icon: Building2, module: "banking", legacy: true },
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
        legacy: true,
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
      { name: "Kontakti", href: "/contacts", icon: Users, legacy: true },
      { name: "Proizvodi", href: "/products", icon: Package, legacy: true },
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
