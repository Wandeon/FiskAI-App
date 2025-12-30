import { Suspense } from "react"
import { requireAdmin } from "@/lib/auth-utils"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { SupportDashboard } from "@/components/admin/support-dashboard"

export const metadata = {
  title: "Podrška | Admin | FiskAI",
  description: "Upravljanje zahtjevima za podršku",
}

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{
    statusFilter?: string
    categoryFilter?: string
    priorityFilter?: string
    companyFilter?: string
    searchQuery?: string
  }>
}

export default async function SupportPage({ searchParams }: PageProps) {
  await requireAdmin()
  const params = await searchParams
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-8"><LoadingSpinner /></div>}>
      <SupportDashboard
        statusFilter={params.statusFilter}
        categoryFilter={params.categoryFilter}
        priorityFilter={params.priorityFilter}
        companyFilter={params.companyFilter}
        searchQuery={params.searchQuery}
      />
    </Suspense>
  )
}
