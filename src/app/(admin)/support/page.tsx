import { Suspense } from "react"
import { requireAdmin } from "@/lib/auth-utils"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { SupportDashboard } from "@/components/admin/support-dashboard"

export const metadata = { title: "Podrška | Admin | FiskAI", description: "Upravljanje zahtjevima za podršku" }
export const dynamic = "force-dynamic"

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ status?: string; category?: string; priority?: string; company?: string; search?: string }> }) {
  await requireAdmin()
  const params = await searchParams
  return <Suspense fallback={<LoadingSpinner />}><SupportDashboard statusFilter={params.status} categoryFilter={params.category} priorityFilter={params.priority} companyFilter={params.company} searchQuery={params.search} /></Suspense>
}
