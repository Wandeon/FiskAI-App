import { SupportDashboardClient } from "./support-dashboard-client"
import {
  getAdminTickets,
  getCompaniesWithTickets,
  getSupportDashboardStats,
} from "@/lib/admin/queries"

// TODO: Database queries moved to @/lib/admin/queries for Clean Architecture compliance

interface SupportDashboardProps {
  statusFilter?: string
  categoryFilter?: string
  priorityFilter?: string
  companyFilter?: string
  searchQuery?: string
}

export async function SupportDashboard({
  statusFilter,
  categoryFilter,
  priorityFilter,
  companyFilter,
  searchQuery,
}: SupportDashboardProps) {
  const [tickets, companies, stats] = await Promise.all([
    getAdminTickets(statusFilter, categoryFilter, priorityFilter, companyFilter, searchQuery),
    getCompaniesWithTickets(),
    getSupportDashboardStats(),
  ])

  return (
    <SupportDashboardClient
      tickets={tickets}
      companies={companies}
      stats={stats}
      currentStatus={statusFilter}
      currentCategory={categoryFilter}
      currentPriority={priorityFilter}
      currentCompany={companyFilter}
      currentSearch={searchQuery}
    />
  )
}
