import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const startTime = Date.now()

  try {
    // Collect metrics
    const [
      userCount,
      companyCount,
      contactCount,
      invoiceCount,
      invoicesByStatus,
    ] = await Promise.all([
      db.user.count(),
      db.company.count(),
      db.contact.count(),
      db.eInvoice.count(),
      db.eInvoice.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ])

    const dbQueryTime = Date.now() - startTime

    // Format as Prometheus text exposition format
    const metrics = [
      "# HELP fiskai_users_total Total number of registered users",
      "# TYPE fiskai_users_total gauge",
      `fiskai_users_total ${userCount}`,
      "",
      "# HELP fiskai_companies_total Total number of companies",
      "# TYPE fiskai_companies_total gauge",
      `fiskai_companies_total ${companyCount}`,
      "",
      "# HELP fiskai_contacts_total Total number of contacts",
      "# TYPE fiskai_contacts_total gauge",
      `fiskai_contacts_total ${contactCount}`,
      "",
      "# HELP fiskai_invoices_total Total number of invoices",
      "# TYPE fiskai_invoices_total gauge",
      `fiskai_invoices_total ${invoiceCount}`,
      "",
      "# HELP fiskai_invoices_by_status Number of invoices by status",
      "# TYPE fiskai_invoices_by_status gauge",
      ...invoicesByStatus.map(
        (s) => `fiskai_invoices_by_status{status="${s.status}"} ${s._count.id}`
      ),
      "",
      "# HELP fiskai_db_query_duration_ms Database query duration in milliseconds",
      "# TYPE fiskai_db_query_duration_ms gauge",
      `fiskai_db_query_duration_ms ${dbQueryTime}`,
      "",
      "# HELP fiskai_up Application up status (1 = up)",
      "# TYPE fiskai_up gauge",
      "fiskai_up 1",
    ].join("\n")

    return new NextResponse(metrics, {
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      },
    })
  } catch {
    const metrics = [
      "# HELP fiskai_up Application up status (1 = up, 0 = down)",
      "# TYPE fiskai_up gauge",
      "fiskai_up 0",
    ].join("\n")

    return new NextResponse(metrics, {
      status: 503,
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      },
    })
  }
}
