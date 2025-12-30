"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { resend } from "@/lib/email"
import { revalidatePath } from "next/cache"
import { checkRateLimit } from "@/lib/security/rate-limit"
import { logAudit } from "@/lib/audit"

/**
 * Available module keys that can be gifted to tenants
 */
const AVAILABLE_MODULES = [
  "invoicing",
  "e-invoicing",
  "fiscalization",
  "contacts",
  "products",
  "expenses",
  "banking",
  "reconciliation",
  "reports-basic",
  "reports-advanced",
  "pausalni",
  "vat",
  "corporate-tax",
  "pos",
  "documents",
  "ai-assistant",
] as const

/**
 * Available flags that can be set on tenants
 */
const AVAILABLE_FLAGS = ["needs-help", "at-risk", "churning"] as const

type ModuleKey = (typeof AVAILABLE_MODULES)[number]
type FlagKey = (typeof AVAILABLE_FLAGS)[number]

/**
 * Helper function to require ADMIN role
 */
async function requireAdmin() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized: Not authenticated")
  }
  if (session.user.systemRole !== "ADMIN") {
    throw new Error("Unauthorized: ADMIN role required")
  }
  return session.user
}

/**
 * Send email to tenant's company owner
 */
export async function sendEmailToTenant(
  companyId: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()

    // Get company with owner
    const company = await db.company.findUnique({
      where: { id: companyId },
      include: {
        users: {
          where: { role: "OWNER" },
          include: { user: true },
        },
      },
    })

    if (!company) {
      return { success: false, error: "Company not found" }
    }

    const owner = company.users[0]?.user
    if (!owner) {
      return { success: false, error: "Company has no owner" }
    }

    if (!resend) {
      return { success: false, error: "Email service not configured" }
    }

    // Send email using plain text body
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "FiskAI <noreply@fiskai.hr>",
      to: owner.email,
      subject,
      text: body,
    })

    if (result.error) {
      console.error("Failed to send email to tenant:", result.error)
      return { success: false, error: result.error.message || "Failed to send email" }
    }

    revalidatePath(`/tenants/${companyId}`)
    return { success: true }
  } catch (error) {
    console.error("Error sending email to tenant:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Gift a module to a tenant by adding it to their entitlements
 */
export async function giftModuleToTenant(
  companyId: string,
  moduleKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()

    // Validate module key
    if (!AVAILABLE_MODULES.includes(moduleKey as ModuleKey)) {
      return { success: false, error: `Invalid module key: ${moduleKey}` }
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { entitlements: true },
    })

    if (!company) {
      return { success: false, error: "Company not found" }
    }

    // Get current entitlements
    const currentEntitlements = (company.entitlements as string[]) || []

    // Check if module already exists
    if (currentEntitlements.includes(moduleKey)) {
      return { success: false, error: `Module ${moduleKey} already enabled` }
    }

    // Add module to entitlements
    const updatedEntitlements = [...currentEntitlements, moduleKey]

    await db.company.update({
      where: { id: companyId },
      data: { entitlements: updatedEntitlements },
    })

    revalidatePath(`/tenants/${companyId}`)
    return { success: true }
  } catch (error) {
    console.error("Error gifting module to tenant:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Add or remove a flag on a tenant
 */
export async function flagTenant(
  companyId: string,
  flag: string,
  reason: string,
  action: "add" | "remove" = "add"
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin()

    // Validate flag
    if (!AVAILABLE_FLAGS.includes(flag as FlagKey)) {
      return { success: false, error: `Invalid flag: ${flag}` }
    }

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { featureFlags: true },
    })

    if (!company) {
      return { success: false, error: "Company not found" }
    }

    // Get current feature flags
    const currentFlags = (company.featureFlags as Record<string, any>) || {}
    const adminFlags = (currentFlags.adminFlags as string[]) || []

    let updatedAdminFlags: string[]

    if (action === "add") {
      // Add flag if not already present
      if (adminFlags.includes(flag)) {
        return { success: false, error: `Flag ${flag} already set` }
      }
      updatedAdminFlags = [...adminFlags, flag]
    } else {
      // Remove flag
      if (!adminFlags.includes(flag)) {
        return { success: false, error: `Flag ${flag} not found` }
      }
      updatedAdminFlags = adminFlags.filter((f) => f !== flag)
    }

    // Update feature flags with admin flags and reason
    const updatedFlags = {
      ...currentFlags,
      adminFlags: updatedAdminFlags,
      [`${flag}_reason`]: action === "add" ? reason : undefined,
    }

    await db.company.update({
      where: { id: companyId },
      data: { featureFlags: updatedFlags },
    })

    revalidatePath(`/tenants/${companyId}`)
    return { success: true }
  } catch (error) {
    console.error("Error flagging tenant:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Export tenant data as JSON
 * Security features:
 * - Rate limiting (10 exports/hour per admin)
 * - Audit logging with admin user tracking
 * - Redacted bank account balances
 * - Tenant notification on data export
 */
export async function exportTenantData(
  companyId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const admin = await requireAdmin()

    // Check rate limit (10 exports per hour per admin)
    const rateLimitCheck = await checkRateLimit(admin.id, "ADMIN_EXPORT")
    if (!rateLimitCheck.allowed) {
      const resetIn = rateLimitCheck.resetAt
        ? Math.ceil((rateLimitCheck.resetAt - Date.now()) / 60000)
        : 60
      return {
        success: false,
        error: `Ograničenje brzine: Previše zahtjeva za izvoz. Pokušajte ponovno za ${resetIn} minuta.`,
      }
    }

    // Fetch comprehensive tenant data
    const company = await db.company.findUnique({
      where: { id: companyId },
      include: {
        users: {
          include: { user: true },
        },
        eInvoices: {
          select: {
            id: true,
            direction: true,
            invoiceNumber: true,
            issueDate: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 100, // Limit to recent invoices
        },
        expenses: {
          select: {
            id: true,
            description: true,
            date: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        contacts: {
          select: {
            id: true,
            type: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
        bankAccounts: {
          select: {
            id: true,
            name: true,
            iban: true,
            currency: true,
            // currentBalance excluded for security - sensitive financial data
          },
        },
      },
    })

    if (!company) {
      return { success: false, error: "Company not found" }
    }

    // Calculate statistics
    const yearlyRevenue = company.eInvoices
      .filter(
        (inv) => inv.status !== "DRAFT" && inv.issueDate.getFullYear() === new Date().getFullYear()
      )
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0)

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
      company: {
        id: company.id,
        name: company.name,
        oib: company.oib,
        legalForm: company.legalForm,
        isVatPayer: company.isVatPayer,
        fiscalEnabled: company.fiscalEnabled,
        createdAt: company.createdAt,
        subscriptionPlan: company.subscriptionPlan,
        subscriptionStatus: company.subscriptionStatus,
        entitlements: company.entitlements,
        featureFlags: company.featureFlags,
      },
      users: company.users.map((cu) => ({
        email: cu.user.email,
        name: cu.user.name,
        role: cu.role,
        createdAt: cu.user.createdAt,
        lastLogin: cu.user.updatedAt,
      })),
      statistics: {
        totalInvoices: company.eInvoices.length,
        totalExpenses: company.expenses.length,
        totalContacts: company.contacts.length,
        yearlyRevenue,
      },
      invoices: company.eInvoices,
      expenses: company.expenses,
      contacts: company.contacts,
      bankAccounts: company.bankAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        iban: account.iban,
        currency: account.currency,
        // currentBalance intentionally excluded - sensitive financial data
      })),
    }

    // Log audit event (fire-and-forget)
    logAudit({
      companyId,
      userId: admin.id,
      action: "EXPORT",
      entity: "TenantData",
      entityId: companyId,
      changes: {
        after: {
          exportedBy: admin.email,
          exportedAt: exportData.exportedAt,
          recordCounts: {
            users: company.users.length,
            invoices: company.eInvoices.length,
            expenses: company.expenses.length,
            contacts: company.contacts.length,
            bankAccounts: company.bankAccounts.length,
          },
        },
      },
    })

    // Send notification to tenant owner (fire-and-forget)
    const owner = company.users.find((cu) => cu.role === "OWNER")?.user
    if (owner && resend) {
      resend.emails
        .send({
          from: process.env.RESEND_FROM_EMAIL || "FiskAI <noreply@fiskai.hr>",
          to: owner.email,
          subject: "Obavijest o izvozu podataka / Data Export Notification",
          text: `Poštovani,

Obavještavamo Vas da je administrator FiskAI platforme izvezao podatke Vaše tvrtke ${company.name}.

Detalji izvoza:
- Izvezao: ${admin.email}
- Vrijeme: ${new Date(exportData.exportedAt).toLocaleString("hr-HR")}
- Broj zapisa: ${company.users.length} korisnika, ${company.eInvoices.length} računa, ${company.expenses.length} troškova

Ako imate pitanja ili primjedbe vezane uz ovaj izvoz, molimo kontaktirajte FiskAI podršku.

---

Dear User,

This is to notify you that a FiskAI platform administrator has exported data for your company ${company.name}.

Export details:
- Exported by: ${admin.email}
- Time: ${new Date(exportData.exportedAt).toLocaleString("en-US")}
- Record counts: ${company.users.length} users, ${company.eInvoices.length} invoices, ${company.expenses.length} expenses

If you have any questions or concerns about this export, please contact FiskAI support.

Srdačno / Best regards,
FiskAI Tim / Team`,
        })
        .catch((error) => {
          console.error("Failed to send tenant notification:", error)
          // Don't fail the export if notification fails
        })
    }

    return { success: true, data: exportData }
  } catch (error) {
    console.error("Error exporting tenant data:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
