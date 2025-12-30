import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth-utils"
import { getCertificateStatus, getFiscalizationStats } from "@/lib/compliance/data"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  await requireAdmin()
  const { companyId } = await params

  try {
    const [
      company,
      userCount,
      lastInvoice,
      lastTicket,
      openTicketCount,
      certificateStatus,
      fiscalStats,
    ] = await Promise.all([
      db.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          legalForm: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          trialEndsAt: true,
          fiscalEnabled: true,
          fiscalEnvironment: true,
          invoiceLimit: true,
          userLimit: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.companyUser.count({ where: { companyId } }),
      db.eInvoice.findFirst({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      }),
      db.supportTicket.findFirst({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      }),
      db.supportTicket.count({
        where: { companyId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      getCertificateStatus(companyId),
      getFiscalizationStats(companyId),
    ])

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    return NextResponse.json({
      company,
      userCount,
      lastInvoice,
      lastTicket,
      openTicketCount,
      certificateStatus,
      fiscalization: fiscalStats,
    })
  } catch (error) {
    console.error("Admin tenant health error:", error)
    return NextResponse.json({ error: "Failed to fetch tenant health" }, { status: 500 })
  }
}
