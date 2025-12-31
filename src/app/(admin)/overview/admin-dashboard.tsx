"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  CreditCard,
  UserPlus,
  AlertTriangle,
  Shield,
  CheckCircle,
  ExternalLink,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import type {
  AdminMetrics,
  OnboardingFunnel,
  ComplianceHealth,
  RecentSignup,
} from "@/lib/admin/metrics"

interface AdminDashboardProps {
  metrics: AdminMetrics
  funnel: OnboardingFunnel
  compliance: ComplianceHealth
  recentSignups: RecentSignup[]
}

export function AdminDashboard({
  metrics,
  funnel,
  compliance,
  recentSignups,
}: AdminDashboardProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Button asChild variant="default">
          <Link href="/tenants?sortField=createdAt&sortOrder=desc">
            <UserPlus className="h-4 w-4 mr-2" />
            View Recent Signups
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/alerts?level=critical">
            <AlertTriangle className="h-4 w-4 mr-2" />
            View Critical Alerts
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/tenants">
            <Users className="h-4 w-4 mr-2" />
            Manage Tenants
          </Link>
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Tenants"
          value={metrics.totalTenants}
          icon={Users}
          href="/tenants"
        />
        <MetricCard
          title="Active Subscriptions"
          value={metrics.activeSubscriptions}
          icon={CreditCard}
          href="/tenants?subscriptionStatus=active"
        />
        <MetricCard
          title="This Week Signups"
          value={metrics.thisWeekSignups}
          icon={UserPlus}
          href="/tenants?sortField=createdAt&sortOrder=desc"
        />
        <MetricCard
          title="Needs Help"
          value={metrics.needsHelp}
          icon={AlertTriangle}
          variant={metrics.needsHelp > 0 ? "warning" : "default"}
          href="/alerts?level=critical"
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
          <Link
            href="/tenants?flags=cert-active"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
          >
            <Shield className="h-8 w-8 text-success-icon" />
            <div className="flex-1">
              <p className="text-2xl font-bold">{compliance.certificatesActive}</p>
              <p className="text-sm text-muted-foreground">Active Certificates</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/tenants?flags=cert-expiring"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
          >
            <AlertTriangle className="h-8 w-8 text-warning-icon" />
            <div className="flex-1">
              <p className="text-2xl font-bold">{compliance.certificatesExpiring}</p>
              <p className="text-sm text-muted-foreground">Expiring Soon</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/tenants?sortField=fiscalizedAt&sortOrder=desc"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
          >
            <CheckCircle className="h-8 w-8 text-info-icon" />
            <div className="flex-1">
              <p className="text-2xl font-bold">{compliance.fiscalizedToday}</p>
              <p className="text-sm text-muted-foreground">Fiscalized Today</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* Recent Signups */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Signups</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/tenants?sortField=createdAt&sortOrder=desc">
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentSignups.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No recent signups</div>
          ) : (
            <div className="space-y-3">
              {recentSignups.map((signup) => (
                <Link
                  key={signup.id}
                  href={`/tenants/${signup.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{signup.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {signup.legalForm}
                      </Badge>
                      {signup.subscriptionStatus && (
                        <Badge
                          variant={
                            signup.subscriptionStatus === "active"
                              ? "default"
                              : signup.subscriptionStatus === "trialing"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {signup.subscriptionStatus}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Signed up {signup.createdAt.toLocaleString("hr-HR")}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
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
  href,
}: {
  title: string
  value: number
  icon: React.ElementType
  variant?: "default" | "warning"
  href?: string
}) {
  const content = (
    <>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon
          className={`h-4 w-4 ${variant === "warning" ? "text-warning-icon" : "text-muted-foreground"}`}
        />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${variant === "warning" ? "text-warning-text" : ""}`}>
          {value}
        </div>
      </CardContent>
    </>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        <Card className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]">
          {content}
        </Card>
      </Link>
    )
  }

  return <Card>{content}</Card>
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
