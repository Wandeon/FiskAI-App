import { Suspense } from "react"
import dynamic from "next/dynamic"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { getCachedTenantList } from "@/lib/cache"
import type { TenantFilters, TenantSort, TenantPagination, TenantSortField, TenantSortOrder } from "@/lib/admin/tenant-list"

// Dynamic import for heavy TenantListView component
const TenantListView = dynamic(
  () => import("./tenant-list").then((mod) => ({ default: mod.TenantListView })),
  {
    loading: () => <LoadingSpinner />,
    ssr: true,
  }
)

export const revalidate = 60 // 1 minute cache

interface SearchParams {
  legalForm?: string
  subscriptionStatus?: string
  flags?: string
  hasAlerts?: string
  search?: string
  sortField?: string
  sortOrder?: string
  page?: string
  pageSize?: string
}

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  // Await searchParams in Next.js 15
  const params = await searchParams

  // Parse filters from URL params
  const filters: TenantFilters = {
    legalForm: params.legalForm,
    subscriptionStatus: params.subscriptionStatus,
    flags: params.flags,
    hasAlerts:
      params.hasAlerts === "true" ? true : params.hasAlerts === "false" ? false : undefined,
    search: params.search,
  }

  // Parse sort from URL params
  const sort: TenantSort = {
    field: (params.sortField as TenantSortField) || "createdAt",
    order: (params.sortOrder as TenantSortOrder) || "desc",
  }

  // Parse pagination from URL params
  const pagination: TenantPagination = {
    page: parseInt(params.page || "1", 10),
    pageSize: parseInt(params.pageSize || "20", 10),
  }

  // Fetch tenant list with caching
  const result = await getCachedTenantList(filters, sort, pagination)

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TenantListView data={result} />
    </Suspense>
  )
}
