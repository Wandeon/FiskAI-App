// src/lib/email-sync/sync-service.ts

import crypto from "crypto"
import { db } from "@/lib/db"
import { getEmailProvider } from "./providers"
import { decryptSecret, encryptSecret } from "@/lib/secrets"
import { uploadToR2, generateR2Key } from "@/lib/r2-client"
import { redis } from "@/lib/regulatory-truth/workers/redis"
import type { EmailConnection, EmailImportRule } from "@prisma/client"
import type { EmailMessage, EmailAttachmentInfo } from "./types"

interface SyncResult {
  connectionId: string
  messagesProcessed: number
  attachmentsSaved: number
  importJobsCreated: number
  errors: string[]
  skipped?: string
}

export async function syncEmailConnection(
  connection: EmailConnection & { importRules: EmailImportRule[] }
): Promise<SyncResult> {
  const result: SyncResult = {
    connectionId: connection.id,
    messagesProcessed: 0,
    attachmentsSaved: 0,
    importJobsCreated: 0,
    errors: [],
  }

  try {
    const provider = getEmailProvider(connection.provider)

    // Get valid access token
    let accessToken: string
    const now = new Date()

    if (connection.accessTokenEnc && connection.tokenExpiresAt && connection.tokenExpiresAt > now) {
      accessToken = decryptSecret(connection.accessTokenEnc)
    } else {
      // Refresh token
      const refreshToken = decryptSecret(connection.refreshTokenEnc)
      const tokens = await provider.refreshToken(refreshToken)

      accessToken = tokens.accessToken

      // Update stored tokens
      await db.emailConnection.update({
        where: { id: connection.id },
        data: {
          accessTokenEnc: encryptSecret(tokens.accessToken),
          refreshTokenEnc: encryptSecret(tokens.refreshToken),
          tokenExpiresAt: tokens.expiresAt,
        },
      })
    }

    // Fetch messages
    let cursor = connection.syncCursor || undefined
    let hasMore = true

    while (hasMore) {
      const batch = await provider.fetchMessages(accessToken, cursor)

      for (const message of batch.messages) {
        result.messagesProcessed++

        for (const attachment of message.attachments) {
          try {
            await processAttachment(connection, message, attachment, accessToken, provider, result)
          } catch (attError) {
            result.errors.push(
              `Failed to process ${attachment.filename}: ${attError instanceof Error ? attError.message : "Unknown error"}`
            )
          }
        }
      }

      cursor = batch.nextCursor
      hasMore = !!batch.nextCursor

      // Update cursor after each batch
      await db.emailConnection.update({
        where: { id: connection.id },
        data: { syncCursor: cursor || null },
      })
    }

    // Update last sync time
    await db.emailConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Sync failed"
    result.errors.push(errorMessage)

    await db.emailConnection.update({
      where: { id: connection.id },
      data: {
        lastError: errorMessage,
        status: errorMessage.includes("token") ? "EXPIRED" : "ERROR",
      },
    })
  }

  return result
}

async function processAttachment(
  connection: EmailConnection & { importRules: EmailImportRule[] },
  message: EmailMessage,
  attachment: EmailAttachmentInfo,
  accessToken: string,
  provider: ReturnType<typeof getEmailProvider>,
  result: SyncResult
): Promise<void> {
  // Generate content hash for deduplication
  const contentHash = crypto
    .createHash("sha256")
    .update(`${message.id}:${attachment.id}:${attachment.filename}:${attachment.sizeBytes}`)
    .digest("hex")
    .slice(0, 32)

  // Check if already processed
  const existing = await db.emailAttachment.findUnique({
    where: {
      connectionId_contentHash: {
        connectionId: connection.id,
        contentHash,
      },
    },
  })

  if (existing) {
    return // Already processed
  }

  // Check if matches any import rules
  const matchesRule = connection.importRules.some((rule) => {
    if (!rule.isActive) return false

    if (rule.senderEmail && message.senderEmail.toLowerCase() !== rule.senderEmail.toLowerCase()) {
      return false
    }

    if (rule.senderDomain) {
      const domain = message.senderEmail.split("@")[1]?.toLowerCase()
      if (domain !== rule.senderDomain.toLowerCase()) return false
    }

    if (
      rule.subjectContains &&
      !message.subject.toLowerCase().includes(rule.subjectContains.toLowerCase())
    ) {
      return false
    }

    if (
      rule.filenameContains &&
      !attachment.filename.toLowerCase().includes(rule.filenameContains.toLowerCase())
    ) {
      return false
    }

    return true
  })

  // Download attachment
  const data = await provider.downloadAttachment(accessToken, message.id, attachment.id)

  // Upload to R2
  const r2Key = generateR2Key(connection.companyId, contentHash, attachment.filename)
  await uploadToR2(r2Key, data, attachment.mimeType)

  result.attachmentsSaved++

  // Create EmailAttachment record
  const emailAttachment = await db.emailAttachment.create({
    data: {
      companyId: connection.companyId,
      connectionId: connection.id,
      providerMessageId: message.id,
      providerAttachmentId: attachment.id,
      contentHash,
      receivedAt: message.receivedAt,
      senderEmail: message.senderEmail,
      subject: message.subject,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      r2Key,
      status: matchesRule ? "PENDING" : "SKIPPED",
    },
  })

  // If matches rule, create ImportJob
  if (matchesRule) {
    // Determine document type from filename/mime
    const isPdf = attachment.mimeType === "application/pdf" || attachment.filename.endsWith(".pdf")
    const isImage = attachment.mimeType.startsWith("image/")

    if (isPdf || isImage) {
      const importJob = await db.importJob.create({
        data: {
          companyId: connection.companyId,
          userId: "system", // System-initiated
          fileChecksum: contentHash,
          originalName: attachment.filename,
          storagePath: r2Key,
          status: "PENDING",
          documentType: "BANK_STATEMENT", // Default, AI will refine
        },
      })

      await db.emailAttachment.update({
        where: { id: emailAttachment.id },
        data: {
          importJobId: importJob.id,
          status: "IMPORTED",
        },
      })

      result.importJobsCreated++
    }
  }
}

export async function syncAllConnections(): Promise<SyncResult[]> {
  const connections = await db.emailConnection.findMany({
    where: {
      status: "CONNECTED",
    },
    include: {
      importRules: true,
    },
  })

  const results: SyncResult[] = []

  for (const connection of connections) {
    // Per-connection locking to prevent duplicate processing
    const lockKey = `email-sync:${connection.id}`
    const lockTTL = 600 // 10 minutes in seconds

    try {
      // Try to acquire lock with NX (only set if not exists) and EX (expiry)
      const acquired = await redis.set(lockKey, Date.now().toString(), "EX", lockTTL, "NX")

      if (!acquired) {
        // Lock already held by another process
        console.log(`[email-sync] Connection ${connection.id} already syncing, skipping`)
        results.push({
          connectionId: connection.id,
          messagesProcessed: 0,
          attachmentsSaved: 0,
          importJobsCreated: 0,
          errors: [],
          skipped: "Already syncing",
        })
        continue
      }

      // Lock acquired, proceed with sync
      try {
        const result = await syncEmailConnection(connection)
        results.push(result)
      } finally {
        // Always release lock after processing
        await redis.del(lockKey)
      }
    } catch (lockError) {
      // Handle Redis errors gracefully - proceed without lock if Redis unavailable
      console.error(`[email-sync] Lock error for connection ${connection.id}:`, lockError)
      const result = await syncEmailConnection(connection)
      results.push(result)
    }
  }

  return results
}
