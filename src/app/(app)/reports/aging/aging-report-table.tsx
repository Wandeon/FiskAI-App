"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react"

type Invoice = {
  id: string
  invoiceNumber: string
  totalAmount: number | { toNumber: () => number }
  dueDate: Date | null
  buyer: { name: string } | null
}

type SortField = "invoiceNumber" | "buyer" | "dueDate" | "totalAmount" | "daysOverdue"
type SortDirection = "asc" | "desc"

const PAGE_SIZE = 25

export function AgingReportTable({ invoices }: { invoices: Invoice[] }) {
  const [sortField, setSortField] = useState<SortField>("dueDate")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)

  const now = new Date()

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(n)

  const getDaysOverdue = (dueDate: Date | null) => {
    if (!dueDate) return 0
    return Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000))
  }

  const getAmount = (amount: number | { toNumber: () => number }) => {
    return typeof amount === "number" ? amount : amount.toNumber()
  }

  const sortedInvoices = useMemo(() => {
    const sorted = [...invoices].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case "invoiceNumber":
          aValue = a.invoiceNumber
          bValue = b.invoiceNumber
          break
        case "buyer":
          aValue = a.buyer?.name || ""
          bValue = b.buyer?.name || ""
          break
        case "dueDate":
          aValue = a.dueDate?.getTime() || 0
          bValue = b.dueDate?.getTime() || 0
          break
        case "totalAmount":
          aValue = getAmount(a.totalAmount)
          bValue = getAmount(b.totalAmount)
          break
        case "daysOverdue":
          aValue = getDaysOverdue(a.dueDate)
          bValue = getDaysOverdue(b.dueDate)
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return sorted
  }, [invoices, sortField, sortDirection])

  // Pagination calculations
  const totalPages = Math.ceil(sortedInvoices.length / PAGE_SIZE)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const paginatedInvoices = sortedInvoices.slice(startIndex, endIndex)

  // Reset to first page when sorting changes
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-30" />
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline" />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Detalji neplaćenih računa</span>
          <span className="text-sm font-normal text-secondary">
            Prikazano {startIndex + 1}-{Math.min(endIndex, sortedInvoices.length)} od{" "}
            {sortedInvoices.length} računa
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th
                  className="text-left py-2 cursor-pointer hover:bg-surface-1"
                  onClick={() => handleSort("invoiceNumber")}
                >
                  Račun
                  <SortIcon field="invoiceNumber" />
                </th>
                <th
                  className="text-left py-2 cursor-pointer hover:bg-surface-1"
                  onClick={() => handleSort("buyer")}
                >
                  Kupac
                  <SortIcon field="buyer" />
                </th>
                <th
                  className="text-left py-2 cursor-pointer hover:bg-surface-1"
                  onClick={() => handleSort("dueDate")}
                >
                  Dospijeće
                  <SortIcon field="dueDate" />
                </th>
                <th
                  className="text-right py-2 cursor-pointer hover:bg-surface-1"
                  onClick={() => handleSort("totalAmount")}
                >
                  Iznos
                  <SortIcon field="totalAmount" />
                </th>
                <th
                  className="text-left py-2 cursor-pointer hover:bg-surface-1"
                  onClick={() => handleSort("daysOverdue")}
                >
                  Status
                  <SortIcon field="daysOverdue" />
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedInvoices.map((inv) => {
                const daysOverdue = getDaysOverdue(inv.dueDate)
                return (
                  <tr key={inv.id} className="border-b hover:bg-surface-1">
                    <td className="py-2">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-link hover:underline font-mono"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-2">{inv.buyer?.name || "-"}</td>
                    <td className="py-2">{inv.dueDate?.toLocaleDateString("hr-HR")}</td>
                    <td className="py-2 text-right font-mono">
                      {formatCurrency(getAmount(inv.totalAmount))}
                    </td>
                    <td className="py-2">
                      {daysOverdue > 0 ? (
                        <span className="text-danger-text">{daysOverdue} dana kasni</span>
                      ) : (
                        <span className="text-success-icon">Tekući</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <div className="text-sm text-secondary">
              Stranica {currentPage} od {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Prethodna
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Sljedeća
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
