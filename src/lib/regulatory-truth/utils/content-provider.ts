// src/lib/regulatory-truth/utils/content-provider.ts
// Provides extractable text content from Evidence, using artifacts when available

import { db, dbReg } from "@/lib/db"

export interface ExtractableContent {
  text: string
  source: "artifact" | "raw"
  artifactKind?: string
  contentClass: string
}

/**
 * Get the canonical text content for extraction.
 * Priority: primaryTextArtifact > OCR_TEXT > PDF_TEXT > rawContent
 */
export async function getExtractableContent(evidenceId: string): Promise<ExtractableContent> {
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      artifacts: {
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!evidence) {
    throw new Error(`Evidence not found: ${evidenceId}`)
  }

  // 1. Check primaryTextArtifactId (explicit pointer set by OCR worker)
  if (evidence.primaryTextArtifactId) {
    const primary = evidence.artifacts.find((a) => a.id === evidence.primaryTextArtifactId)
    if (primary) {
      return {
        text: primary.content,
        source: "artifact",
        artifactKind: primary.kind,
        contentClass: evidence.contentClass,
      }
    }
  }

  // 2. Fallback: find best artifact by kind priority
  const priority = ["OCR_TEXT", "PDF_TEXT", "HTML_CLEANED"]
  for (const kind of priority) {
    const artifact = evidence.artifacts.find((a) => a.kind === kind)
    if (artifact) {
      return {
        text: artifact.content,
        source: "artifact",
        artifactKind: artifact.kind,
        contentClass: evidence.contentClass,
      }
    }
  }

  // 3. Final fallback: rawContent (for HTML/JSON sources, or PDFs stored as text)
  return {
    text: evidence.rawContent,
    source: "raw",
    contentClass: evidence.contentClass,
  }
}

/**
 * Check if evidence is ready for extraction.
 * Scanned PDFs need OCR artifact first.
 */
export async function isReadyForExtraction(evidenceId: string): Promise<boolean> {
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      artifacts: {
        select: { kind: true },
      },
    },
  })

  if (!evidence) return false

  // Scanned PDFs need OCR artifact
  if (evidence.contentClass === "PDF_SCANNED") {
    return evidence.artifacts.some((a) => a.kind === "OCR_TEXT")
  }

  // Text PDFs need PDF_TEXT artifact
  if (evidence.contentClass === "PDF_TEXT") {
    return evidence.artifacts.some((a) => a.kind === "PDF_TEXT")
  }

  // HTML/JSON - rawContent is sufficient
  return true
}

/**
 * Get evidence with its primary text artifact loaded.
 */
export async function getEvidenceWithText(evidenceId: string) {
  return dbReg.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      source: true,
      artifacts: {
        where: {
          kind: { in: ["OCR_TEXT", "PDF_TEXT"] },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })
}
