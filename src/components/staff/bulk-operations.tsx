"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Download,
  FileText,
  ClipboardCheck,
  Building2,
  Calendar,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from "lucide-react"
import { toast } from "sonner"

type Client = {
  id: string
  name: string
  oib: string
  entitlements: string[]
  subscriptionStatus: string
  assignedAt: Date
  notes?: string
}

type ReportData = {
  reportType: string
  totalClients: number
  totals?: {
    invoiceCount: number
    invoiceTotal: number
    expenseCount: number
    expenseTotal: number
    netProfit: number
    openTickets: number
    pendingReview: number
  }
  clients: Array<{
    id: string
    name: string
    oib: string
    invoices?: { count: number; totalGross: number }
    expenses?: { count: number; totalGross: number }
    netProfit?: number
    openTickets?: number
    pendingReview?: number
  }>
}

export function BulkOperations() {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  })

  useEffect(() => {
    void fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/staff/clients")
      if (!response.ok) throw new Error("Failed to fetch clients")
      const data = await response.json()
      setClients(data)
    } catch (error) {
      toast.error("Failed to load clients")
    } finally {
      setLoading(false)
    }
  }

  const toggleClient = (clientId: string) => {
    const newSelected = new Set(selectedClients)
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId)
    } else {
      newSelected.add(clientId)
    }
    setSelectedClients(newSelected)
  }

  const toggleAll = () => {
    if (selectedClients.size === clients.length) {
      setSelectedClients(new Set())
    } else {
      setSelectedClients(new Set(clients.map((c) => c.id)))
    }
  }

  const handleBulkExport = async (exportType: string) => {
    if (selectedClients.size === 0) {
      toast.error("Please select at least one client to export")
      return
    }

    setExporting(true)
    try {
      const clientIds = Array.from(selectedClients).join(",")
      const params = new URLSearchParams({
        clientIds,
        from: dateRange.from,
        to: dateRange.to,
        format: "combined",
        exportType,
      })

      const response = await fetch(`/api/staff/bulk-export?${params}`)
      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `bulk-export-${selectedClients.size}-clients-${dateRange.from}-${dateRange.to}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`Downloaded data for ${selectedClients.size} clients`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExporting(false)
    }
  }

  const handleGenerateReport = async (reportType: string) => {
    setExporting(true)
    try {
      const params = new URLSearchParams({
        reportType,
        from: dateRange.from,
        to: dateRange.to,
      })

      const response = await fetch(`/api/staff/multi-client-report?${params}`)
      if (!response.ok) throw new Error("Report generation failed")

      const data = await response.json()
      setReportData(data)

      toast.success(`${reportType} report for ${data.totalClients} clients`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Report generation failed")
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk Operations</h1>
        <p className="text-muted-foreground">
          Manage multiple clients efficiently with bulk exports and reports
        </p>
      </div>

      {/* Date Range Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="from-date">From</Label>
              <input
                id="from-date"
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              />
            </div>
            <div>
              <Label htmlFor="to-date">To</Label>
              <input
                id="to-date"
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-full px-3 py-2 border rounded-md mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Select Clients
            </CardTitle>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selectedClients.size === clients.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <CardDescription>
            {selectedClients.size} of {clients.length} clients selected
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 max-h-[400px] overflow-y-auto">
            {clients.map((client) => (
              <div
                key={client.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 cursor-pointer"
                onClick={() => toggleClient(client.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedClients.has(client.id)}
                  onChange={() => toggleClient(client.id)}
                  className="h-4 w-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{client.name}</div>
                  <div className="text-sm text-muted-foreground">OIB: {client.oib}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Export Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Bulk Export
          </CardTitle>
          <CardDescription>
            Export data for {selectedClients.size} selected client
            {selectedClients.size !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              onClick={() => void handleBulkExport("all")}
              disabled={exporting || selectedClients.size === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              All Data
            </Button>
            <Button
              onClick={() => void handleBulkExport("invoices")}
              disabled={exporting || selectedClients.size === 0}
              variant="outline"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Invoices
            </Button>
            <Button
              onClick={() => void handleBulkExport("expenses")}
              disabled={exporting || selectedClients.size === 0}
              variant="outline"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Expenses
            </Button>
            <Button
              onClick={() => void handleBulkExport("kpr")}
              disabled={exporting || selectedClients.size === 0}
              variant="outline"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              KPR
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Client Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Multi-Client Reports
          </CardTitle>
          <CardDescription>Generate aggregate reports across all assigned clients</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              onClick={() => void handleGenerateReport("overview")}
              disabled={exporting}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Overview
            </Button>
            <Button
              onClick={() => void handleGenerateReport("kpr")}
              disabled={exporting}
              variant="outline"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              KPR Report
            </Button>
            <Button
              onClick={() => void handleGenerateReport("pending-review")}
              disabled={exporting}
              variant="outline"
              className="gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              Pending Review
            </Button>
            <Button
              onClick={() => void handleGenerateReport("deadlines")}
              disabled={exporting}
              variant="outline"
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Deadlines
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Results */}
      {reportData && (
        <Card>
          <CardHeader>
            <CardTitle>Report Results: {reportData.reportType}</CardTitle>
            <CardDescription>
              Data for {reportData.totalClients} clients ({dateRange.from} to {dateRange.to})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reportData.totals && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-info-bg rounded-lg">
                  <div className="flex items-center gap-2 text-info-icon dark:text-info-icon mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">Total Income</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {reportData.totals.invoiceTotal.toFixed(2)} EUR
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {reportData.totals.invoiceCount} invoices
                  </div>
                </div>
                <div className="p-4 bg-danger-bg rounded-lg">
                  <div className="flex items-center gap-2 text-danger-icon mb-1">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm font-medium">Total Expenses</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {reportData.totals.expenseTotal.toFixed(2)} EUR
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {reportData.totals.expenseCount} expenses
                  </div>
                </div>
                <div className="p-4 bg-success-bg rounded-lg">
                  <div className="flex items-center gap-2 text-success-icon dark:text-success-text mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm font-medium">Net Profit</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {reportData.totals.netProfit.toFixed(2)} EUR
                  </div>
                </div>
                <div className="p-4 bg-warning-bg rounded-lg">
                  <div className="flex items-center gap-2 text-warning-text mb-1">
                    <ClipboardCheck className="h-4 w-4" />
                    <span className="text-sm font-medium">Pending Review</span>
                  </div>
                  <div className="text-2xl font-bold">{reportData.totals.pendingReview}</div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="font-semibold mb-3">Client Breakdown</h3>
              {reportData.clients.map((client) => (
                <div key={client.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{client.name}</div>
                      <div className="text-sm text-muted-foreground">OIB: {client.oib}</div>
                    </div>
                    <div className="flex gap-4 text-sm">
                      {client.invoices && (
                        <div className="text-right">
                          <div className="font-medium text-info-icon">
                            {client.invoices.totalGross.toFixed(2)} EUR
                          </div>
                          <div className="text-muted-foreground">
                            {client.invoices.count} invoices
                          </div>
                        </div>
                      )}
                      {client.expenses && (
                        <div className="text-right">
                          <div className="font-medium text-danger-icon">
                            {client.expenses.totalGross.toFixed(2)} EUR
                          </div>
                          <div className="text-muted-foreground">
                            {client.expenses.count} expenses
                          </div>
                        </div>
                      )}
                      {client.netProfit !== undefined && (
                        <div className="text-right">
                          <div
                            className={`font-medium ${client.netProfit >= 0 ? "text-success-icon" : "text-danger-icon"}`}
                          >
                            {client.netProfit.toFixed(2)} EUR
                          </div>
                          <div className="text-muted-foreground">net profit</div>
                        </div>
                      )}
                      {client.pendingReview !== undefined && client.pendingReview > 0 && (
                        <Badge
                          variant="outline"
                          className="border-warning-border text-warning-text"
                        >
                          {client.pendingReview} pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
