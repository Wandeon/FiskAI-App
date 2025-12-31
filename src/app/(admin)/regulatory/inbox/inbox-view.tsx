"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CheckCircle, XCircle, ExternalLink, Filter, ChevronLeft, ChevronRight } from "lucide-react"
import type { RegulatoryRule, SourcePointer, Evidence, RegulatorySource } from "@prisma/client"

type RuleWithSourcePointers = RegulatoryRule & {
  sourcePointers: (SourcePointer & {
    evidence: Evidence & {
      source: RegulatorySource
    }
  })[]
}

interface InboxViewProps {
  rules: RuleWithSourcePointers[]
  total: number
  page: number
  pageSize: number
  userId: string
}

export function InboxView({ rules, total, page, pageSize, userId }: InboxViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [processingId, setProcessingId] = useState<string | null>(null)

  const totalPages = Math.ceil(total / pageSize)

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    startTransition(() => {
      router.push(`/regulatory/inbox?${params.toString()}`)
    })
  }

  const handleApprove = async (ruleId: string) => {
    setProcessingId(ruleId)
    try {
      const res = await fetch(`/api/admin/regulatory-truth/rules/${ruleId}/approve`, {
        method: "POST",
      })

      if (!res.ok) {
        const error = await res.json()
        alert(`Failed to approve: ${error.error}`)
        return
      }

      router.refresh()
    } catch (error) {
      alert("Failed to approve rule")
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (ruleId: string) => {
    const reason = prompt("Reason for rejection:")
    if (!reason) return

    setProcessingId(ruleId)
    try {
      const res = await fetch(`/api/admin/regulatory-truth/rules/${ruleId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(`Failed to reject: ${error.error}`)
        return
      }

      router.refresh()
    } catch (error) {
      alert("Failed to reject rule")
    } finally {
      setProcessingId(null)
    }
  }

  const riskTierColors = {
    T0: "bg-danger-bg text-danger-text border-danger-border",
    T1: "bg-warning-bg text-warning-text border-warning-border",
    T2: "bg-warning-bg text-warning-text border-warning-border",
    T3: "bg-info-bg text-info-text border-info-border",
  }

  const riskTierLabels = {
    T0: "Critical",
    T1: "High",
    T2: "Medium",
    T3: "Low",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Inbox</h1>
          <p className="text-muted-foreground">
            {total} rule{total !== 1 ? "s" : ""} awaiting human review
          </p>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter by Risk Tier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={!searchParams.get("riskTier") ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams({ riskTier: null })}
            >
              All
            </Button>
            {(["T0", "T1", "T2", "T3"] as const).map((tier) => (
              <Button
                key={tier}
                variant={searchParams.get("riskTier") === tier ? "default" : "outline"}
                size="sm"
                onClick={() => updateParams({ riskTier: tier })}
              >
                {tier} - {riskTierLabels[tier]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Sources</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No rules pending review
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={riskTierColors[rule.riskTier as keyof typeof riskTierColors]}
                        >
                          {rule.riskTier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rule.titleHr}</div>
                          {rule.titleEn && (
                            <div className="text-sm text-muted-foreground">{rule.titleEn}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            Concept: {rule.conceptSlug}
                          </div>
                          <div className="text-xs mt-1">
                            <span className="font-medium">Value:</span> {rule.value}{" "}
                            <span className="text-muted-foreground">({rule.valueType})</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{rule.authorityLevel}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={rule.confidence >= 0.95 ? "default" : "secondary"}>
                            {Math.round(rule.confidence * 100)}%
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {rule.sourcePointers.slice(0, 2).map((pointer) => (
                            <div key={pointer.id} className="text-xs">
                              <a
                                href={pointer.evidence.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-info-icon hover:underline"
                              >
                                {pointer.evidence.source.name}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          ))}
                          {rule.sourcePointers.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{rule.sourcePointers.length - 2} more
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(rule.id)}
                            disabled={processingId === rule.id}
                          >
                            <CheckCircle className="mr-1 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(rule.id)}
                            disabled={processingId === rule.id}
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}{" "}
            results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateParams({ page: (page - 1).toString() })}
              disabled={page === 1 || isPending}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateParams({ page: (page + 1).toString() })}
              disabled={page >= totalPages || isPending}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
}
