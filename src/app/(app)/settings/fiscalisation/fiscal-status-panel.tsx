"use client"

import { FiscalRequest, EInvoice } from "@prisma/client"
import { formatDateTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CheckCircle2, Clock, XCircle, AlertCircle, Loader2, RotateCcw, Skull } from "lucide-react"
import { retryFiscalRequestAction } from "@/app/actions/fiscal-certificate"
import { useState } from "react"
import { toast } from "sonner"

interface FiscalStatusPanelProps {
  requests: (FiscalRequest & {
    invoice: Pick<EInvoice, "invoiceNumber"> | null
  })[]
  stats: {
    status: string
    _count: number
  }[]
}

const STATUS_CONFIG = {
  QUEUED: {
    icon: Clock,
    label: "Queued",
    color: "text-warning-icon",
    bgColor: "bg-warning-bg",
    badgeVariant: "secondary" as const,
  },
  PROCESSING: {
    icon: Loader2,
    label: "Processing",
    color: "text-info-icon",
    bgColor: "bg-info-bg",
    badgeVariant: "default" as const,
  },
  COMPLETED: {
    icon: CheckCircle2,
    label: "Completed",
    color: "text-success-icon",
    bgColor: "bg-success-bg",
    badgeVariant: "secondary" as const,
  },
  FAILED: {
    icon: XCircle,
    label: "Failed",
    color: "text-danger-icon",
    bgColor: "bg-danger-bg",
    badgeVariant: "destructive" as const,
  },
  DEAD: {
    icon: Skull,
    label: "Dead",
    color: "text-tertiary",
    bgColor: "bg-surface-1",
    badgeVariant: "outline" as const,
  },
}

export function FiscalStatusPanel({ requests, stats }: FiscalStatusPanelProps) {
  const [retryingId, setRetryingId] = useState<string | null>(null)

  const handleRetry = async (requestId: string) => {
    setRetryingId(requestId)
    try {
      const result = await retryFiscalRequestAction(requestId)
      if (result.success) {
        toast.success("Request queued for retry")
      } else {
        toast.error(result.error || "Failed to retry request")
      }
    } catch (error) {
      toast.error("Failed to retry request")
    } finally {
      setRetryingId(null)
    }
  }

  const getStatusIcon = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
    if (!config) return <AlertCircle className="h-4 w-4 text-tertiary" />
    const Icon = config.icon
    return <Icon className={`h-4 w-4 ${config.color}`} />
  }

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
    if (!config) {
      return <Badge variant="outline">{status}</Badge>
    }
    return <Badge variant={config.badgeVariant}>{config.label}</Badge>
  }

  const getStatCount = (status: string) => {
    const stat = stats.find((s) => s.status === status)
    return stat?._count || 0
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const Icon = config.icon
          const count = getStatCount(status)
          return (
            <Card key={status}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className={`rounded-full p-2 ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground">{config.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Fiscal Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No fiscal requests yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>JIR</TableHead>
                  <TableHead className="text-center">Attempts</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.invoice?.invoiceNumber || "N/A"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{request.messageType}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(request.status)}
                        {getStatusBadge(request.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {request.jir ? (
                        <code className="rounded bg-muted px-2 py-1 text-xs">
                          {request.jir.slice(0, 8)}...
                        </code>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm">
                        {request.attemptCount}/{request.maxAttempts}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(request.updatedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {(request.status === "FAILED" || request.status === "DEAD") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetry(request.id)}
                          disabled={retryingId === request.id}
                        >
                          {retryingId === request.id ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Retrying...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="mr-2 h-3 w-3" />
                              Retry
                            </>
                          )}
                        </Button>
                      )}
                      {request.errorMessage && (
                        <div className="mt-1 text-xs text-danger-text">
                          {request.errorMessage.length > 50
                            ? `${request.errorMessage.slice(0, 50)}...`
                            : request.errorMessage}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
