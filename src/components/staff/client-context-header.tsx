"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeft,
  Building2,
  FileText,
  BarChart3,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ClientContextHeaderProps {
  clientId: string
  clientName: string
  clientOib: string | null
  legalForm: string | null
}

const clientNavigation = [
  { name: "Overview", href: "", icon: LayoutDashboard },
  { name: "E-Invoices", href: "/e-invoices", icon: FileText },
  { name: "Documents", href: "/documents", icon: FolderOpen },
  { name: "Messages", href: "/messages", icon: MessageSquare },
  { name: "Reports", href: "/reports", icon: BarChart3 },
]

const legalFormLabels: Record<string, string> = {
  OBRT_PAUSAL: "Pausalni obrt",
  OBRT_REAL: "Obrt (stvarni)",
  OBRT_VAT: "Obrt (PDV)",
  JDOO: "j.d.o.o.",
  DOO: "d.o.o.",
}

export function StaffClientContextHeader({
  clientId,
  clientName,
  clientOib,
  legalForm,
}: ClientContextHeaderProps) {
  const pathname = usePathname()
  const basePath = `/clients/${clientId}`

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      {/* Client Info Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/clients"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to clients
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">{clientName}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {clientOib && <span>OIB: {clientOib}</span>}
                {legalForm && (
                  <Badge variant="outline" className="text-xs">
                    {legalFormLabels[legalForm] || legalForm}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <Badge variant="secondary" className="bg-accent text-accent-foreground">
          Staff Context
        </Badge>
      </div>

      {/* Client Navigation */}
      <nav className="flex gap-1 border-t pt-4">
        {clientNavigation.map((item) => {
          const fullPath = basePath + item.href
          const isActive = item.href === "" ? pathname === basePath : pathname.startsWith(fullPath)

          return (
            <Link
              key={item.name}
              href={fullPath}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
