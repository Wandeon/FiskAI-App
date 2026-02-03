/**
 * AI Diagnostic Endpoint
 *
 * Provides authenticated access for AI agents to debug production issues.
 * Supports querying as different user types: obrt, drustvo, admin, staff
 *
 * Security: Requires x-ai-secret header
 *
 * Usage:
 *   curl -H "x-ai-secret: <secret>" "https://app.fiskai.hr/api/ai-diag?action=status"
 *   curl -H "x-ai-secret: <secret>" "https://app.fiskai.hr/api/ai-diag?action=user&email=info@metrica.hr"
 *   curl -H "x-ai-secret: <secret>" "https://app.fiskai.hr/api/ai-diag?action=company&oib=12345678901"
 *   curl -H "x-ai-secret: <secret>" "https://app.fiskai.hr/api/ai-diag?action=page-debug&page=/e-invoices/new&userId=xxx"
 *   curl -H "x-ai-secret: <secret>" "https://app.fiskai.hr/api/ai-diag?action=recent-errors"
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { deriveCapabilities } from "@/lib/capabilities"
import { isOnboardingComplete, getOnboardingRoute } from "@/lib/auth-utils"
import { previewNextInvoiceNumber } from "@/lib/invoice-numbering"

const AI_SECRET = process.env.AI_DIAG_SECRET || "fiskai-ai-diag-2026"

export const dynamic = "force-dynamic"

type DiagAction =
  | "status"
  | "user"
  | "company"
  | "page-debug"
  | "recent-errors"
  | "list-users"
  | "test-page"

export async function GET(request: NextRequest) {
  // Security check
  const secret = request.headers.get("x-ai-secret")
  if (secret !== AI_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get("action") as DiagAction

  try {
    switch (action) {
      case "status":
        return handleStatus()

      case "user":
        return handleUserLookup(searchParams.get("email"), searchParams.get("id"))

      case "company":
        return handleCompanyLookup(searchParams.get("oib"), searchParams.get("id"))

      case "page-debug":
        return handlePageDebug(
          searchParams.get("page") || "/e-invoices/new",
          searchParams.get("userId") || searchParams.get("email")
        )

      case "recent-errors":
        return handleRecentErrors()

      case "list-users":
        return handleListUsers(searchParams.get("type"))

      case "test-page":
        return handleTestPage(
          searchParams.get("page") || "/e-invoices/new",
          searchParams.get("userId") || searchParams.get("email")
        )

      default:
        return NextResponse.json({
          error: "Unknown action",
          availableActions: [
            "status - System status and health",
            "user - Lookup user by email or id",
            "company - Lookup company by oib or id",
            "page-debug - Debug a specific page for a user",
            "recent-errors - Show recent application errors",
            "list-users - List users by type (obrt, drustvo, admin, staff)",
            "test-page - Simulate page load for a user",
          ],
          examples: [
            "?action=status",
            "?action=user&email=info@metrica.hr",
            "?action=company&oib=45480824373",
            "?action=page-debug&page=/e-invoices/new&email=info@metrica.hr",
            "?action=list-users&type=drustvo",
            "?action=test-page&page=/e-invoices/new&email=info@metrica.hr",
          ],
        })
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.split("\n").slice(0, 10) : undefined,
      },
      { status: 500 }
    )
  }
}

async function handleStatus() {
  const [userCount, companyCount, invoiceCount] = await Promise.all([
    db.user.count(),
    db.company.count(),
    db.eInvoice.count(),
  ])

  const memUsage = process.memoryUsage()

  return NextResponse.json({
    status: "operational",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || "unknown",
    counts: {
      users: userCount,
      companies: companyCount,
      invoices: invoiceCount,
    },
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
    },
    uptime: Math.round(process.uptime()),
  })
}

async function handleUserLookup(email: string | null, id: string | null) {
  if (!email && !id) {
    return NextResponse.json({ error: "Provide email or id parameter" }, { status: 400 })
  }

  const user = await db.user.findFirst({
    where: email ? { email } : { id: id! },
    include: {
      companies: {
        include: {
          company: {
            select: {
              id: true,
              name: true,
              oib: true,
              legalForm: true,
              email: true,
              address: true,
              postalCode: true,
              city: true,
              isVatPayer: true,
              entitlements: true,
              onboardingStep: true,
            },
          },
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const defaultCompany = user.companies.find((cu) => cu.isDefault)?.company

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      systemRole: user.systemRole,
      intendedBusinessType: user.intendedBusinessType,
      createdAt: user.createdAt,
    },
    companies: user.companies.map((cu) => ({
      companyId: cu.company.id,
      name: cu.company.name,
      oib: cu.company.oib,
      legalForm: cu.company.legalForm,
      role: cu.role,
      isDefault: cu.isDefault,
      email: cu.company.email,
      address: cu.company.address,
      postalCode: cu.company.postalCode,
      city: cu.company.city,
      isVatPayer: cu.company.isVatPayer,
      onboardingStep: cu.company.onboardingStep,
      isOnboardingComplete: isOnboardingComplete(cu.company),
      onboardingRoute: getOnboardingRoute(cu.company),
    })),
    defaultCompany: defaultCompany
      ? {
          id: defaultCompany.id,
          name: defaultCompany.name,
          isOnboardingComplete: isOnboardingComplete(defaultCompany),
          onboardingRoute: getOnboardingRoute(defaultCompany),
        }
      : null,
  })
}

async function handleCompanyLookup(oib: string | null, id: string | null) {
  if (!oib && !id) {
    return NextResponse.json({ error: "Provide oib or id parameter" }, { status: 400 })
  }

  const company = await db.company.findFirst({
    where: oib ? { oib } : { id: id! },
    include: {
      users: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              systemRole: true,
            },
          },
        },
      },
      _count: {
        select: {
          contacts: true,
          products: true,
          eInvoices: true,
          expenses: true,
        },
      },
    },
  })

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  const capabilities = deriveCapabilities(company)

  return NextResponse.json({
    company: {
      id: company.id,
      name: company.name,
      oib: company.oib,
      legalForm: company.legalForm,
      email: company.email,
      phone: company.phone,
      address: company.address,
      postalCode: company.postalCode,
      city: company.city,
      country: company.country,
      iban: company.iban,
      isVatPayer: company.isVatPayer,
      vatNumber: company.vatNumber,
      onboardingStep: company.onboardingStep,
      createdAt: company.createdAt,
    },
    onboarding: {
      isComplete: isOnboardingComplete(company),
      redirectRoute: getOnboardingRoute(company),
      missingFields: {
        name: !company.name?.trim(),
        oib: !company.oib?.match(/^\d{11}$/),
        legalForm: !company.legalForm,
        email: !company.email?.includes("@"),
      },
    },
    capabilities: {
      legalForm: capabilities.legalForm,
      isVatPayer: capabilities.isVatPayer,
      segment: capabilities.segment,
      visibility: capabilities.visibility,
      enabledModules: Object.entries(capabilities.modules)
        .filter(([, v]) => v.enabled)
        .map(([k]) => k),
    },
    users: company.users.map((cu) => ({
      userId: cu.user.id,
      email: cu.user.email,
      name: cu.user.name,
      systemRole: cu.user.systemRole,
      companyRole: cu.role,
      isDefault: cu.isDefault,
    })),
    counts: company._count,
  })
}

async function handlePageDebug(page: string, userIdentifier: string | null) {
  if (!userIdentifier) {
    return NextResponse.json({ error: "Provide userId or email parameter" }, { status: 400 })
  }

  // Find user
  const user = await db.user.findFirst({
    where: userIdentifier.includes("@") ? { email: userIdentifier } : { id: userIdentifier },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Get default company
  const companyUser = await db.companyUser.findFirst({
    where: { userId: user.id, isDefault: true },
    include: {
      company: true,
    },
  })

  if (!companyUser) {
    return NextResponse.json({
      page,
      user: { id: user.id, email: user.email },
      issue: "NO_COMPANY",
      message: "User has no default company - would redirect to /onboarding",
    })
  }

  const company = companyUser.company

  // Check onboarding status
  if (!isOnboardingComplete(company)) {
    return NextResponse.json({
      page,
      user: { id: user.id, email: user.email },
      company: { id: company.id, name: company.name, oib: company.oib },
      issue: "ONBOARDING_INCOMPLETE",
      message: `Would redirect to ${getOnboardingRoute(company)}`,
      missingFields: {
        name: !company.name?.trim(),
        oib: !company.oib?.match(/^\d{11}$/),
        legalForm: !company.legalForm,
        email: !company.email?.includes("@"),
      },
    })
  }

  // Page-specific debugging
  if (page === "/e-invoices/new") {
    return handleEInvoiceNewDebug(user, company)
  }

  return NextResponse.json({
    page,
    user: { id: user.id, email: user.email },
    company: { id: company.id, name: company.name },
    status: "WOULD_RENDER",
    message: "Page should render normally",
  })
}

async function handleEInvoiceNewDebug(
  user: { id: string; email: string | null },
  company: {
    id: string
    name: string
    oib: string
    address: string
    postalCode: string
    city: string
    legalForm: string | null
    isVatPayer: boolean
    entitlements: unknown
    featureFlags: unknown
  }
) {
  const issues: string[] = []

  // Check company fields needed by InvoiceForm
  if (!company.name) issues.push("company.name is empty")
  if (!company.address) issues.push("company.address is empty")
  if (!company.postalCode) issues.push("company.postalCode is empty")
  if (!company.city) issues.push("company.city is empty")

  // Check capabilities
  const capabilities = deriveCapabilities(company)

  // Check if capabilities.can function would cause serialization issues
  const hasCanFunction = typeof capabilities.can === "function"
  if (hasCanFunction) {
    issues.push("capabilities.can is a function - CANNOT be serialized to client component")
  }

  // Try to get invoice number
  let invoiceNumberResult: { success: boolean; data?: unknown; error?: string }
  try {
    const result = await previewNextInvoiceNumber(company.id)
    invoiceNumberResult = { success: true, data: result }
  } catch (e) {
    invoiceNumberResult = { success: false, error: e instanceof Error ? e.message : String(e) }
    issues.push(`previewNextInvoiceNumber failed: ${invoiceNumberResult.error}`)
  }

  // Check contacts and products
  const [contactCount, productCount] = await Promise.all([
    db.contact.count({ where: { companyId: company.id, type: "CUSTOMER" } }),
    db.product.count({ where: { companyId: company.id } }),
  ])

  // Check e-invoicing module
  if (!capabilities.modules["e-invoicing"]?.enabled) {
    issues.push("e-invoicing module is not enabled")
  }

  return NextResponse.json({
    page: "/e-invoices/new",
    user: { id: user.id, email: user.email },
    company: {
      id: company.id,
      name: company.name,
      address: company.address,
      postalCode: company.postalCode,
      city: company.city,
      legalForm: company.legalForm,
    },
    capabilities: {
      legalForm: capabilities.legalForm,
      isVatPayer: capabilities.isVatPayer,
      segment: capabilities.segment,
      visibility: capabilities.visibility,
      hasCanFunction,
      eInvoicingEnabled: capabilities.modules["e-invoicing"]?.enabled,
    },
    dataAvailable: {
      contacts: contactCount,
      products: productCount,
    },
    invoiceNumber: invoiceNumberResult,
    issues,
    diagnosis:
      issues.length === 0
        ? "No obvious issues found - page should render"
        : `Found ${issues.length} potential issues`,
  })
}

async function handleRecentErrors() {
  // This would need a proper error logging system
  // For now, return a placeholder
  return NextResponse.json({
    message: "Error logging not yet implemented",
    suggestion: "Check Coolify container logs or Sentry for production errors",
    commands: {
      coolifyLogs:
        'curl -s "http://152.53.146.3:8000/api/v1/applications/tgg4gkcco8k8s0wwg08cck40/logs" -H "Authorization: Bearer $TOKEN"',
    },
  })
}

async function handleListUsers(type: string | null) {
  let whereClause = {}

  if (type === "admin") {
    whereClause = { systemRole: "ADMIN" }
  } else if (type === "staff") {
    whereClause = { systemRole: "STAFF" }
  } else if (type === "obrt") {
    whereClause = {
      companies: {
        some: {
          company: {
            legalForm: { in: ["OBRT_PAUSAL", "OBRT_REAL", "OBRT_VAT"] },
          },
        },
      },
    }
  } else if (type === "drustvo") {
    whereClause = {
      companies: {
        some: {
          company: {
            legalForm: { in: ["DOO", "JDOO"] },
          },
        },
      },
    }
  }

  const users = await db.user.findMany({
    where: whereClause,
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      createdAt: true,
      companies: {
        where: { isDefault: true },
        select: {
          company: {
            select: {
              id: true,
              name: true,
              legalForm: true,
            },
          },
        },
      },
    },
  })

  return NextResponse.json({
    type: type || "all",
    count: users.length,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      systemRole: u.systemRole,
      createdAt: u.createdAt,
      defaultCompany: u.companies[0]?.company || null,
    })),
  })
}

async function handleTestPage(page: string, userIdentifier: string | null) {
  // This simulates what would happen when loading a page
  // Useful for debugging without actually hitting the page

  if (!userIdentifier) {
    return NextResponse.json({ error: "Provide userId or email parameter" }, { status: 400 })
  }

  const debugResult = await handlePageDebug(page, userIdentifier)
  const debugData = await debugResult.json()

  return NextResponse.json({
    simulation: true,
    page,
    ...debugData,
    nextSteps:
      debugData.issues?.length > 0
        ? debugData.issues.map((issue: string) => `Fix: ${issue}`)
        : ["Page should load successfully"],
  })
}
