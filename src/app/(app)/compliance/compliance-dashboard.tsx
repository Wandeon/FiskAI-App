"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Building2,
  FileText,
  XCircle,
} from "lucide-react"
import { format } from "date-fns"
import { hr } from "date-fns/locale"
import Link from "next/link"
import type { Company } from "@prisma/client"

export interface CertificateStatus {
  status: "active" | "expiring" | "expired" | "missing"
  validUntil: Date | null
  daysRemaining: number
}

export interface FiscalizationStats {
  total: number
  success: number
  lastSync: Date | null
}

export interface FiscalizedInvoice {
  id: string
  invoiceNumber: string
  issueDate: Date
  totalAmount: number
  jir: string
  zki: string | null
  fiscalizedAt: Date
  buyerName: string
}

export interface ComplianceData {
  certificateStatus: CertificateStatus
  fiscalizationStats: FiscalizationStats
  premisesCount: number
  recentInvoices: FiscalizedInvoice[]
}

interface ComplianceDashboardProps {
  data: ComplianceData
  company: Company
}

export function ComplianceDashboard({ data, company }: ComplianceDashboardProps) {
  const { certificateStatus, fiscalizationStats, premisesCount, recentInvoices } = data

  const getCertificateStatusBadge = () => {
    switch (certificateStatus.status) {
      case "active":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Aktivan
          </Badge>
        )
      case "expiring":
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="h-3 w-3 mr-1" />
            Ističe uskoro
          </Badge>
        )
      case "expired":
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Istekao
          </Badge>
        )
      case "missing":
        return (
          <Badge className="bg-gray-50 text-gray-700 border-gray-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Nedostaje
          </Badge>
        )
    }
  }

  const getChecklistItems = () => {
    const items = [
      {
        id: "certificate",
        label: "FINA certifikat učitan",
        completed: certificateStatus.status === "active" || certificateStatus.status === "expiring",
        link: "/settings/fiscalisation",
      },
      {
        id: "premises",
        label: "Poslovni prostori konfigurirani",
        completed: premisesCount > 0,
        link: "/settings/premises",
      },
      {
        id: "sandbox",
        label: "Testno fiskaliziranje izvršeno",
        completed: fiscalizationStats.total > 0,
        link: "/settings/fiscalisation",
      },
    ]

    return items
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Certificate Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">FINA Certifikat</CardTitle>
            <Shield className="h-4 w-4 text-[var(--muted)]" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getCertificateStatusBadge()}
              {certificateStatus.validUntil && (
                <p className="text-xs text-[var(--muted)]">
                  Vrijedi do{" "}
                  {format(new Date(certificateStatus.validUntil), "d. MMM yyyy", { locale: hr })}
                  {certificateStatus.daysRemaining > 0 && (
                    <span className="block">
                      ({certificateStatus.daysRemaining} dana preostalo)
                    </span>
                  )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fiscalized Invoices Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fiskalizirani računi</CardTitle>
            <FileText className="h-4 w-4 text-[var(--muted)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fiscalizationStats.total}</div>
            <p className="text-xs text-[var(--muted)]">{fiscalizationStats.success} uspješnih</p>
          </CardContent>
        </Card>

        {/* Last Sync */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zadnja sinkronizacija</CardTitle>
            <Clock className="h-4 w-4 text-[var(--muted)]" />
          </CardHeader>
          <CardContent>
            {fiscalizationStats.lastSync ? (
              <>
                <div className="text-sm font-medium">
                  {format(new Date(fiscalizationStats.lastSync), "d. MMM yyyy", { locale: hr })}
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {format(new Date(fiscalizationStats.lastSync), "HH:mm", { locale: hr })}
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">Nema podataka</p>
            )}
          </CardContent>
        </Card>

        {/* Business Premises Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Poslovni prostori</CardTitle>
            <Building2 className="h-4 w-4 text-[var(--muted)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{premisesCount}</div>
            <p className="text-xs text-[var(--muted)]">Aktivnih prostora</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Fiscalized Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Nedavno fiskalizirani računi</CardTitle>
            <CardDescription>Zadnjih 10 računa s JIR identifikatorima</CardDescription>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <div className="text-center py-8 text-[var(--muted)]">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nema fiskaliziranih računa</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-start justify-between p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-secondary)]/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {invoice.invoiceNumber}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {invoice.totalAmount.toFixed(2)} EUR
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-1">{invoice.buyerName}</p>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        {format(new Date(invoice.issueDate), "d. MMM yyyy", { locale: hr })}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="text-xs bg-[var(--surface-secondary)] px-2 py-0.5 rounded">
                          JIR: {invoice.jir.substring(0, 20)}...
                        </code>
                      </div>
                    </div>
                    <a
                      href={`https://porezna-uprava.gov.hr/blagajne/_layouts/15/DohvatRacuna.aspx?jir=${invoice.jir}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-3"
                    >
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance Checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance popis</CardTitle>
            <CardDescription>Obvezni koraci za fiskalizaciju gotovine</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getChecklistItems().map((item) => (
                <Link
                  key={item.id}
                  href={item.link}
                  className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-secondary)]/50 transition-colors"
                >
                  <div
                    className={`rounded-full p-1 ${
                      item.completed ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-400"
                    }`}
                  >
                    {item.completed ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-current" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        item.completed ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {item.label}
                    </p>
                  </div>
                </Link>
              ))}

              <div className="mt-6 rounded-xl bg-blue-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900">Važni datumi</p>
                    <ul className="mt-2 space-y-1 text-xs text-blue-800">
                      <li>
                        • <strong>1. siječnja 2026.</strong> - Obveza e-računa (B2B)
                      </li>
                      <li>
                        • <strong>1. srpnja 2026.</strong> - Obveza e-računa (B2G)
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {company.fiscalEnabled && (
                <div className="rounded-xl bg-emerald-50 p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-900">
                        Fiskalizacija aktivna
                      </p>
                      <p className="text-xs text-emerald-800 mt-1">
                        Vaša tvrtka koristi{" "}
                        <strong>
                          {company.fiscalEnvironment === "PROD" ? "produkcijsko" : "sandbox"}
                        </strong>{" "}
                        okruženje
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
