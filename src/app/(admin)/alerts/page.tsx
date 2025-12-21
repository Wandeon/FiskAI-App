import { requireAdmin } from "@/lib/auth-utils"
import { getActiveAlerts } from "@/lib/admin/alerts"
import { AlertsPage } from "./alerts-page"

export const metadata = {
  title: "Alerts | Admin | FiskAI",
  description: "View and manage platform alerts",
}

export default async function AdminAlertsPage() {
  await requireAdmin()

  const alerts = await getActiveAlerts()

  return <AlertsPage alerts={alerts} />
}
