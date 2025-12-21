"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from "lucide-react"
import type { TenantListResult } from "@/lib/admin/tenant-list"
import { getSortAriaLabel, getPaginationAriaLabel } from "@/lib/a11y"

const LEGAL_FORMS = [
  { value: "OBRT_PAUSAL", label: "Obrt - Paušal" },
  { value: "OBRT_REAL", label: "Obrt - Stvarni" },
  { value: "DOO", label: "d.o.o." },
  { value: "JDOO", label: "j.d.o.o." },
  { value: "UDRUGA", label: "Udruga" },
]

const SUBSCRIPTION_STATUSES = [
  { value: "trialing", label: "Trial" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past Due" },
  { value: "canceled", label: "Canceled" },
  { value: "none", label: "None" },
]

const FLAGS = [
  { value: "stuck-onboarding", label: "Stuck in Onboarding" },
  { value: "approaching-limit", label: "Approaching Limit" },
  { value: "critical-limit", label: "Critical Limit" },
  { value: "inactive", label: "Inactive" },
]

interface TenantListViewProps {
  data: TenantListResult
}

export function TenantListView({ data }: TenantListViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "")

  const currentSort = {
    field: searchParams.get("sortField") || "createdAt",
    order: searchParams.get("sortOrder") || "desc",
  }

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
      router.push(`/tenants?${params.toString()}`)
    })
  }

  const handleSort = (field: string) => {
    const newOrder = currentSort.field === field && currentSort.order === "asc" ? "desc" : "asc"
    updateParams({ sortField: field, sortOrder: newOrder, page: "1" })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateParams({ search: searchInput || null, page: "1" })
  }

  const handleFilterChange = (key: string, value: string) => {
    updateParams({ [key]: value || null, page: "1" })
  }

  const handleClearFilters = () => {
    setSearchInput("")
    startTransition(() => {
      router.push("/tenants")
    })
  }

  const handlePageChange = (page: number) => {
    updateParams({ page: page.toString() })
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (currentSort.field !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return currentSort.order === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    )
  }

  const hasActiveFilters =
    searchParams.get("legalForm") ||
    searchParams.get("subscriptionStatus") ||
    searchParams.get("flags") ||
    searchParams.get("hasAlerts") ||
    searchParams.get("search")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">
            {data.total} registered compan{data.total !== 1 ? "ies" : "y"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2" role="search">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Search by company name or OIB..."
                className="pl-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Search tenants by company name or OIB"
              />
            </div>
            <Button type="submit" disabled={isPending}>
              Search
            </Button>
          </form>

          {/* Filter dropdowns */}
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label htmlFor="filter-legal-form" className="text-sm font-medium mb-2 block">
                Legal Form
              </label>
              <select
                id="filter-legal-form"
                value={searchParams.get("legalForm") || ""}
                onChange={(e) => handleFilterChange("legalForm", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                aria-label="Filter by legal form"
              >
                <option value="">All Legal Forms</option>
                {LEGAL_FORMS.map((form) => (
                  <option key={form.value} value={form.value}>
                    {form.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-subscription" className="text-sm font-medium mb-2 block">
                Subscription Status
              </label>
              <select
                id="filter-subscription"
                value={searchParams.get("subscriptionStatus") || ""}
                onChange={(e) => handleFilterChange("subscriptionStatus", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                aria-label="Filter by subscription status"
              >
                <option value="">All Statuses</option>
                {SUBSCRIPTION_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-flags" className="text-sm font-medium mb-2 block">
                Flags
              </label>
              <select
                id="filter-flags"
                value={searchParams.get("flags") || ""}
                onChange={(e) => handleFilterChange("flags", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                aria-label="Filter by flags"
              >
                <option value="">All Flags</option>
                {FLAGS.map((flag) => (
                  <option key={flag.value} value={flag.value}>
                    {flag.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-alerts" className="text-sm font-medium mb-2 block">
                Alerts
              </label>
              <select
                id="filter-alerts"
                value={searchParams.get("hasAlerts") || ""}
                onChange={(e) => handleFilterChange("hasAlerts", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                aria-label="Filter by alerts"
              >
                <option value="">All Tenants</option>
                <option value="true">With Alerts</option>
                <option value="false">No Alerts</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table aria-label="Tenants table">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                      aria-label={getSortAriaLabel("Company", currentSort, "name", "en")}
                    >
                      Company
                      <SortIcon field="name" />
                    </button>
                  </TableHead>
                  <TableHead>Legal Form</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("revenue")}
                      className="flex items-center font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                      aria-label={getSortAriaLabel("Revenue", currentSort, "revenue", "en")}
                    >
                      Revenue
                      <SortIcon field="revenue" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("lastLogin")}
                      className="flex items-center font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                      aria-label={getSortAriaLabel("Last Login", currentSort, "lastLogin", "en")}
                    >
                      Last Login
                      <SortIcon field="lastLogin" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("createdAt")}
                      className="flex items-center font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                      aria-label={getSortAriaLabel("Created", currentSort, "createdAt", "en")}
                    >
                      Created
                      <SortIcon field="createdAt" />
                    </button>
                  </TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="text-right">Stats</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No tenants found
                    </TableCell>
                  </TableRow>
                ) : (
                  data.tenants.map((tenant) => (
                    <TableRow
                      key={tenant.id}
                      className="cursor-pointer focus-within:bg-muted/50"
                      onClick={() => router.push(`/tenants/${tenant.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          router.push(`/tenants/${tenant.id}`)
                        }
                      }}
                      aria-label={`View details for ${tenant.name}`}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{tenant.name}</div>
                          <div className="text-sm text-muted-foreground">OIB: {tenant.oib}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{tenant.legalForm}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant={
                              tenant.subscriptionStatus === "active"
                                ? "default"
                                : tenant.subscriptionStatus === "trialing"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {tenant.subscriptionStatus}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {tenant.subscriptionPlan}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          €
                          {tenant.yearlyRevenue.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {tenant.lastLoginAt
                            ? new Date(tenant.lastLoginAt).toLocaleDateString()
                            : "Never"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {new Date(tenant.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tenant.flags.map((flag) => (
                            <Badge key={flag} variant="destructive" className="text-xs">
                              {flag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm space-y-1">
                          <div>
                            <span className="font-medium">{tenant.userCount}</span> users
                          </div>
                          <div>
                            <span className="font-medium">{tenant.invoiceCount}</span> invoices
                          </div>
                          <div>
                            <span className="font-medium">{tenant.moduleCount}</span> modules
                          </div>
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
      {data.totalPages > 1 && (
        <nav
          className="flex items-center justify-between"
          role="navigation"
          aria-label="Pagination"
        >
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Showing {(data.page - 1) * data.pageSize + 1} to{" "}
            {Math.min(data.page * data.pageSize, data.total)} of {data.total} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.page - 1)}
              disabled={data.page === 1 || isPending}
              aria-label="Go to previous page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
              Previous
            </Button>
            <span className="text-sm" aria-current="page">
              {getPaginationAriaLabel(data.page, data.totalPages, "en")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.page + 1)}
              disabled={data.page >= data.totalPages || isPending}
              aria-label="Go to next page"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
}
