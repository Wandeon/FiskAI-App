import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Building2, ChevronRight, Search } from "lucide-react"
import { getTenants } from "@/lib/admin/queries"

// TODO: Database queries moved to @/lib/admin/queries for Clean Architecture compliance

export async function TenantsList() {
  const tenants = await getTenants()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">
            {tenants.length} registered compan{tenants.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search tenants..." className="pl-9 w-64" />
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {tenants.map((tenant) => (
          <Link key={tenant.id} href={`/tenants/${tenant.id}`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{tenant.name}</h3>
                    <Badge
                      variant={tenant.subscriptionStatus === "active" ? "default" : "secondary"}
                    >
                      {tenant.subscriptionStatus || "trial"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">OIB: {tenant.oib}</p>
                </div>

                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="text-center">
                    <div className="font-medium text-foreground">{tenant._count.users}</div>
                    <div className="text-xs">Users</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-foreground">{tenant._count.eInvoices}</div>
                    <div className="text-xs">Invoices</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-foreground">
                      {(tenant.entitlements as string[])?.length || 0}
                    </div>
                    <div className="text-xs">Modules</div>
                  </div>
                  <ChevronRight className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
