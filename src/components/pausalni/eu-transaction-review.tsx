"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, CheckCircle2, XCircle, Globe, Calendar, Building2, Banknote } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/format"
import { EU_COUNTRY_CODES, EU_COUNTRY_NAMES } from "@/lib/pausalni/constants"

interface EuTransaction {
  id: string
  bankTransactionId: string
  counterpartyName: string
  counterpartyCountry: string | null
  transactionDate: string
  amount: string
  currency: string
  detectionMethod: string
  confidenceScore: number
  userConfirmed: boolean
}

interface Props {
  companyId: string
}

export function EuTransactionReview({ companyId }: Props) {
  const [transactions, setTransactions] = useState<EuTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedCountries, setSelectedCountries] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchUnconfirmedTransactions()
  }, [])

  async function fetchUnconfirmedTransactions() {
    try {
      const res = await fetch("/api/pausalni/eu-transactions?confirmed=false")
      const data = await res.json()
      setTransactions(data.transactions || [])

      // Initialize country selections with detected countries
      const initialCountries: Record<string, string> = {}
      data.transactions?.forEach((tx: EuTransaction) => {
        if (tx.counterpartyCountry) {
          initialCountries[tx.id] = tx.counterpartyCountry
        }
      })
      setSelectedCountries(initialCountries)
    } catch (error) {
      console.error("Failed to fetch EU transactions:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleConfirm(transactionId: string) {
    const country = selectedCountries[transactionId]
    if (!country) {
      alert("Molimo odaberite državu")
      return
    }

    setProcessingId(transactionId)
    try {
      const res = await fetch(`/api/pausalni/eu-transactions/${transactionId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isEu: true,
          country,
        }),
      })

      if (res.ok) {
        // Remove from list
        setTransactions((prev) => prev.filter((tx) => tx.id !== transactionId))
      } else {
        console.error("Failed to confirm transaction")
      }
    } catch (error) {
      console.error("Error confirming transaction:", error)
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(transactionId: string) {
    setProcessingId(transactionId)
    try {
      const res = await fetch(`/api/pausalni/eu-transactions/${transactionId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isEu: false,
        }),
      })

      if (res.ok) {
        // Remove from list
        setTransactions((prev) => prev.filter((tx) => tx.id !== transactionId))
      } else {
        console.error("Failed to reject transaction")
      }
    } catch (error) {
      console.error("Error rejecting transaction:", error)
    } finally {
      setProcessingId(null)
    }
  }

  function getConfidenceBadge(score: number) {
    if (score >= 90) {
      return (
        <Badge variant="default" className="bg-success">
          Visoka sigurnost
        </Badge>
      )
    } else if (score >= 70) {
      return <Badge className="bg-warning">Srednja sigurnost</Badge>
    } else {
      return <Badge variant="secondary">Niska sigurnost</Badge>
    }
  }

  function getDetectionMethodLabel(method: string) {
    const labels: Record<string, string> = {
      IBAN: "Detektirano iz IBAN-a",
      VENDOR_DB: "Poznati dobavljač",
      UNKNOWN: "Potrebna provjera",
    }
    return labels[method] || method
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            EU transakcije za potvrdu
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-success-icon mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nema transakcija za potvrdu. Sve EU transakcije su potvrđene!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="border border-amber-500/30 bg-warning/5 rounded-lg p-4 space-y-4"
                >
                  {/* Transaction Details */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{tx.counterpartyName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(tx.transactionDate)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Banknote className="h-4 w-4" />
                          <span className="font-semibold text-lg text-foreground">
                            {formatCurrency(parseFloat(tx.amount))}
                          </span>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        {getConfidenceBadge(tx.confidenceScore)}
                        <p className="text-xs text-muted-foreground">
                          {getDetectionMethodLabel(tx.detectionMethod)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-amber-500/20 pt-4">
                    <p className="text-sm font-medium mb-3">
                      Je li ovo transakcija s EU dobavljačem?
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Odaberite državu EU
                        </label>
                        <Select
                          value={selectedCountries[tx.id] || ""}
                          onValueChange={(value) =>
                            setSelectedCountries((prev) => ({
                              ...prev,
                              [tx.id]: value,
                            }))
                          }
                          disabled={processingId === tx.id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Odaberite državu..." />
                          </SelectTrigger>
                          <SelectContent>
                            {EU_COUNTRY_CODES.map((code) => (
                              <SelectItem key={code} value={code}>
                                {EU_COUNTRY_NAMES[code]} ({code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 sm:items-end">
                        <Button
                          variant="default"
                          onClick={() => handleConfirm(tx.id)}
                          disabled={processingId === tx.id || !selectedCountries[tx.id]}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {processingId === tx.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                          )}
                          Potvrdi EU
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleReject(tx.id)}
                          disabled={processingId === tx.id}
                        >
                          {processingId === tx.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                          )}
                          Nije EU
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
