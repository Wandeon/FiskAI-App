"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CreditCard, UserPlus, AlertTriangle, Shield, CheckCircle } from "lucide-react"
import type { AdminMetrics, OnboardingFunnel, ComplianceHealth } from "@/lib/admin/metrics"

interface AdminDashboardProps {
  metrics: AdminMetrics
  funnel: OnboardingFunnel
  compliance: ComplianceHealth
}

export function AdminDashboard({ metrics, funnel, compliance }: AdminDashboardProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Tenants" value={metrics.totalTenants} icon={Users} />
        <MetricCard
          title="Active Subscriptions"
          value={metrics.activeSubscriptions}
          icon={CreditCard}
        />
        <MetricCard title="This Week Signups" value={metrics.thisWeekSignups} icon={UserPlus} />
        <MetricCard
          title="Needs Help"
          value={metrics.needsHelp}
          icon={AlertTriangle}
          variant={metrics.needsHelp > 0 ? "warning" : "default"}
        />
      </div>

      {/* Onboarding Funnel */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <FunnelStep label="Started" value={funnel.started} percentage={100} />
            <FunnelStep
              label="Step 2"
              value={funnel.step2}
              percentage={funnel.started > 0 ? (funnel.step2 / funnel.started) * 100 : 0}
            />
            <FunnelStep
              label="Step 3"
              value={funnel.step3}
              percentage={funnel.started > 0 ? (funnel.step3 / funnel.started) * 100 : 0}
            />
            <FunnelStep
              label="Step 4"
              value={funnel.step4}
              percentage={funnel.started > 0 ? (funnel.step4 / funnel.started) * 100 : 0}
            />
            <FunnelStep
              label="Completed"
              value={funnel.completed}
              percentage={funnel.started > 0 ? (funnel.completed / funnel.started) * 100 : 0}
            />
            <FunnelStep
              label="1st Invoice"
              value={funnel.firstInvoice}
              percentage={funnel.started > 0 ? (funnel.firstInvoice / funnel.started) * 100 : 0}
            />
          </div>
        </CardContent>
      </Card>

      {/* Compliance Health */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Health</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{compliance.certificatesActive}</p>
              <p className="text-sm text-muted-foreground">Active Certificates</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{compliance.certificatesExpiring}</p>
              <p className="text-sm text-muted-foreground">Expiring Soon</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{compliance.fiscalizedToday}</p>
              <p className="text-sm text-muted-foreground">Fiscalized Today</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  variant = "default",
}: {
  title: string
  value: number
  icon: React.ElementType
  variant?: "default" | "warning"
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon
          className={`h-4 w-4 ${variant === "warning" ? "text-amber-500" : "text-muted-foreground"}`}
        />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${variant === "warning" ? "text-amber-600" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}

function FunnelStep({
  label,
  value,
  percentage,
}: {
  label: string
  value: number
  percentage: number
}) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</div>
    </div>
  )
}
