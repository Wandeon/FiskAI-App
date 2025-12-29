"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  CreditCard,
  Loader2,
} from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { PaymentSlipModal } from "./payment-slip-modal"
import { OBLIGATION_LABELS, CROATIAN_MONTHS } from "@/lib/pausalni/constants"

interface Obligation {
  id: string
  obligationType: string
  periodMonth: number
  periodYear: number
  amount: string
  dueDate: string
  status: string
  paidDate: string | null
  matchType: string | null
}

interface Summary {
  totalPending: number
  totalDueSoon: number
  totalOverdue: number
  totalPaid: number
  amountPending: number
  amountDueSoon: number
  amountOverdue: number
  amountPaid: number
}

interface Props {
  companyId: string
}

export function ObligationTimeline({ companyId }: Props) {
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedObligation, setSelectedObligation] = useState<Obligation | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    fetchObligations()
  }, [])

  async function fetchObligations() {
    try {
      const res = await fetch("/api/pausalni/obligations")
      const data = await res.json()
      setObligations(data.obligations || [])
      setSummary(data.summary || null)
    } catch (error) {
      console.error("Failed to fetch obligations:", error)
    } finally {
      setIsLoading(false)
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "PAID":
        return <CheckCircle2 className="h-5 w-5 text-success-icon" />
      case "DUE_SOON":
        return <Clock className="h-5 w-5 text-warning-icon" />
      case "OVERDUE":
        return <AlertTriangle className="h-5 w-5 text-danger-icon" />
      default:
        return <Calendar className="h-5 w-5 text-muted-foreground" />
    }
  }

  function getStatusBadge(status: string, dueDate: string) {
    const due = new Date(dueDate)
    const today = new Date()
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    switch (status) {
      case "PAID":
        return (
          <Badge variant="default" className="bg-success">
            Plaćeno
          </Badge>
        )
      case "DUE_SOON":
        return <Badge className="bg-warning">Za {daysUntil} dana</Badge>
      case "OVERDUE":
        return <Badge variant="destructive">Prošao rok!</Badge>
      default:
        return <Badge variant="secondary">Za {daysUntil} dana</Badge>
    }
  }

  function groupObligationsByMonth(obligations: Obligation[]) {
    const grouped: Record<string, Obligation[]> = {}

    for (const ob of obligations) {
      const dueDate = new Date(ob.dueDate)
      const key = `${dueDate.getFullYear()}-${dueDate.getMonth()}`
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(ob)
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, obs]) => {
        const [year, month] = key.split("-").map(Number)
        return {
          year,
          month,
          label: `${CROATIAN_MONTHS[month].charAt(0).toUpperCase() + CROATIAN_MONTHS[month].slice(1)} ${year}`,
          obligations: obs.sort(
            (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          ),
        }
      })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const groupedObligations = groupObligationsByMonth(obligations)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Za platiti</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(summary.amountPending + summary.amountDueSoon)}
                  </p>
                </div>
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Uskoro dospijeva</p>
                  <p className="text-2xl font-bold text-warning-text">
                    {formatCurrency(summary.amountDueSoon)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-warning-icon" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Prekoračeno</p>
                  <p className="text-2xl font-bold text-danger-text">
                    {formatCurrency(summary.amountOverdue)}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-danger-icon" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Plaćeno</p>
                  <p className="text-2xl font-bold text-success-text">
                    {formatCurrency(summary.amountPaid)}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-success-icon" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Pregled obveza
          </CardTitle>
        </CardHeader>
        <CardContent>
          {groupedObligations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nema obveza za prikaz. Kliknite ispod za generiranje.
            </p>
          ) : (
            <div className="space-y-8">
              {groupedObligations.map(({ label, obligations: monthObs }) => (
                <div key={label}>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {label}
                  </h3>
                  <div className="space-y-3 ml-6 border-l-2 border-muted pl-6">
                    {monthObs.map((ob) => (
                      <div
                        key={ob.id}
                        className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
                          ob.status === "OVERDUE"
                            ? "bg-danger/10"
                            : ob.status === "DUE_SOON"
                              ? "bg-warning/10"
                              : ob.status === "PAID"
                                ? "bg-success/5"
                                : "bg-muted/30"
                        }`}
                      >
                        <div className="mt-0.5">{getStatusIcon(ob.status)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {OBLIGATION_LABELS[ob.obligationType] || ob.obligationType}
                            </span>
                            {getStatusBadge(ob.status, ob.dueDate)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Rok: {new Date(ob.dueDate).toLocaleDateString("hr-HR")}
                            {ob.status === "PAID" && ob.paidDate && (
                              <> • Plaćeno {new Date(ob.paidDate).toLocaleDateString("hr-HR")}</>
                            )}
                            {ob.matchType === "AUTO" && (
                              <>
                                {" "}
                                • <span className="text-success-text">Auto-matched</span>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(parseFloat(ob.amount))}</p>
                          {ob.status !== "PAID" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1"
                              onClick={() => {
                                setSelectedObligation(ob)
                                setShowPaymentModal(true)
                              }}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Uplatnica
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Slip Modal */}
      {showPaymentModal && selectedObligation && (
        <PaymentSlipModal
          obligation={selectedObligation}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedObligation(null)
          }}
        />
      )}
    </div>
  )
}
