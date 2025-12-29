"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Shield, ArrowRight } from "lucide-react"
import Link from "next/link"
import type { CertificateStatus, FiscalizationStats } from "@/lib/compliance/data"
import { getStatusAriaLabel } from "@/lib/a11y"

interface ComplianceStatusCardProps {
  certificate: CertificateStatus
  stats: FiscalizationStats
}

export function ComplianceStatusCard({ certificate, stats }: ComplianceStatusCardProps) {
  const isHealthy = certificate.status === "active" && stats.successRate >= 95

  // Generate status text and description for accessibility
  const getStatusText = () => {
    switch (certificate.status) {
      case "active":
        return { text: "Aktivan", desc: "Certifikat je aktivan i valjan" }
      case "expiring":
        return { text: `${certificate.daysRemaining}d`, desc: `Certifikat ističe za ${certificate.daysRemaining} dana` }
      case "expired":
        return { text: "Istekao", desc: "Certifikat je istekao, potrebna obnova" }
      default:
        return { text: "Nedostaje", desc: "Certifikat nije postavljen" }
    }
  }
  const statusInfo = getStatusText()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Fiskalizacija</CardTitle>
        <Shield
          className={`h-4 w-4 ${isHealthy ? "text-green-600" : "text-amber-500"}`}
          aria-hidden="true"
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Certifikat</span>
          <Badge
            variant={certificate.status === "active" ? "default" : "destructive"}
            status={statusInfo.text}
            statusDescription={statusInfo.desc}
          >
            {statusInfo.text}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Danas</span>
          <span className="text-sm font-medium">{stats.todayCount} računa</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Uspješnost</span>
          <span
            className={`text-sm font-medium ${stats.successRate >= 95 ? "text-green-600" : "text-amber-600"}`}
          >
            {stats.successRate.toFixed(1)}%
          </span>
        </div>

        <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
          <Link href="/compliance">
            Detalji
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
