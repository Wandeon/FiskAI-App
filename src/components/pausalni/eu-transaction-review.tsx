"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Globe,
  Calendar,
  Building2,
  Banknote,
  Package,
  Briefcase,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/format"
import { EU_COUNTRY_CODES, EU_COUNTRY_NAMES, TRANSACTION_TYPES } from "@/lib/pausalni/constants"

interface EuTransaction {
  id: string
  bankTransactionId: string
  counterpartyName: string
  counterpartyCountry: string | null
  counterpartyVatId: string | null
  transactionDate: string
  amount: string
  currency: string
  detectionMethod: string
  confidenceScore: number
  userConfirmed: boolean
  transactionType: string | null
  viesValidated: boolean | null
  viesValid: boolean | null
}

interface Props {
  companyId: string
}

export function EuTransactionReview({ companyId }: Props) {
  const [transactions, setTransactions] = useState<EuTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [validatingViesId, setValidatingViesId] = useState<string | null>(null)
  const [selectedCountries, setSelectedCountries] = useState<Record<string, string>>({})
  const [selectedTypes, setSelectedTypes] = useState<Record<string, string>>({})
  const [vatIds, setVatIds] = useState<Record<string, string>>({})
  const [viesResults, setViesResults] = useState<Record<string, { valid: boolean; name?: string }>>(
    {}
  )

  useEffect(() => {
    fetchUnconfirmedTransactions()
  }, [])

  async function fetchUnconfirmedTransactions() {
    try {
      const res = await fetch("/api/pausalni/eu-transactions?confirmed=false")
      const data = await res.json()
      setTransactions(data.transactions || [])

      const initialCountries: Record<string, string> = {}
      const initialTypes: Record<string, string> = {}
      const initialVatIds: Record<string, string> = {}
      data.transactions?.forEach((tx: EuTransaction) => {
        if (tx.counterpartyCountry) {
          initialCountries[tx.id] = tx.counterpartyCountry
        }
        initialTypes[tx.id] = tx.transactionType || TRANSACTION_TYPES.SERVICES
        if (tx.counterpartyVatId) {
          initialVatIds[tx.id] = tx.counterpartyVatId
        }
      })
      setSelectedCountries(initialCountries)
      setSelectedTypes(initialTypes)
      setVatIds(initialVatIds)
    } catch (error) {
      console.error("Failed to fetch EU transactions:", error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleValidateVies(transactionId: string) {
    const vatId = vatIds[transactionId]
    if (!vatId) {
      alert("Molimo unesite PDV-ID broj")
      return
    }

    setValidatingViesId(transactionId)
    try {
      const res = await fetch("/api/pausalni/vies-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vatId }),
      })

      const data = await res.json()
      setViesResults((prev) => ({
        ...prev,
        [transactionId]: { valid: data.valid, name: data.name },
      }))
    } catch (error) {
      console.error("Error validating VAT ID:", error)
      setViesResults((prev) => ({
        ...prev,
        [transactionId]: { valid: false },
      }))
    } finally {
      setValidatingViesId(null)
    }
  }

  async function handleConfirm(transactionId: string) {
    const country = selectedCountries[transactionId]
    const transactionType = selectedTypes[transactionId]
    const vatId = vatIds[transactionId]

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
          transactionType,
          vatId,
          viesValidated: !!viesResults[transactionId],
          viesValid: viesResults[transactionId]?.valid,
        }),
      })

      if (res.ok) {
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
        body: JSON.stringify({ isEu: false }),
      })

      if (res.ok) {
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

  function getViesStatusBadge(transactionId: string) {
    const result = viesResults[transactionId]
    if (!result) return null

    if (result.valid) {
      return (
        <Badge variant="default" className="bg-success gap-1">
          <ShieldCheck className="h-3 w-3" />
          VIES potvrđen
        </Badge>
      )
    } else {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          VIES nevažeći
        </Badge>
      )
    }
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
          <CardDescription>
            Potvrdite vrstu transakcije (usluge ili roba) i provjerite PDV-ID kroz VIES sustav
          </CardDescription>
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
                  className="border border-warning/30 bg-warning/5 rounded-lg p-4 space-y-4"
                >
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
                        {getViesStatusBadge(tx.id)}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-warning/20 pt-4 space-y-4">
                    <p className="text-sm font-medium">Je li ovo transakcija s EU dobavljačem?</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Država EU
                        </label>
                        <Select
                          value={selectedCountries[tx.id] || ""}
                          onValueChange={(value) =>
                            setSelectedCountries((prev) => ({ ...prev, [tx.id]: value }))
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

                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Vrsta transakcije
                        </label>
                        <Select
                          value={selectedTypes[tx.id] || TRANSACTION_TYPES.SERVICES}
                          onValueChange={(value) =>
                            setSelectedTypes((prev) => ({ ...prev, [tx.id]: value }))
                          }
                          disabled={processingId === tx.id}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={TRANSACTION_TYPES.SERVICES}>
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4" />
                                Usluge
                              </div>
                            </SelectItem>
                            <SelectItem value={TRANSACTION_TYPES.GOODS}>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Roba (Intrastat)
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        PDV-ID dobavljača (opcionalno za VIES provjeru)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="npr. DE123456789"
                          value={vatIds[tx.id] || ""}
                          onChange={(e) =>
                            setVatIds((prev) => ({
                              ...prev,
                              [tx.id]: e.target.value.toUpperCase(),
                            }))
                          }
                          disabled={processingId === tx.id || validatingViesId === tx.id}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleValidateVies(tx.id)}
                          disabled={
                            processingId === tx.id || validatingViesId === tx.id || !vatIds[tx.id]
                          }
                        >
                          {validatingViesId === tx.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-4 w-4" />
                          )}
                          <span className="ml-2 hidden sm:inline">Provjeri VIES</span>
                        </Button>
                      </div>
                      {viesResults[tx.id]?.name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Registrirano ime: {viesResults[tx.id].name}
                        </p>
                      )}
                    </div>

                    {selectedTypes[tx.id] === TRANSACTION_TYPES.GOODS && (
                      <div className="bg-info-bg dark:bg-info-bg/30 border border-info-border dark:border-info-border rounded-lg p-3">
                        <div className="flex gap-2">
                          <Package className="h-4 w-4 text-link dark:text-link mt-0.5 shrink-0" />
                          <div className="text-sm text-info-text dark:text-info">
                            <p className="font-medium">Transakcija robom</p>
                            <p className="text-xs mt-1">
                              Ova transakcija će se pratiti za Intrastat izvještavanje. Ako godišnji
                              primitak robe iz EU premaši 350.000 EUR, potrebno je podnositi
                              mjesečne Intrastat izvještaje.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
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
                      <Button
                        variant="default"
                        onClick={() => handleConfirm(tx.id)}
                        disabled={processingId === tx.id || !selectedCountries[tx.id]}
                        className="bg-success hover:bg-green-700"
                      >
                        {processingId === tx.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Potvrdi EU
                      </Button>
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
