import dynamic from "next/dynamic"
import { requireAdmin } from "@/lib/auth-utils"
import {
  getCachedAdminMetrics,
  getCachedOnboardingFunnel,
  getCachedComplianceHealth,
} from "@/lib/cache"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

// Dynamic import for heavy AdminDashboard component
const AdminDashboard = dynamic(
  () => import("./admin-dashboard").then((mod) => ({ default: mod.AdminDashboard })),
  {
    loading: () => <LoadingSpinner />,
    ssr: true,
  }
)

export const metadata = {
  title: "Admin Dashboard | FiskAI",
}

// Enable caching for this page
export const revalidate = 300 // 5 minutes

export default async function AdminPage() {
  await requireAdmin()

  const [metrics, funnel, compliance] = await Promise.all([
    getCachedAdminMetrics(),
    getCachedOnboardingFunnel(),
    getCachedComplianceHealth(),
  ])

  return <AdminDashboard metrics={metrics} funnel={funnel} compliance={compliance} />
}
