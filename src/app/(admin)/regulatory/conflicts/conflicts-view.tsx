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
import { CheckCircle, AlertCircle, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import type {
  RegulatoryConflict,
  RegulatoryRule,
  SourcePointer,
  Evidence,
  RegulatorySource,
} from "@prisma/client"

type RuleWithSourcePointers = RegulatoryRule & {
  sourcePointers: (SourcePointer & {
    evidence: Evidence & {
      source: RegulatorySource
    }
  })[]
}

type ConflictWithRules = RegulatoryConflict & {
  itemA: RuleWithSourcePointers
  itemB: RuleWithSourcePointers
}

interface ConflictsViewProps {
  conflicts: ConflictWithRules[]
  total: number
  page: number
  pageSize: number
  userId: string
}

export function ConflictsView({ conflicts, total, page, pageSize, userId }: ConflictsViewProps) {
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
      router.push(`/regulatory/conflicts?${params.toString()}`)
    })
  }

  const handleResolve = async (conflictId: string) => {
    setProcessingId(conflictId)
    try {
      const res = await fetch(`/api/admin/regulatory-truth/conflicts/${conflictId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(`Failed to resolve: ${error.error}`)
        return
      }

      router.refresh()
    } catch (error) {
      alert("Failed to resolve conflict")
    } finally {
      setProcessingId(null)
    }
  }

  const handleOverride = async (conflictId: string, winningRuleId: string) => {
    const reason = prompt("Reason for override:")
    if (!reason) return

    setProcessingId(conflictId)
    try {
      const res = await fetch(`/api/admin/regulatory-truth/conflicts/${conflictId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "override", winningRuleId, reason }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(`Failed to override: ${error.error}`)
        return
      }

      router.refresh()
    } catch (error) {
      alert("Failed to override conflict")
    } finally {
      setProcessingId(null)
    }
  }

  const conflictTypeLabels = {
    SOURCE_CONFLICT: "Source Conflict",
    TEMPORAL_CONFLICT: "Temporal Conflict",
    SCOPE_CONFLICT: "Scope Conflict",
    INTERPRETATION_CONFLICT: "Interpretation Conflict",
  }

  const statusColors = {
    OPEN: "bg-danger-bg text-danger-text",
    RESOLVED: "bg-success-bg text-success-text",
    ESCALATED: "bg-warning-bg text-warning-text",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conflict Resolution</h1>
          <p className="text-muted-foreground">
            {total} conflict{total !== 1 ? "s" : ""} requiring attention
          </p>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={!searchParams.get("status") ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams({ status: null })}
            >
              Open Only
            </Button>
            <Button
              variant={searchParams.get("status") === "OPEN" ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams({ status: "OPEN" })}
            >
              Open
            </Button>
            <Button
              variant={searchParams.get("status") === "RESOLVED" ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams({ status: "RESOLVED" })}
            >
              Resolved
            </Button>
            <Button
              variant={searchParams.get("status") === "ESCALATED" ? "default" : "outline"}
              size="sm"
              onClick={() => updateParams({ status: "ESCALATED" })}
            >
              Escalated
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conflicts List */}
      <div className="space-y-4">
        {conflicts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              No conflicts found
            </CardContent>
          </Card>
        ) : (
          conflicts.map((conflict) => (
            <Card key={conflict.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">
                        {
                          conflictTypeLabels[
                            conflict.conflictType as keyof typeof conflictTypeLabels
                          ]
                        }
                      </Badge>
                      <Badge className={statusColors[conflict.status as keyof typeof statusColors]}>
                        {conflict.status}
                      </Badge>
                      {conflict.requiresHumanReview && (
                        <Badge variant="destructive">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Human Review Required
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base">{conflict.description}</CardTitle>
                    {conflict.humanReviewReason && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Reason: {conflict.humanReviewReason}
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(conflict.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Rule A */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium">Rule A: {conflict.itemA.titleHr}</div>
                    <Badge variant="outline">{conflict.itemA.riskTier}</Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">Value:</span> {conflict.itemA.value}{" "}
                      <span className="text-muted-foreground">({conflict.itemA.valueType})</span>
                    </div>
                    <div>
                      <span className="font-medium">Authority:</span>{" "}
                      {conflict.itemA.authorityLevel}
                    </div>
                    <div>
                      <span className="font-medium">Confidence:</span>{" "}
                      {Math.round(conflict.itemA.confidence * 100)}%
                    </div>
                    <div className="mt-2">
                      <span className="font-medium">Sources:</span>
                      <div className="ml-4 mt-1 space-y-1">
                        {conflict.itemA.sourcePointers.slice(0, 2).map((pointer) => (
                          <div key={pointer.id}>
                            <a
                              href={pointer.evidence.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-info-icon hover:underline text-xs"
                            >
                              {pointer.evidence.source.name}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rule B */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium">Rule B: {conflict.itemB.titleHr}</div>
                    <Badge variant="outline">{conflict.itemB.riskTier}</Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <div>
                      <span className="font-medium">Value:</span> {conflict.itemB.value}{" "}
                      <span className="text-muted-foreground">({conflict.itemB.valueType})</span>
                    </div>
                    <div>
                      <span className="font-medium">Authority:</span>{" "}
                      {conflict.itemB.authorityLevel}
                    </div>
                    <div>
                      <span className="font-medium">Confidence:</span>{" "}
                      {Math.round(conflict.itemB.confidence * 100)}%
                    </div>
                    <div className="mt-2">
                      <span className="font-medium">Sources:</span>
                      <div className="ml-4 mt-1 space-y-1">
                        {conflict.itemB.sourcePointers.slice(0, 2).map((pointer) => (
                          <div key={pointer.id}>
                            <a
                              href={pointer.evidence.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-info-icon hover:underline text-xs"
                            >
                              {pointer.evidence.source.name}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arbiter Recommendation */}
                {conflict.resolution && (
                  <div className="bg-info-bg border border-info-border rounded-lg p-4">
                    <div className="font-medium mb-2">Arbiter Recommendation:</div>
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="font-medium">Strategy:</span>{" "}
                        {(conflict.resolution as any).strategy}
                      </div>
                      <div>
                        <span className="font-medium">Rationale (HR):</span>{" "}
                        {(conflict.resolution as any).rationaleHr}
                      </div>
                      {(conflict.resolution as any).rationaleEn && (
                        <div>
                          <span className="font-medium">Rationale (EN):</span>{" "}
                          {(conflict.resolution as any).rationaleEn}
                        </div>
                      )}
                      {conflict.confidence && (
                        <div>
                          <span className="font-medium">Confidence:</span>{" "}
                          {Math.round(conflict.confidence * 100)}%
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {conflict.status === "OPEN" && (
                  <div className="flex gap-2 pt-2 border-t">
                    {conflict.resolution && (
                      <Button
                        size="sm"
                        onClick={() => handleResolve(conflict.id)}
                        disabled={processingId === conflict.id}
                      >
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Accept Arbiter Resolution
                      </Button>
                    )}
                    {conflict.itemAId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOverride(conflict.id, conflict.itemAId!)}
                        disabled={processingId === conflict.id}
                      >
                        Choose Rule A
                      </Button>
                    )}
                    {conflict.itemBId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOverride(conflict.id, conflict.itemBId!)}
                        disabled={processingId === conflict.id}
                      >
                        Choose Rule B
                      </Button>
                    )}
                  </div>
                )}

                {conflict.status === "RESOLVED" && conflict.resolvedAt && (
                  <div className="text-sm text-muted-foreground pt-2 border-t">
                    Resolved on {new Date(conflict.resolvedAt).toLocaleDateString()}
                    {conflict.resolvedBy && ` by user ${conflict.resolvedBy}`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

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
