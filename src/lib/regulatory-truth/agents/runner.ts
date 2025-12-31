// src/lib/regulatory-truth/agents/runner.ts

import { z } from "zod"
import { db } from "@/lib/db"
import type { AgentType } from "../schemas"
import { getAgentPrompt } from "../prompts"

// =============================================================================
// AGENT TIMEOUT CONFIGURATION
// =============================================================================
// Per-agent timeout defaults based on expected workload:
// - Sentinel: Fast HTTP fetches (seconds)
// - OCR: CPU-intensive (up to 10 minutes for large PDFs)
// - Extractor: LLM call (2 minutes)
// - Composer: Complex LLM reasoning (3 minutes)
// - Reviewer: Fast checks (1 minute)
// - Arbiter: Conflict resolution (2 minutes)
// - Releaser: Publication (1 minute)
// - Others: Default to 2 minutes

const AGENT_TIMEOUTS: Record<string, number> = {
  SENTINEL: 30000, // 30 seconds
  OCR: 600000, // 10 minutes for large PDFs
  EXTRACTOR: 120000, // 2 minutes
  COMPOSER: 180000, // 3 minutes
  REVIEWER: 60000, // 1 minute
  ARBITER: 120000, // 2 minutes
  RELEASER: 60000, // 1 minute
  CONTENT_CLASSIFIER: 120000, // 2 minutes
  CLAIM_EXTRACTOR: 120000, // 2 minutes
  PROCESS_EXTRACTOR: 120000, // 2 minutes
  REFERENCE_EXTRACTOR: 120000, // 2 minutes
  ASSET_EXTRACTOR: 120000, // 2 minutes
  TRANSITIONAL_EXTRACTOR: 120000, // 2 minutes
  COMPARISON_EXTRACTOR: 120000, // 2 minutes
  QUERY_CLASSIFIER: 60000, // 1 minute
  EXEMPTION_EXTRACTOR: 120000, // 2 minutes
}

const DEFAULT_TIMEOUT_MS = 300000 // 5 minutes fallback

// =============================================================================
// OLLAMA CLIENT (reuse existing pattern)
// =============================================================================

// Read env vars lazily (at call time) to support dotenv loading after import
// Supports per-agent override via {AGENT_TYPE}_TIMEOUT_MS env var
// Falls back to AGENT_TIMEOUT_MS global override, then per-agent defaults
function getAgentTimeoutMs(agentType?: string): number {
  // Check for per-agent env var override (e.g., OCR_TIMEOUT_MS)
  if (agentType) {
    const envOverride = process.env[`${agentType}_TIMEOUT_MS`]
    if (envOverride) return parseInt(envOverride)
  }

  // Check for global env var override
  const globalOverride = process.env.AGENT_TIMEOUT_MS
  if (globalOverride) return parseInt(globalOverride)

  // Use per-agent default or fallback
  if (agentType && AGENT_TIMEOUTS[agentType]) {
    return AGENT_TIMEOUTS[agentType]
  }

  return DEFAULT_TIMEOUT_MS
}

function getOllamaEndpoint(): string {
  return process.env.OLLAMA_ENDPOINT || "https://ollama.com/api"
}

function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || "llama3.1"
}

function getOllamaHeaders(): HeadersInit {
  const apiKey = process.env.OLLAMA_API_KEY
  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`
  }
  return headers
}

// =============================================================================
// AGENT RUNNER
// =============================================================================

export interface AgentRunOptions<TInput, TOutput> {
  agentType: AgentType
  input: TInput
  inputSchema: z.ZodType<TInput>
  outputSchema: z.ZodType<TOutput>
  temperature?: number
  maxRetries?: number
  evidenceId?: string
  ruleId?: string
  softFail?: boolean // If true, returns error instead of throwing (default: true)
}

export interface AgentRunResult<TOutput> {
  success: boolean
  output: TOutput | null
  error: string | null
  runId: string
  durationMs: number
  tokensUsed: number | null
}

/**
 * Run an agent with full validation and logging.
 * Supports soft-fail mode (default) where failures return error results
 * instead of throwing, allowing pipelines to continue processing other items.
 */
export async function runAgent<TInput, TOutput>(
  options: AgentRunOptions<TInput, TOutput>
): Promise<AgentRunResult<TOutput>> {
  const startTime = Date.now()
  const {
    agentType,
    input,
    inputSchema,
    outputSchema,
    temperature = 0.1,
    maxRetries = 3,
    evidenceId,
    ruleId,
    softFail = true, // Default to soft-fail mode
  } = options

  // Validate input
  const inputValidation = inputSchema.safeParse(input)
  if (!inputValidation.success) {
    const errorMsg = `Invalid input: ${inputValidation.error.message}`
    const run = await db.agentRun.create({
      data: {
        agentType,
        status: "failed",
        input: input as object,
        error: errorMsg,
        durationMs: Date.now() - startTime,
        evidenceId,
        ruleId,
      },
    })
    return {
      success: false,
      output: null,
      error: errorMsg,
      runId: run.id,
      durationMs: Date.now() - startTime,
      tokensUsed: null,
    }
  }

  // Create run record
  const run = await db.agentRun.create({
    data: {
      agentType,
      status: "running",
      input: input as object,
      evidenceId,
      ruleId,
    },
  })

  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let timeoutId: NodeJS.Timeout | undefined
    try {
      // Get prompt template
      const systemPrompt = getAgentPrompt(agentType)

      // Build user message with input
      const userMessage = `INPUT:\n${JSON.stringify(input, null, 2)}\n\nPlease process this input and return the result in the specified JSON format.`

      // Call Ollama - don't use format:"json" as qwen3-next model returns empty content with it
      const controller = new AbortController()
      const timeoutMs = getAgentTimeoutMs(agentType)
      timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch(`${getOllamaEndpoint()}/api/chat`, {
        method: "POST",
        headers: getOllamaHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          model: getOllamaModel(),
          messages: [
            {
              role: "system",
              content:
                systemPrompt +
                "\n\n" +
                "RESPONSE FORMAT REQUIREMENTS:\n" +
                "1. Your response must be ONLY a valid JSON object\n" +
                "2. Start your response directly with { - no preamble text\n" +
                "3. Do NOT wrap in markdown code blocks (no ```json)\n" +
                "4. Do NOT include any thinking, explanation, or commentary\n" +
                "5. End your response with } - nothing after\n" +
                '6. If you cannot extract any data, return: {"extractions": [], "extraction_metadata": {"total_extractions": 0, "processing_notes": "No extractable data found"}}',
            },
            { role: "user", content: userMessage },
          ],
          stream: false,
          options: {
            temperature,
            num_predict: 16384,
          },
        }),
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      // Ollama format: data.message.content
      let rawContent = data.message?.content || ""
      if (!rawContent && data.message?.thinking) {
        // Extract JSON from thinking field if content is empty
        rawContent = data.message.thinking
      }

      // Extract JSON from response (handle markdown code blocks, whitespace, etc.)
      let jsonContent = rawContent.trim()

      // Remove markdown code blocks if present
      const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1].trim()
      }

      // Try to find JSON object in response
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error(`No JSON object found in response: ${rawContent.slice(0, 200)}`)
      }
      jsonContent = jsonMatch[0]

      // Parse JSON from response
      let parsed: unknown
      try {
        parsed = JSON.parse(jsonContent)
      } catch (parseError) {
        // Store raw output on parse failure
        await db.agentRun.update({
          where: { id: run.id },
          data: {
            rawOutput: { rawContent, jsonContent },
            error: `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          },
        })
        throw new Error(`Failed to parse JSON response: ${jsonContent.slice(0, 200)}`)
      }

      // Validate output
      const outputValidation = outputSchema.safeParse(parsed)
      if (!outputValidation.success) {
        // Store raw output on validation failure for debugging
        await db.agentRun.update({
          where: { id: run.id },
          data: {
            rawOutput: parsed as object,
            error: `Schema validation failed: ${outputValidation.error.message}`,
          },
        })
        throw new Error(`Invalid output: ${outputValidation.error.message}`)
      }

      // Success - update run record
      const durationMs = Date.now() - startTime
      await db.agentRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          output: outputValidation.data as object,
          durationMs,
          confidence: (outputValidation.data as { confidence?: number }).confidence,
          completedAt: new Date(),
        },
      })

      return {
        success: true,
        output: outputValidation.data,
        error: null,
        runId: run.id,
        durationMs,
        tokensUsed: data.eval_count || null,
      }
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId)
      lastError = error as Error

      // Check if aborted due to timeout
      if (lastError?.name === "AbortError") {
        lastError = new Error(
          `Agent ${agentType} timed out after ${getAgentTimeoutMs(agentType)}ms`
        )
      }

      if (attempt < maxRetries - 1) {
        // Exponential backoff with longer delays for rate limiting
        const isRateLimit = lastError?.message?.includes("429")
        const baseDelay = isRateLimit ? 30000 : 1000 // 30s for rate limits
        const delay = Math.pow(2, attempt) * baseDelay
        console.log(`[runner] Retry ${attempt + 1}/${maxRetries} in ${delay / 1000}s...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // All retries failed
  const durationMs = Date.now() - startTime
  const errorMsg = `Agent failed after ${maxRetries} attempts: ${lastError?.message}`

  await db.agentRun.update({
    where: { id: run.id },
    data: {
      status: "failed",
      error: errorMsg,
      durationMs,
      completedAt: new Date(),
    },
  })

  return {
    success: false,
    output: null,
    error: errorMsg,
    runId: run.id,
    durationMs,
    tokensUsed: null,
  }
}
