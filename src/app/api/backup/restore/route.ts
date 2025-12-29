// src/app/api/backup/restore/route.ts
// POST endpoint for restoring company data from backup

import { NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { validateBackupData } from "@/lib/backup/export"
import { restoreCompanyData, parseBackupJson, RestoreMode } from "@/lib/backup/restore"
import { logger } from "@/lib/logger"

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Parse the request body
    const contentType = request.headers.get("content-type") || ""
    let backupData
    let mode: RestoreMode = "merge"
    let skipContacts = false
    let skipProducts = false
    let skipInvoices = false
    let skipExpenses = false

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get("file") as File | null

      if (!file) {
        return NextResponse.json({ error: "No backup file provided" }, { status: 400 })
      }

      const fileContent = await file.text()
      backupData = parseBackupJson(fileContent)

      // Get options from form data
      const modeParam = formData.get("mode") as string | null
      if (modeParam === "replace" || modeParam === "merge") {
        mode = modeParam
      }
      skipContacts = formData.get("skipContacts") === "true"
      skipProducts = formData.get("skipProducts") === "true"
      skipInvoices = formData.get("skipInvoices") === "true"
      skipExpenses = formData.get("skipExpenses") === "true"
    } else {
      // Handle JSON body
      const body = await request.json()

      if (!body.data) {
        return NextResponse.json({ error: "No backup data provided" }, { status: 400 })
      }

      // If data is a string, parse it
      if (typeof body.data === "string") {
        backupData = parseBackupJson(body.data)
      } else {
        backupData = body.data
        // Convert date strings to Date objects
        if (backupData.createdAt && typeof backupData.createdAt === "string") {
          backupData.createdAt = new Date(backupData.createdAt)
        }
      }

      if (body.mode === "replace" || body.mode === "merge") {
        mode = body.mode
      }
      skipContacts = body.skipContacts === true
      skipProducts = body.skipProducts === true
      skipInvoices = body.skipInvoices === true
      skipExpenses = body.skipExpenses === true
    }

    // Validate the backup data
    const validation = validateBackupData(backupData)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid backup data", details: validation.errors },
        { status: 400 }
      )
    }

    logger.info(
      {
        userId: user.id,
        companyId: company.id,
        mode,
        skipContacts,
        skipProducts,
        skipInvoices,
        skipExpenses,
        operation: "backup_restore_request",
      },
      "Backup restore requested"
    )

    // Perform the restore
    const result = await restoreCompanyData(backupData, {
      companyId: company.id,
      userId: user.id!,
      mode,
      skipContacts,
      skipProducts,
      skipInvoices,
      skipExpenses,
    })

    logger.info(
      {
        userId: user.id,
        companyId: company.id,
        mode,
        counts: result.counts,
        success: result.success,
        operation: "backup_restore_complete",
      },
      "Backup restore completed"
    )

    return NextResponse.json({
      success: result.success,
      mode: result.mode,
      counts: result.counts,
      errors: result.errors.length > 0 ? result.errors : undefined,
      restoredAt: result.restoredAt.toISOString(),
    })
  } catch (error) {
    logger.error({ error }, "Backup restore failed")

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Restore failed", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: "Restore failed due to unknown error" },
      { status: 500 }
    )
  }
}
