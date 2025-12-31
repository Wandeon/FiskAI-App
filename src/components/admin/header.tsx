"use client"

import { Bell, User, Building2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface AdminHeaderProps {
  totalTenants?: number
  alertsCount?: number
}

export function AdminHeader({ totalTenants, alertsCount }: AdminHeaderProps) {
  return (
    <header className="h-16 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between px-6">
      <div className="flex items-center gap-6">
        <h2 className="text-lg font-semibold">Admin Portal</h2>

        {/* Quick Stats */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          {totalTenants !== undefined && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-info-bg rounded-lg">
              <Building2 className="h-4 w-4 text-info-icon" />
              <span className="font-medium text-info-text">{totalTenants}</span>
              <span className="text-info-text">Tenants</span>
            </div>
          )}

          {alertsCount !== undefined && alertsCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-danger-bg rounded-lg">
              <AlertTriangle className="h-4 w-4 text-danger-icon" />
              <span className="font-medium text-danger-text">{alertsCount}</span>
              <span className="text-danger-text">Alerts</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {alertsCount !== undefined && alertsCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {alertsCount > 9 ? "9+" : alertsCount}
            </Badge>
          )}
        </Button>
        <Button variant="ghost" size="icon">
          <User className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}
