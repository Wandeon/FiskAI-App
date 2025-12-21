// src/lib/regulatory-truth/agents/sentinel.ts

import { createHash } from "crypto"
import { db } from "@/lib/db"
import {
  SentinelInputSchema,
  SentinelOutputSchema,
  type SentinelInput,
  type SentinelOutput,
} from "../schemas"
import { runAgent } from "./runner"

// =============================================================================
// FETCH HELPERS
// =============================================================================

async function fetchSourceContent(url: string): Promise<{
  content: string
  contentType: "html" | "pdf" | "xml"
}> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "FiskAI-Sentinel/1.0 (regulatory monitoring)",
      Accept: "text/html,application/xhtml+xml,application/xml,application/pdf",
      "Accept-Language": "hr-HR,hr;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const contentTypeHeader = response.headers.get("content-type") || ""
  let contentType: "html" | "pdf" | "xml" = "html"

  if (contentTypeHeader.includes("pdf")) {
    contentType = "pdf"
  } else if (contentTypeHeader.includes("xml")) {
    contentType = "xml"
  }

  const text = await response.text()

  // Basic HTML cleanup
  const content = text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()

  return { content, contentType }
}

function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

// =============================================================================
// SENTINEL AGENT
// =============================================================================

export interface SentinelResult {
  success: boolean
  output: SentinelOutput | null
  evidenceId: string | null
  hasChanged: boolean
  error: string | null
}

/**
 * Run the Sentinel agent to monitor a regulatory source
 */
export async function runSentinel(sourceId: string): Promise<SentinelResult> {
  // Get source from database
  const source = await db.regulatorySource.findUnique({
    where: { id: sourceId },
  })

  if (!source) {
    return {
      success: false,
      output: null,
      evidenceId: null,
      hasChanged: false,
      error: `Source not found: ${sourceId}`,
    }
  }

  try {
    // Fetch the source content
    const { content, contentType } = await fetchSourceContent(source.url)
    const contentHash = computeContentHash(content)
    const hasChanged = source.lastContentHash !== contentHash

    // Build input for agent
    const input: SentinelInput = {
      sourceUrl: source.url,
      previousHash: source.lastContentHash,
      sourceId: source.id,
    }

    // Run the agent to analyze changes
    const result = await runAgent<SentinelInput, SentinelOutput>({
      agentType: "SENTINEL",
      input,
      inputSchema: SentinelInputSchema,
      outputSchema: SentinelOutputSchema,
      temperature: 0.1,
    })

    if (!result.success || !result.output) {
      return {
        success: false,
        output: null,
        evidenceId: null,
        hasChanged: false,
        error: result.error,
      }
    }

    // Store evidence
    const evidence = await db.evidence.create({
      data: {
        sourceId: source.id,
        contentHash,
        rawContent: content,
        contentType,
        url: source.url,
        hasChanged,
        changeSummary: result.output.change_summary,
      },
    })

    // Update source last checked
    await db.regulatorySource.update({
      where: { id: source.id },
      data: {
        lastFetchedAt: new Date(),
        lastContentHash: contentHash,
      },
    })

    return {
      success: true,
      output: result.output,
      evidenceId: evidence.id,
      hasChanged,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
      output: null,
      evidenceId: null,
      hasChanged: false,
      error: `Sentinel error: ${error}`,
    }
  }
}
