"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MessageSquare,
  Search,
  AlertCircle,
  Clock,
  CheckCircle2,
  Building2,
  AlertTriangle,
  Filter,
  RefreshCw,
} from "lucide-react"
import type { SupportTicketStatus, SupportTicketPriority, TicketCategory } from "@prisma/client"

interface Ticket {
  id: string
  title: string
  body: string | null
  status: SupportTicketStatus
  priority: SupportTicketPriority
  category: TicketCategory
  createdAt: Date
  updatedAt: Date
  company: {
    id: string
    name: string
  }
  _count: {
    messages: number
  }
}

interface Company {
  id: string
  name: string
  ticketCount: number
}

interface Stats {
  total: number
  open: number
  inProgress: number
  resolved: number
  closed: number
  urgent: number
  high: number
  companiesWithOpenTickets: number
}

interface SupportDashboardClientProps {
  tickets: Ticket[]
  companies: Company[]
  stats: Stats
  currentStatus?: string
  currentCategory?: string
  currentPriority?: string
  currentCompany?: string
  currentSearch?: string
}

function getStatusIcon(status: SupportTicketStatus) {
  switch (status) {
    case "OPEN":
      return <AlertCircle className="h-4 w-4 text-danger" />
    case "IN_PROGRESS":
      return <Clock className="h-4 w-4 text-primary" />
    case "RESOLVED":
      return <CheckCircle2 className="h-4 w-4 text-success" />
    case "CLOSED":
      return <CheckCircle2 className="h-4 w-4 text-muted" />
    default:
      return <MessageSquare className="h-4 w-4" />
  }
}

function getStatusBadgeVariant(
  status: SupportTicketStatus
): "default" | "secondary" | "danger" | "success" | "warning" | "outline" {
  switch (status) {
    case "OPEN":
      return "danger"
    case "IN_PROGRESS":
      return "warning"
    case "RESOLVED":
      return "success"
    case "CLOSED":
      return "secondary"
    default:
      return "default"
  }
}

function getStatusLabel(status: SupportTicketStatus): string {
  switch (status) {
    case "OPEN":
      return "Otvoren"
    case "IN_PROGRESS":
      return "U tijeku"
    case "RESOLVED":
      return "Riješen"
    case "CLOSED":
      return "Zatvoren"
    default:
      return status
  }
}

function getPriorityBadgeVariant(
  priority: SupportTicketPriority
): "default" | "secondary" | "danger" | "warning" | "outline" {
  switch (priority) {
    case "URGENT":
      return "danger"
    case "HIGH":
      return "warning"
    case "NORMAL":
      return "outline"
    case "LOW":
      return "secondary"
    default:
      return "default"
  }
}

function getPriorityLabel(priority: SupportTicketPriority): string {
  switch (priority) {
    case "URGENT":
      return "Hitno"
    case "HIGH":
      return "Visok"
    case "NORMAL":
      return "Normalan"
    case "LOW":
      return "Nizak"
    default:
      return priority
  }
}

function getCategoryLabel(category: TicketCategory): string {
  switch (category) {
    case "TECHNICAL":
      return "Tehnički"
    case "BILLING":
      return "Naplata"
    case "ACCOUNTING":
      return "Računovodstvo"
    case "GENERAL":
      return "Općenito"
    default:
      return category
  }
}

export function SupportDashboardClient({
  tickets,
  companies,
  stats,
  currentStatus,
  currentCategory,
  currentPriority,
  currentCompany,
  currentSearch,
}: SupportDashboardClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState(currentSearch || "")
  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value === "ALL" || !value) {
      params.delete(key)
    } else {
      params.set(key, value)
    }

    const queryString = params.toString()
    router.push(`/support${queryString ? `?${queryString}` : ""}`)
  }

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (searchInput.trim()) {
      params.set("search", searchInput.trim())
    } else {
      params.delete("search")
    }
    const queryString = params.toString()
    router.push(`/support${queryString ? `?${queryString}` : ""}`)
  }

  const clearFilters = () => {
    setSearchInput("")
    router.push("/support")
  }

  const updateTicketStatus = async (ticketId: string, newStatus: SupportTicketStatus) => {
    setIsUpdating(ticketId)
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error("Failed to update ticket status:", error)
    } finally {
      setIsUpdating(null)
    }
  }

  const hasActiveFilters =
    currentStatus || currentCategory || currentPriority || currentCompany || currentSearch

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-8 w-8 text-secondary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Podrška</h1>
          <p className="text-sm text-tertiary">Upravljanje zahtjevima za podršku svih klijenata</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ukupno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-danger" />
              Otvoreni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{stats.open}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />U tijeku
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Riješeni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.resolved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Zatvoreni</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.closed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-danger" />
              Hitni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{stats.urgent}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Visok prioritet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.high}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Tvrtke
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.companiesWithOpenTickets}</div>
            <p className="text-xs text-muted">s aktivnim zahtjevima</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filteri
            </span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Očisti filtere
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Pretraži</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Pretraži po naslovu..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button variant="secondary" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tvrtka</label>
              <Select
                value={currentCompany || "ALL"}
                onValueChange={(value) => updateFilter("company", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sve tvrtke" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Sve tvrtke</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} ({company.ticketCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={currentStatus || "ALL"}
                onValueChange={(value) => updateFilter("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Svi statusi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Svi statusi</SelectItem>
                  <SelectItem value="OPEN">Otvoren</SelectItem>
                  <SelectItem value="IN_PROGRESS">U tijeku</SelectItem>
                  <SelectItem value="RESOLVED">Riješen</SelectItem>
                  <SelectItem value="CLOSED">Zatvoren</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prioritet</label>
              <Select
                value={currentPriority || "ALL"}
                onValueChange={(value) => updateFilter("priority", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Svi prioriteti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Svi prioriteti</SelectItem>
                  <SelectItem value="URGENT">Hitno</SelectItem>
                  <SelectItem value="HIGH">Visok</SelectItem>
                  <SelectItem value="NORMAL">Normalan</SelectItem>
                  <SelectItem value="LOW">Nizak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Zahtjevi za podršku ({tickets.length})</span>
            {hasActiveFilters && (
              <Badge variant="secondary">Filtrirano od ukupno {stats.total}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted mb-4" />
              <p className="text-muted-foreground">Nema zahtjeva za podršku</p>
              <p className="text-sm text-muted">
                {hasActiveFilters
                  ? "Pokušajte prilagoditi filtere"
                  : "Trenutno nema aktivnih zahtjeva za podršku"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-start gap-4 rounded-lg border border-border p-4 hover:bg-surface-1 transition-colors"
                >
                  <div className="mt-1">{getStatusIcon(ticket.status)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{ticket.title}</h3>
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-3 w-3 text-muted" />
                          <span className="text-sm text-primary">{ticket.company.name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Badge variant={getStatusBadgeVariant(ticket.status)}>
                          {getStatusLabel(ticket.status)}
                        </Badge>
                        <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
                          {getPriorityLabel(ticket.priority)}
                        </Badge>
                        <Badge variant="outline">{getCategoryLabel(ticket.category)}</Badge>
                      </div>
                    </div>

                    {ticket.body && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {ticket.body}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Kreirano{" "}
                          {new Date(ticket.createdAt).toLocaleDateString("hr-HR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {ticket._count.messages > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {ticket._count.messages}{" "}
                            {ticket._count.messages === 1 ? "poruka" : "poruka"}
                          </span>
                        )}
                        {ticket.updatedAt.getTime() !== ticket.createdAt.getTime() && (
                          <span>
                            Ažurirano{" "}
                            {new Date(ticket.updatedAt).toLocaleDateString("hr-HR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {ticket.status === "OPEN" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdating === ticket.id}
                            onClick={() => updateTicketStatus(ticket.id, "IN_PROGRESS")}
                          >
                            {isUpdating === ticket.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              "Preuzmi"
                            )}
                          </Button>
                        )}
                        {ticket.status === "IN_PROGRESS" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdating === ticket.id}
                            onClick={() => updateTicketStatus(ticket.id, "RESOLVED")}
                          >
                            {isUpdating === ticket.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              "Riješi"
                            )}
                          </Button>
                        )}
                        {ticket.status === "RESOLVED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdating === ticket.id}
                            onClick={() => updateTicketStatus(ticket.id, "CLOSED")}
                          >
                            {isUpdating === ticket.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              "Zatvori"
                            )}
                          </Button>
                        )}
                        {ticket.status === "CLOSED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdating === ticket.id}
                            onClick={() => updateTicketStatus(ticket.id, "OPEN")}
                          >
                            {isUpdating === ticket.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              "Ponovno otvori"
                            )}
                          </Button>
                        )}
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
