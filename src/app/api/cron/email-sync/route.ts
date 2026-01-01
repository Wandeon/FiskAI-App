// src/app/api/cron/email-sync/route.ts

import { NextResponse } from "next/server"
import { syncAllConnections } from "@/lib/email-sync/sync-service"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // SECURITY: Require CRON_SECRET to be configured
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET not configured")
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("[cron/email-sync] Starting email sync...")

    const results = await syncAllConnections()

    const summary = {
      connections: results.length,
      totalMessages: results.reduce((sum, r) => sum + r.messagesProcessed, 0),
      totalAttachments: results.reduce((sum, r) => sum + r.attachmentsSaved, 0),
      totalImportJobs: results.reduce((sum, r) => sum + r.importJobsCreated, 0),
      errors: results.flatMap((r) => r.errors),
    }

    console.log("[cron/email-sync] Completed:", summary)

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    console.error("[cron/email-sync] error:", error)
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    )
  }
}
