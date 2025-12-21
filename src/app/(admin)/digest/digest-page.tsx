"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Mail,
  Send,
  Eye,
  Users,
  CreditCard,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react"
import type { WeeklyDigestData } from "@/lib/admin/weekly-digest"
import { formatDigestEmail } from "@/lib/admin/weekly-digest"
import { toast } from "@/lib/toast"

interface DigestPageProps {
  digestData: WeeklyDigestData
}

export function DigestPage({ digestData }: DigestPageProps) {
  const [isSending, setIsSending] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const handleSendNow = async () => {
    setIsSending(true)
    try {
      const response = await fetch("/api/admin/send-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestData }),
      })

      if (!response.ok) {
        throw new Error("Failed to send digest")
      }

      toast.success(
        "Digest sent successfully",
        "The weekly digest has been sent to admin recipients"
      )
    } catch (error) {
      toast.error(
        "Failed to send digest",
        error instanceof Error ? error.message : "An error occurred"
      )
    } finally {
      setIsSending(false)
    }
  }

  const weekStartStr = digestData.weekStart.toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
  })
  const weekEndStr = digestData.weekEnd.toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Weekly Digest Preview</h1>
          <p className="text-muted-foreground">
            {weekStartStr} - {weekEndStr}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)} className="gap-2">
            <Eye className="h-4 w-4" />
            {showPreview ? "Hide" : "Show"} HTML Preview
          </Button>
          <Button onClick={handleSendNow} disabled={isSending} className="gap-2">
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{digestData.totalTenants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{digestData.activeSubscriptions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              New This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{digestData.newCustomers.count}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{digestData.actionItems.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* New Customers */}
      <Card>
        <CardHeader>
          <CardTitle>New Customers ({digestData.newCustomers.count})</CardTitle>
        </CardHeader>
        <CardContent>
          {digestData.newCustomers.count === 0 ? (
            <p className="text-muted-foreground text-center py-4">No new customers this week</p>
          ) : (
            <div className="space-y-3">
              {digestData.newCustomers.list.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">{customer.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={customer.subscriptionStatus === "active" ? "default" : "secondary"}
                    >
                      {customer.subscriptionStatus}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {customer.createdAt.toLocaleDateString("hr-HR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MRR Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>MRR Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Current MRR</span>
            <span className="text-2xl font-bold">
              €{digestData.mrr.currentMRR.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-green-600">New MRR this week</span>
            <span className="text-lg font-semibold text-green-600">+€{digestData.mrr.newMRR}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-red-600">Churned MRR this week</span>
            <span className="text-lg font-semibold text-red-600">
              -€{digestData.mrr.churnedMRR}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Health */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{digestData.compliance.certificatesActive}</p>
                <p className="text-sm text-muted-foreground">Active Certificates</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{digestData.compliance.certificatesExpiring}</p>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{digestData.compliance.fiscalizedThisWeek}</p>
                <p className="text-sm text-muted-foreground">Fiscalized This Week</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{digestData.compliance.successRate}%</p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Funnel */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div className="text-center">
              <p className="text-2xl font-bold">{digestData.onboardingFunnel.started}</p>
              <p className="text-sm text-muted-foreground">Started</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{digestData.onboardingFunnel.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {digestData.onboardingFunnel.conversionRate}%
              </p>
              <p className="text-sm text-muted-foreground">Conversion Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {digestData.actionItems.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Critical Action Items ({digestData.actionItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {digestData.actionItems.map((alert) => (
              <div key={alert.id} className="p-3 bg-white border border-red-200 rounded-lg">
                <p className="font-medium text-red-900">{alert.title}</p>
                <p className="text-sm text-muted-foreground">
                  {alert.companyName}: {alert.description}
                </p>
                {alert.autoAction && (
                  <p className="text-sm text-blue-600 mt-1">→ {alert.autoAction}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* HTML Preview */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>HTML Email Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <iframe
                srcDoc={formatDigestEmail(digestData)}
                className="w-full h-[800px]"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
