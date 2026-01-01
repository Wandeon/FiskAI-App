import { getActiveAlerts } from "@/lib/admin/alerts"
import { AdminHeader } from "./header"
import { getAdminHeaderStats } from "@/lib/admin/queries"

// TODO: Database queries moved to @/lib/admin/queries for Clean Architecture compliance

async function getHeaderStats() {
  const [totalTenants, alerts] = await Promise.all([getAdminHeaderStats(), getActiveAlerts()])

  return {
    totalTenants,
    alertsCount: alerts.filter((a) => a.level === "critical").length,
  }
}

export async function AdminHeaderWrapper() {
  const stats = await getHeaderStats()
  return <AdminHeader totalTenants={stats.totalTenants} alertsCount={stats.alertsCount} />
}
