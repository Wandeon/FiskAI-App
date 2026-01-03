"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExternalLink, RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react"
import type { RegulatorySource, Evidence } from "@/generated/regulatory-client"

type SourceWithEvidence = RegulatorySource & {
  evidence: Evidence[]
  _count: {
    evidence: number
  }
}

interface SourcesViewProps {
  sources: SourceWithEvidence[]
}

export function SourcesView({ sources }: SourcesViewProps) {
  const router = useRouter()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleToggleActive = async (sourceId: string, isActive: boolean) => {
    setTogglingId(sourceId)
    try {
      const res = await fetch(`/api/admin/regulatory-truth/sources/${sourceId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      })

      if (!res.ok) {
        alert("Failed to toggle source")
        return
      }

      router.refresh()
    } catch (error) {
      alert("Failed to toggle source")
    } finally {
      setTogglingId(null)
    }
  }

  const handleTriggerCheck = async (sourceId: string) => {
    try {
      const res = await fetch(`/api/admin/regulatory-truth/sources/${sourceId}/check`, {
        method: "POST",
      })

      if (!res.ok) {
        alert("Failed to trigger check")
        return
      }

      alert("Check triggered successfully")
      router.refresh()
    } catch (error) {
      alert("Failed to trigger check")
    }
  }

  const getSourceStatus = (source: SourceWithEvidence) => {
    if (!source.isActive) {
      return { status: "inactive", label: "Inactive", icon: AlertCircle, color: "text-tertiary" }
    }

    if (!source.lastFetchedAt) {
      return { status: "pending", label: "Pending", icon: Clock, color: "text-warning-icon" }
    }

    const hoursSinceLastFetch =
      (Date.now() - new Date(source.lastFetchedAt).getTime()) / (1000 * 60 * 60)

    if (hoursSinceLastFetch > source.fetchIntervalHours * 1.5) {
      return {
        status: "degraded",
        label: "Degraded",
        icon: AlertCircle,
        color: "text-warning-text",
      }
    }

    return { status: "healthy", label: "Healthy", icon: CheckCircle, color: "text-success-icon" }
  }

  const hierarchyLabels: Record<number, string> = {
    1: "Ustav (Constitution)",
    2: "Zakon (Law)",
    3: "Podzakonski akt (Regulation)",
    4: "Pravilnik (Ministry Rules)",
    5: "Uputa (Tax Guidance)",
    6: "Mišljenje (Interpretation)",
    7: "Praksa (Practice)",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Regulatory Sources</h1>
          <p className="text-muted-foreground">
            {sources.filter((s) => s.isActive).length} active sources monitoring Croatian
            regulations
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Trigger Full Scan
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sources.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success-icon">
              {sources.filter((s) => s.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Evidence Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sources.reduce((sum, s) => sum + s._count.evidence, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Need Checking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-icon">
              {
                sources.filter((s) => {
                  if (!s.isActive || !s.lastFetchedAt) return false
                  const hoursSince =
                    (Date.now() - new Date(s.lastFetchedAt).getTime()) / (1000 * 60 * 60)
                  return hoursSince > s.fetchIntervalHours
                }).length
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sources Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Hierarchy</TableHead>
                  <TableHead>Last Fetched</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => {
                  const statusInfo = getSourceStatus(source)
                  const StatusIcon = statusInfo.icon

                  return (
                    <TableRow key={source.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                          <span className={`text-sm ${statusInfo.color}`}>{statusInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{source.name}</div>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-info-icon hover:underline flex items-center gap-1"
                          >
                            {new URL(source.url).hostname}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {hierarchyLabels[source.hierarchy] || `Level ${source.hierarchy}`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {source.lastFetchedAt ? (
                            <>
                              <div>{new Date(source.lastFetchedAt).toLocaleDateString()}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(source.lastFetchedAt).toLocaleTimeString()}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{source._count.evidence}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {source.fetchIntervalHours < 24
                            ? `${source.fetchIntervalHours}h`
                            : `${Math.round(source.fetchIntervalHours / 24)}d`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={source.isActive}
                          onCheckedChange={() => handleToggleActive(source.id, source.isActive)}
                          disabled={togglingId === source.id}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTriggerCheck(source.id)}
                          disabled={!source.isActive}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
