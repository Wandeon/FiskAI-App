// src/lib/regulatory-truth/workers/ocr.worker.ts
// OCR worker: processes scanned PDFs and creates text artifacts

import { Job } from "bullmq"
import { createWorker, setupGracefulShutdown, type JobResult } from "./base"
import { extractQueue } from "./queues"
import { jobsProcessed, jobDuration } from "./metrics"
import { db } from "@/lib/db"
import { processScannedPdf } from "../utils/ocr-processor"
import { hashContent } from "../utils/content-hash"
import { logWorkerStartup } from "./startup-log"
import { requestOcrReview } from "../services/human-review-service"

logWorkerStartup("ocr")

interface OcrJobData {
  evidenceId: string
  runId: string
}

async function processOcrJob(job: Job<OcrJobData>): Promise<JobResult> {
  const start = Date.now()
  const { evidenceId, runId } = job.data

  try {
    // 1. Get evidence
    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
    })

    if (!evidence) {
      return { success: false, duration: 0, error: `Evidence not found: ${evidenceId}` }
    }

    if (evidence.contentClass !== "PDF_SCANNED") {
      return {
        success: false,
        duration: 0,
        error: `Evidence ${evidenceId} is not PDF_SCANNED (is ${evidence.contentClass})`,
      }
    }

    // Check if already processed
    const existingArtifact = await db.evidenceArtifact.findFirst({
      where: { evidenceId, kind: "OCR_TEXT" },
    })

    if (existingArtifact) {
      console.log(`[ocr] Evidence ${evidenceId} already has OCR_TEXT artifact, skipping`)
      return { success: true, duration: 0, data: { skipped: true } }
    }

    // 2. Decode PDF from base64
    console.log(`[ocr] Processing evidence ${evidenceId}...`)
    const pdfBuffer = Buffer.from(evidence.rawContent, "base64")

    // 3. Run OCR pipeline
    const ocrResult = await processScannedPdf(pdfBuffer)

    if (!ocrResult.text || ocrResult.text.trim().length === 0) {
      // Mark as failed with metadata
      await db.evidence.update({
        where: { id: evidenceId },
        data: {
          ocrMetadata: {
            error: "No text extracted",
            processingMs: ocrResult.processingMs,
            needsManualReview: true,
          },
        },
      })
      // Create centralized human review request (Issue #884)
      await requestOcrReview(evidenceId, { error: "No text extracted" })
      return { success: false, duration: Date.now() - start, error: "No text extracted from OCR" }
    }

    // 4. Create OCR artifact
    const artifact = await db.evidenceArtifact.create({
      data: {
        evidenceId,
        kind: "OCR_TEXT",
        content: ocrResult.text,
        contentHash: hashContent(ocrResult.text),
        pageMap: ocrResult.pages.map((p) => ({
          page: p.pageNum,
          confidence: p.confidence,
          method: p.method,
        })),
      },
    })

    // 5. Update evidence with OCR metadata
    await db.evidence.update({
      where: { id: evidenceId },
      data: {
        primaryTextArtifactId: artifact.id,
        ocrMetadata: {
          method: ocrResult.method,
          language: "hrv+eng",
          pages: ocrResult.pages.length,
          avgConfidence: ocrResult.avgConfidence,
          processingMs: ocrResult.processingMs,
          failedPages: ocrResult.failedPages,
          needsManualReview: ocrResult.needsManualReview,
          engineVersion: "tesseract 5.x",
        },
      },
    })

    // Create centralized human review request if needed (Issue #884)
    if (ocrResult.needsManualReview) {
      await requestOcrReview(evidenceId, {
        avgConfidence: ocrResult.avgConfidence,
        failedPages: ocrResult.failedPages,
      })
    }

    // 6. Queue for extraction (now has text artifact)
    await extractQueue.add("extract", { evidenceId, runId })

    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "ocr", status: "success", queue: "ocr" })
    jobDuration.observe({ worker: "ocr", queue: "ocr" }, duration / 1000)

    console.log(
      `[ocr] Completed ${evidenceId}: ${ocrResult.pages.length} pages, ` +
        `conf=${ocrResult.avgConfidence.toFixed(1)}%, time=${duration}ms`
    )

    return {
      success: true,
      duration,
      data: {
        pages: ocrResult.pages.length,
        avgConfidence: ocrResult.avgConfidence,
        method: ocrResult.method,
        textLength: ocrResult.text.length,
      },
    }
  } catch (error) {
    jobsProcessed.inc({ worker: "ocr", status: "failed", queue: "ocr" })

    // Store error in metadata
    await db.evidence
      .update({
        where: { id: evidenceId },
        data: {
          ocrMetadata: {
            error: error instanceof Error ? error.message : String(error),
            needsManualReview: true,
          },
        },
      })
      .catch(() => {})

    return {
      success: false,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
// Concurrency 1 because OCR is CPU-intensive
const worker = createWorker<OcrJobData>("ocr", processOcrJob, {
  name: "ocr",
  concurrency: 1,
})

setupGracefulShutdown([worker])

console.log("[ocr] Worker started")
