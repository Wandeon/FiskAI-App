"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Calendar,
  CheckSquare,
  MessageSquare,
  FileText,
  Settings,
  UserPlus,
  Package,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStaffClient } from "@/contexts/staff-client-context"

const navigation = [
  { name: "Dashboard", href: "/staff-dashboard", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Bulk Operations", href: "/bulk-operations", icon: Package },
  { name: "Invitations", href: "/invitations", icon: UserPlus },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Tickets", href: "/tickets", icon: MessageSquare },
  { name: "Documents", href: "/documents", icon: FileText },
]

export function StaffSidebar() {
  const pathname = usePathname()
  const { currentClient, clearClient } = useStaffClient()

  return (
    <aside className="w-64 bg-surface-2 text-foreground flex flex-col">
      <div className="p-4 border-b border-default">
        <h1 className="text-xl font-bold">FiskAI Staff</h1>
      </div>

      {currentClient && (
        <div className="p-4 bg-info-bg border-b border-default">
          <div className="text-xs text-info-text mb-1">Working as:</div>
          <div className="font-medium truncate">{currentClient.name}</div>
          <button
            onClick={clearClient}
            className="text-xs text-info-text hover:text-foreground mt-2"
          >
            ← Back to overview
          </button>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-surface-1 text-foreground"
                  : "text-secondary hover:bg-surface hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-default">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-secondary hover:bg-surface hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
