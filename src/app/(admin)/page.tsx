import { requireAdmin } from "@/lib/auth-utils"
import { getAdminMetrics, getOnboardingFunnel, getComplianceHealth } from "@/lib/admin/metrics"
import { AdminDashboard } from "./admin-dashboard"

export const metadata = {
  title: "Admin Dashboard | FiskAI",
}

export default async function AdminPage() {
  await requireAdmin()

  const [metrics, funnel, compliance] = await Promise.all([
    getAdminMetrics(),
    getOnboardingFunnel(),
    getComplianceHealth(),
  ])

  return <AdminDashboard metrics={metrics} funnel={funnel} compliance={compliance} />
}
