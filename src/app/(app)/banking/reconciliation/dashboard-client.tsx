"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"

type AccountOption = {
  id: string
  name: string
  currency: string
}

const statusOptions = [
  { value: "UNMATCHED", label: "Nepovezano" },
  { value: "AUTO_MATCHED", label: "Automatski povezano" },
  { value: "MANUAL_MATCHED", label: "Ručno povezano" },
  { value: "IGNORED", label: "Ignorirano" },
]

const fetcher = (url: string) =>
  fetch(url).then(async (res) => {
    if (!res.ok) {
      const payload = await res.json().catch(() => null)
      throw new Error(payload?.error || "Greška pri učitavanju podataka")
    }
    return res.json()
  })

export function ReconciliationDashboard({
  accounts,
  defaultBankAccountId,
  highlightTransactionId,
}: {
  accounts: AccountOption[]
  defaultBankAccountId?: string
  highlightTransactionId?: string
}) {
  const [selectedAccount, setSelectedAccount] = useState(
    defaultBankAccountId || accounts[0]?.id || ""
  )
  const [statusFilter, setStatusFilter] = useState("UNMATCHED")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusType, setStatusType] = useState<"success" | "error" | "info">("info")
  const [loadingTransactionId, setLoadingTransactionId] = useState<string | null>(null)

  const queryKey = useMemo(() => {
    if (!selectedAccount) return null
    const params = new URLSearchParams({
      bankAccountId: selectedAccount,
      matchStatus: statusFilter,
    })
    return `/api/banking/reconciliation?${params}`
  }, [selectedAccount, statusFilter])

  const { data, error, mutate, isValidating } = useSWR<{
    transactions: Array<{
      id: string
      date: string
      description: string
      reference: string | null
      counterpartyName: string | null
      amount: number
      currency: string
      bankAccount: { id: string; name: string }
      matchStatus: string
      confidenceScore: number
      invoiceCandidates: Array<{
        invoiceId: string
        invoiceNumber: string | null
        issueDate: string
        totalAmount: number
        score: number
        reason: string
      }>
      expenseCandidates: Array<{
        expenseId: string
        description: string
        date: string
        totalAmount: number
        score: number
        reason: string
      }>
    }>
    pagination: { page: number; limit: number; total: number }
    summary: {
      unmatched: number
      autoMatched: number
      manualMatched: number
      ignored: number
    }
    autoMatchThreshold: number
  }>(queryKey, fetcher)

  const statusCards = [
    { label: "Nepovezano", value: data?.summary.unmatched ?? 0 },
    { label: "Automatski", value: data?.summary.autoMatched ?? 0 },
    { label: "Ručno", value: data?.summary.manualMatched ?? 0 },
    { label: "Ignorirano", value: data?.summary.ignored ?? 0 },
  ]

  const handleMatch = async (transactionId: string, candidateId: string, candidateType: "invoice" | "expense") => {
    setLoadingTransactionId(transactionId)
    setStatusMessage(null)
    try {
      const body = candidateType === "invoice"
        ? { transactionId, invoiceId: candidateId }
        : { transactionId, expenseId: candidateId }

      const response = await fetch("/api/banking/reconciliation/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Greška pri povezivanju")
      }

      setStatusType("success")
      setStatusMessage(candidateType === "invoice" ? "Transakcija je povezana s računom" : "Transakcija je povezana s troškom")
      mutate()
    } catch (err) {
      setStatusType("error")
      setStatusMessage(err instanceof Error ? err.message : "Greška pri povezivanju")
    } finally {
      setLoadingTransactionId(null)
    }
  }

  const formatCurrency = (value: number, currency: string) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency,
    }).format(value)

  // Scroll to highlighted transaction when data loads
  useEffect(() => {
    if (highlightTransactionId && data?.transactions?.length) {
      const element = document.getElementById(`txn-${highlightTransactionId}`)
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 100)
      }
    }
  }, [highlightTransactionId, data])

  if (!selectedAccount) {
    return (
      <Card>
        <CardContent className="text-sm text-secondary">
          Dodajte bankovni račun kako biste koristili knjiženje.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pomirenje bankovnih transakcija</h1>
          <p className="text-sm text-secondary">
            Automatsko povezivanje računa (prag {data?.autoMatchThreshold ?? 85}).
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[200px]">
            <Label htmlFor="account">Račun</Label>
            <select
              id="account"
              value={selectedAccount}
              onChange={(event) => setSelectedAccount(event.target.value)}
              className="w-full rounded-md border border-default px-3 py-2 text-sm"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-md border border-default px-3 py-2 text-sm"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {statusCards.map((card) => (
          <Card key={card.label}>
            <CardContent>
              <p className="text-xs uppercase tracking-wide text-secondary">{card.label}</p>
              <p className="text-2xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {statusMessage && (
        <div
          className={`flex items-center gap-2 rounded border px-4 py-3 text-sm ${
            statusType === "success"
              ? "border-success-border bg-success-bg text-success-text"
              : "border-danger-border bg-danger-bg text-danger-text"
          }`}
        >
          {statusType === "success" ? <CheckCircle /> : <AlertCircle />}
          <span>{statusMessage}</span>
        </div>
      )}

      {error && (
        <div className="rounded border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text">
          {(error as Error).message}
        </div>
      )}

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-1 text-xs uppercase tracking-wide text-secondary">
                <tr>
                  <th className="px-3 py-2">Datum</th>
                  <th className="px-3 py-2">Opis</th>
                  <th className="px-3 py-2">Iznos</th>
                  <th className="px-3 py-2">Prag</th>
                  <th className="px-3 py-2">Kandidat</th>
                  <th className="px-3 py-2 text-right">Akcija</th>
                </tr>
              </thead>
              <tbody>
                {data?.transactions?.length ? (
                  data.transactions.map((txn) => {
                    // Determine best candidate based on transaction type
                    const isCredit = txn.amount >= 0
                    const invoiceCandidate = txn.invoiceCandidates[0]
                    const expenseCandidate = txn.expenseCandidates[0]

                    // Use invoice candidate for credits, expense candidate for debits
                    const candidate = isCredit ? invoiceCandidate : expenseCandidate
                    const candidateType = isCredit ? "invoice" : "expense"

                    const isHighlighted = highlightTransactionId === txn.id
                    return (
                      <tr
                        key={txn.id}
                        id={`txn-${txn.id}`}
                        className={`border-b border-subtle hover:bg-surface-1 ${
                          isHighlighted ? "bg-info-bg ring-2 ring-info-border ring-inset" : ""
                        }`}
                      >
                        <td className="px-3 py-2 text-xs">
                          {new Date(txn.date).toLocaleDateString("hr-HR")}
                        </td>
                        <td className="px-3 py-2">
                          <div className="truncate font-medium">{txn.description}</div>
                          <div className="text-xs text-secondary">
                            {txn.reference || txn.counterpartyName || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(txn.amount, txn.currency)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-1 px-2 py-1 text-xs font-medium text-secondary">
                            {txn.confidenceScore}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {candidate ? (
                            <div>
                              <div className="font-semibold">
                                {candidateType === "invoice"
                                  ? (invoiceCandidate?.invoiceNumber || "–")
                                  : expenseCandidate?.description}
                              </div>
                              <div className="text-secondary">
                                {formatCurrency(candidate.totalAmount, txn.currency)} ·{" "}
                                {candidate.score}%
                              </div>
                              <div className="text-tertiary">
                                {candidate.reason} · {candidateType === "invoice" ? "Račun" : "Trošak"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-tertiary">Nema kandidata</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            disabled={!candidate || loadingTransactionId === txn.id}
                            onClick={() => {
                              if (candidate && candidateType === "invoice" && invoiceCandidate) {
                                handleMatch(txn.id, invoiceCandidate.invoiceId, "invoice")
                              } else if (candidate && candidateType === "expense" && expenseCandidate) {
                                handleMatch(txn.id, expenseCandidate.expenseId, "expense")
                              }
                            }}
                          >
                            {loadingTransactionId === txn.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              "Poveži"
                            )}
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-secondary">
                      Nema transakcija za prikaz
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {isValidating && <div className="mt-3 text-xs text-secondary">Ažuriranje...</div>}
        </CardContent>
      </Card>
    </div>
  )
}
