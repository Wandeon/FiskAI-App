"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Mail, Gift, Download, Flag } from "lucide-react"
import type { TenantDetail } from "@/lib/admin/tenant-health"

export function TenantDetailView({ tenant }: { tenant: TenantDetail }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tenant.profile.name}</h1>
          <p className="text-muted-foreground">OIB: {tenant.profile.oib}</p>
        </div>
        <div className="flex gap-2">
          {tenant.flags.map((flag) => (
            <Badge key={flag} variant="destructive">
              {flag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Profile */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Legal Form: {tenant.profile.legalForm}</p>
            <p>VAT: {tenant.profile.isVatPayer ? "Yes" : "No"}</p>
            <p>Since: {tenant.profile.createdAt.toLocaleDateString()}</p>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Plan: {tenant.subscription.plan}</p>
            <Badge>{tenant.subscription.status}</Badge>
          </CardContent>
        </Card>

        {/* Owner */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Owner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{tenant.owner?.email || "No owner"}</p>
            <p className="text-muted-foreground">
              Last login: {tenant.owner?.lastLoginAt?.toLocaleDateString() || "Never"}
            </p>
          </CardContent>
        </Card>

        {/* Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Onboarding:{" "}
              {tenant.health.onboardingComplete
                ? "Complete"
                : `Step ${tenant.health.onboardingStep}`}
            </p>
            <p>Competence: {tenant.health.competenceLevel}</p>
            <p>30-day activity: {tenant.health.thirtyDayActivity} invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* 60k Limit Tracker */}
      <Card>
        <CardHeader>
          <CardTitle>60k Limit Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Current: €{tenant.limitTracker.currentRevenue.toFixed(2)}</span>
            <span>Limit: €{tenant.limitTracker.limit.toLocaleString()}</span>
          </div>
          <Progress
            value={Math.min(tenant.limitTracker.percentage, 100)}
            className={
              tenant.limitTracker.status === "critical"
                ? "bg-red-200"
                : tenant.limitTracker.status === "warning"
                  ? "bg-amber-200"
                  : ""
            }
          />
          <p className="text-sm text-muted-foreground">
            Projected yearly: €{tenant.limitTracker.projectedYearly.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" size="sm">
            <Mail className="mr-2 h-4 w-4" />
            Email
          </Button>
          <Button variant="outline" size="sm">
            <Gift className="mr-2 h-4 w-4" />
            Gift Module
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Flag className="mr-2 h-4 w-4" />
            Flag
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
