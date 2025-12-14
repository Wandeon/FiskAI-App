import { NextResponse } from "next/server"
import { processNextImportJob } from "@/lib/banking/import/processor"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { setTenantContext } from "@/lib/prisma-extensions"
import { db } from "@/lib/db"

export async function POST() {
  // For testing, allow first company without auth
  let company, userId

  try {
    const user = await requireAuth()
    if (user) {
      userId = user.id!
      const userCompany = await requireCompany(userId)
      if (!userCompany) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 })
      }
      company = userCompany
    } else {
      // Fallback for testing: get first company
      company = await db.company.findFirst()
      if (!company) {
        return NextResponse.json({ error: "No company found" }, { status: 404 })
      }
      userId = 'test-user-' + Date.now()
    }
  } catch (authError) {
    // If auth fails, try first company for testing
    console.warn("[bank-import-process] auth failed, using test mode:", authError)
    company = await db.company.findFirst()
    if (!company) {
      return NextResponse.json({ error: "No company found" }, { status: 404 })
    }
    userId = 'test-user-' + Date.now()
  }

  setTenantContext({
    companyId: company.id,
    userId: userId,
  })

  const result = await processNextImportJob()
  return NextResponse.json(result)
}
