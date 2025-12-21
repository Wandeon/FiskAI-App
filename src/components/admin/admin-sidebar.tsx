"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Server,
  MessageSquare,
  Settings,
  FileText,
  AlertTriangle,
  Mail,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getNavAriaLabel } from "@/lib/a11y"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Tenants", href: "/tenants", icon: Building2 },
  { name: "Staff", href: "/staff", icon: Users },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
  { name: "Digest Preview", href: "/digest", icon: Mail },
  { name: "Subscriptions", href: "/subscriptions", icon: CreditCard },
  { name: "Services", href: "/services", icon: Server },
  { name: "Support", href: "/support", icon: MessageSquare },
  { name: "Audit Log", href: "/audit", icon: FileText },
]

interface AdminSidebarProps {
  defaultCollapsed?: boolean
}

export function AdminSidebar({ defaultCollapsed = false }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const pathname = usePathname()

  return (
    <aside
      id="sidebar-nav"
      aria-label="Admin navigation"
      className={cn(
        "flex flex-col bg-slate-950 text-white transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800" role="banner">
        {!isCollapsed && (
          <>
            <h1 className="text-xl font-bold">FiskAI Admin</h1>
            <p className="text-xs text-slate-400">Platform Management</p>
          </>
        )}
        {isCollapsed && (
          <div className="text-xl font-bold text-center" aria-label="FiskAI Admin">
            FA
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Primary navigation">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              aria-label={getNavAriaLabel(item.name, isActive, "en")}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                isActive
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white",
                isCollapsed && "justify-center"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-4 space-y-2" role="contentinfo">
        {/* Settings Link */}
        <Link
          href="/settings"
          title={isCollapsed ? "Settings" : undefined}
          aria-label="Settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-900 hover:text-white transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
            isCollapsed && "justify-center"
          )}
        >
          <Settings className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {!isCollapsed && <span>Settings</span>}
        </Link>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
          className={cn(
            "w-full text-slate-400 hover:text-white hover:bg-slate-900",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
            isCollapsed && "px-0"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" aria-hidden="true" />
              Collapse
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}
