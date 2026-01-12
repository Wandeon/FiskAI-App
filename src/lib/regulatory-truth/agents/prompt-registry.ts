// src/lib/regulatory-truth/agents/prompt-registry.ts
//
// Single canonical source for prompt provenance.
// Prevents templateId drift across workers.

import { createHash } from "crypto"
import type { AgentType } from "../schemas"
import { getAgentPrompt } from "../prompts"

// Prompt template version - update when prompts change significantly
// Format: YYYY-MM-DD or semver
export const PROMPT_VERSION = "2026-01-12"

// Template IDs follow pattern: rtl.{agentType}.v{major}
const TEMPLATE_IDS: Record<string, string> = {
  SENTINEL: "rtl.sentinel.v1",
  EXTRACTOR: "rtl.extractor.v1",
  COMPOSER: "rtl.composer.v1",
  REVIEWER: "rtl.reviewer.v1",
  RELEASER: "rtl.releaser.v1",
  ARBITER: "rtl.arbiter.v1",
  CONTENT_CLASSIFIER: "rtl.content-classifier.v1",
  CLAIM_EXTRACTOR: "rtl.claim-extractor.v1",
  PROCESS_EXTRACTOR: "rtl.process-extractor.v1",
  REFERENCE_EXTRACTOR: "rtl.reference-extractor.v1",
  ASSET_EXTRACTOR: "rtl.asset-extractor.v1",
  TRANSITIONAL_EXTRACTOR: "rtl.transitional-extractor.v1",
  COMPARISON_EXTRACTOR: "rtl.comparison-extractor.v1",
  QUERY_CLASSIFIER: "rtl.query-classifier.v1",
  EXEMPTION_EXTRACTOR: "rtl.exemption-extractor.v1",
}

export interface PromptProvenance {
  templateId: string
  version: string
  promptHash: string
}

/**
 * Build the final prompt text for an agent.
 * This is the exact string sent to the LLM.
 */
export function buildPrompt(agentType: AgentType, input: unknown): string {
  const systemPrompt = getAgentPrompt(agentType)
  const userMessage = `INPUT:\n${JSON.stringify(input, null, 2)}\n\nPlease process this input and return the result in the specified JSON format.`

  // Format matches what runner.ts sends to Ollama
  const responseFormatInstructions =
    "\n\n" +
    "RESPONSE FORMAT REQUIREMENTS:\n" +
    "1. Your response must be ONLY a valid JSON object\n" +
    "2. Start your response directly with { - no preamble text\n" +
    "3. Do NOT wrap in markdown code blocks (no ```json)\n" +
    "4. Do NOT include any thinking, explanation, or commentary\n" +
    "5. End your response with } - nothing after\n" +
    '6. If you cannot extract any data, return: {"extractions": [], "extraction_metadata": {"total_extractions": 0, "processing_notes": "No extractable data found"}}'

  return systemPrompt + responseFormatInstructions + "\n\n[USER]\n" + userMessage
}

/**
 * Compute SHA256 hash of the final prompt text.
 */
export function computePromptHash(promptText: string): string {
  return createHash("sha256").update(promptText, "utf8").digest("hex")
}

/**
 * Get prompt provenance for an agent run.
 * Returns templateId, version, and hash of the actual prompt sent.
 */
export function getPromptProvenance(agentType: AgentType, input: unknown): PromptProvenance {
  const templateId = TEMPLATE_IDS[agentType] || `rtl.${agentType.toLowerCase()}.v1`
  const promptText = buildPrompt(agentType, input)
  const promptHash = computePromptHash(promptText)

  return {
    templateId,
    version: PROMPT_VERSION,
    promptHash,
  }
}
