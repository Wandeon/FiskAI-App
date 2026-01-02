import { db } from "@/lib/db"
import { THRESHOLDS } from "@/lib/fiscal-data/data/thresholds"

export interface TenantFilters {
  legalForm?: string
  subscriptionStatus?: string
  flags?: string
  hasAlerts?: boolean
  search?: string
}

export type TenantSortField = "name" | "createdAt" | "revenue" | "lastLogin"
export type TenantSortOrder = "asc" | "desc"

export interface TenantSort {
  field: TenantSortField
  order: TenantSortOrder
}

export interface TenantPagination {
  page: number
  pageSize: number
}

export interface TenantListItem {
  id: string
  name: string
  oib: string
  legalForm: string
  subscriptionStatus: string
  subscriptionPlan: string
  createdAt: Date
  yearlyRevenue: number
  lastLoginAt: Date | null
  flags: string[]
  userCount: number
  invoiceCount: number
  moduleCount: number
}

export interface TenantListResult {
  tenants: TenantListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getTenantList(
  filters: TenantFilters = {},
  sort: TenantSort = { field: "createdAt", order: "desc" },
  pagination: TenantPagination = { page: 1, pageSize: 20 }
): Promise<TenantListResult> {
  // Build where clause - using Prisma.CompanyWhereInput would require importing Prisma types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma where clause with dynamic conditions
  const where: Record<string, unknown> = {}

  if (filters.legalForm) {
    where.legalForm = filters.legalForm
  }

  if (filters.subscriptionStatus) {
    where.subscriptionStatus = filters.subscriptionStatus
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { oib: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  // Fetch companies with related data
  const [companies, total] = await Promise.all([
    db.company.findMany({
      where,
      include: {
        users: {
          where: { role: "OWNER" },
          include: { user: true },
        },
        eInvoices: {
          where: {
            createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
            status: { not: "DRAFT" },
          },
          select: { totalAmount: true },
        },
        _count: {
          select: {
            users: true,
            eInvoices: true,
          },
        },
      },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    db.company.count({ where }),
  ])

  // Calculate derived data for each tenant
  const limit = THRESHOLDS.pausalni.value
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  let tenants = companies.map((company) => {
    const owner = company.users[0]?.user
    const yearlyRevenue = company.eInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)

    // Calculate flags
    const flags: string[] = []

    if (!company.fiscalEnabled && company.createdAt < sevenDaysAgo) {
      flags.push("stuck-onboarding")
    }
    if (yearlyRevenue >= limit * 0.85) {
      flags.push("approaching-limit")
    }
    if (yearlyRevenue >= limit * 0.95) {
      flags.push("critical-limit")
    }
    if (!owner?.updatedAt || owner.updatedAt < thirtyDaysAgo) {
      flags.push("inactive")
    }

    return {
      id: company.id,
      name: company.name,
      oib: company.oib || "",
      legalForm: company.legalForm || "UNKNOWN",
      subscriptionStatus: company.subscriptionStatus || "none",
      subscriptionPlan: company.subscriptionPlan || "free",
      createdAt: company.createdAt,
      yearlyRevenue,
      lastLoginAt: owner?.updatedAt || null,
      flags,
      userCount: company._count.users,
      invoiceCount: company._count.eInvoices,
      moduleCount: (company.entitlements as string[])?.length || 0,
    }
  })

  // Apply flag filter if specified
  if (filters.flags) {
    tenants = tenants.filter((t) => t.flags.includes(filters.flags!))
  }

  // Apply hasAlerts filter
  if (filters.hasAlerts !== undefined) {
    tenants = tenants.filter((t) => (filters.hasAlerts ? t.flags.length > 0 : t.flags.length === 0))
  }

  // Sort the results
  tenants.sort((a, b) => {
    let aValue: string | number
    let bValue: string | number

    switch (sort.field) {
      case "name":
        aValue = a.name.toLowerCase()
        bValue = b.name.toLowerCase()
        break
      case "createdAt":
        aValue = a.createdAt.getTime()
        bValue = b.createdAt.getTime()
        break
      case "revenue":
        aValue = a.yearlyRevenue
        bValue = b.yearlyRevenue
        break
      case "lastLogin":
        aValue = a.lastLoginAt?.getTime() || 0
        bValue = b.lastLoginAt?.getTime() || 0
        break
      default:
        aValue = a.createdAt.getTime()
        bValue = b.createdAt.getTime()
    }

    if (aValue < bValue) return sort.order === "asc" ? -1 : 1
    if (aValue > bValue) return sort.order === "asc" ? 1 : -1
    return 0
  })

  const totalPages = Math.ceil(total / pagination.pageSize)

  return {
    tenants,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages,
  }
}
