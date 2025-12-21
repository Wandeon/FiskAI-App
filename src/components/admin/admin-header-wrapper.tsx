import { db } from "@/lib/db"
import { getActiveAlerts } from "@/lib/admin/alerts"
import { AdminHeader } from "./header"

async function getHeaderStats() {
  const [totalTenants, alerts] = await Promise.all([db.company.count(), getActiveAlerts()])

  return {
    totalTenants,
    alertsCount: alerts.filter((a) => a.level === "critical").length,
  }
}

export async function AdminHeaderWrapper() {
  const stats = await getHeaderStats()
  return <AdminHeader totalTenants={stats.totalTenants} alertsCount={stats.alertsCount} />
}
