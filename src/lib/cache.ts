import { cache } from "react"
import { unstable_cache } from "next/cache"
import {
  getAdminMetrics,
  getComplianceHealth,
  getOnboardingFunnel,
  getRecentSignups,
} from "./admin/metrics"
import { getTenantList } from "./admin/tenant-list"
import type { TenantFilters, TenantSort, TenantPagination } from "./admin/tenant-list"

/**
 * Cache configuration
 * - Admin metrics: 5 minutes (frequently changing data)
 * - Compliance health: 5 minutes (frequently changing data)
 * - Tenant list: 1 minute (user expects fresh data)
 */

/**
 * Cached version of getAdminMetrics
 * Revalidates every 5 minutes
 */
export const getCachedAdminMetrics = unstable_cache(
  async () => {
    return await getAdminMetrics()
  },
  ["admin-metrics"],
  {
    revalidate: 300, // 5 minutes
    tags: ["admin-metrics"],
  }
)

/**
 * Cached version of getOnboardingFunnel
 * Revalidates every 5 minutes
 */
export const getCachedOnboardingFunnel = unstable_cache(
  async () => {
    return await getOnboardingFunnel()
  },
  ["onboarding-funnel"],
  {
    revalidate: 300, // 5 minutes
    tags: ["admin-metrics", "onboarding"],
  }
)

/**
 * Cached version of getComplianceHealth
 * Revalidates every 5 minutes
 */
export const getCachedComplianceHealth = unstable_cache(
  async () => {
    return await getComplianceHealth()
  },
  ["compliance-health"],
  {
    revalidate: 300, // 5 minutes
    tags: ["admin-metrics", "compliance"],
  }
)

/**
 * Cached version of getRecentSignups
 * Revalidates every 1 minute
 */
export const getCachedRecentSignups = unstable_cache(
  async (limit: number = 5) => {
    return await getRecentSignups(limit)
  },
  ["recent-signups"],
  {
    revalidate: 60, // 1 minute
    tags: ["admin-metrics", "tenant-list"],
  }
)

/**
 * Cached version of getTenantList
 * Revalidates every 1 minute
 * Note: Cache key includes filters, sort, and pagination to cache different queries separately
 */
export const getCachedTenantList = cache(
  async (
    filters: TenantFilters = {},
    sort: TenantSort = { field: "createdAt", order: "desc" },
    pagination: TenantPagination = { page: 1, pageSize: 20 }
  ) => {
    // Use unstable_cache for server-side caching with revalidation
    const cacheKey = [
      "tenant-list",
      JSON.stringify(filters),
      JSON.stringify(sort),
      JSON.stringify(pagination),
    ]

    return await unstable_cache(
      async () => {
        return await getTenantList(filters, sort, pagination)
      },
      cacheKey,
      {
        revalidate: 60, // 1 minute
        tags: ["tenant-list", "admin-data"],
      }
    )()
  }
)

/**
 * Cache invalidation utilities
 * Use these to manually invalidate caches when data changes
 */
export const CACHE_TAGS = {
  ADMIN_METRICS: "admin-metrics",
  TENANT_LIST: "tenant-list",
  COMPLIANCE: "compliance",
  ONBOARDING: "onboarding",
  ADMIN_DATA: "admin-data",
} as const

/**
 * Helper to invalidate specific cache tags
 * Usage: await revalidateTag('admin-metrics')
 */
export { revalidateTag } from "next/cache"
