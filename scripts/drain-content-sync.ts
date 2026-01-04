#!/usr/bin/env npx tsx

/**
 * Drains pending content sync events from the database into the BullMQ queue.
 *
 * This script finds all events with status=PENDING and enqueues them for processing.
 * Safe to run multiple times - uses eventId as jobId for deduplication.
 *
 * Usage: npx tsx scripts/drain-content-sync.ts
 */

import { eq } from "drizzle-orm"
import { drizzleDb } from "../src/lib/db/drizzle"
import { contentSyncEvents } from "../src/lib/db/schema/content-sync"
import { enqueueContentSyncJob } from "../src/lib/regulatory-truth/workers/content-sync.worker"

async function drainPendingEvents() {
  console.log("Draining pending content sync events...\n")

  // Find all PENDING events
  const pending = await drizzleDb
    .select({
      eventId: contentSyncEvents.eventId,
      conceptId: contentSyncEvents.conceptId,
      type: contentSyncEvents.type,
      createdAt: contentSyncEvents.createdAt,
    })
    .from(contentSyncEvents)
    .where(eq(contentSyncEvents.status, "PENDING"))
    .orderBy(contentSyncEvents.createdAt)

  console.log(`Found ${pending.length} pending events\n`)

  if (pending.length === 0) {
    console.log("Nothing to drain.")
    return
  }

  let enqueued = 0
  let errors = 0

  for (const event of pending) {
    try {
      console.log(`Enqueueing: ${event.eventId.slice(0, 8)}... (${event.conceptId}, ${event.type})`)
      await enqueueContentSyncJob(event.eventId)
      enqueued++
    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : error}`)
      errors++
    }
  }

  console.log(`\nDone!`)
  console.log(`  Enqueued: ${enqueued}`)
  console.log(`  Errors: ${errors}`)
}

// Run
drainPendingEvents()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
