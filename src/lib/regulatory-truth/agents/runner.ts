// src/lib/regulatory-truth/agents/runner.ts

import { z } from "zod"
import { createHash } from "crypto"
import { db } from "@/lib/db"
import type { AgentType } from "../schemas"
import { getAgentPrompt } from "../prompts"
import { getPromptProvenance } from "./prompt-registry"
import {
  getOllamaExtractEndpoint,
  getOllamaExtractModel,
  getOllamaExtractHeaders,
} from "./ollama-config"
import type { AgentRunStatus, AgentRunOutcome, NoChangeCode } from "@prisma/client"

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

// Minimum input size thresholds per agent type (bytes)
// Inputs below this are rejected as CONTENT_LOW_QUALITY
const MIN_INPUT_BYTES: Record<string, number> = {
  EXTRACTOR: 100,
  COMPOSER: 50,
  REVIEWER: 50,
  CONTENT_CLASSIFIER: 50,
  CLAIM_EXTRACTOR: 100,
  PROCESS_EXTRACTOR: 100,
  REFERENCE_EXTRACTOR: 100,
  ASSET_EXTRACTOR: 100,
  TRANSITIONAL_EXTRACTOR: 100,
  COMPARISON_EXTRACTOR: 100,
  EXEMPTION_EXTRACTOR: 100,
}

const DEFAULT_MIN_INPUT_BYTES = 20

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getAgentTimeoutMs(agentType?: string): number {
  if (agentType) {
    const envOverride = process.env[`${agentType}_TIMEOUT_MS`]
    if (envOverride) return parseInt(envOverride)
  }

  const globalOverride = process.env.AGENT_TIMEOUT_MS
  if (globalOverride) return parseInt(globalOverride)

  if (agentType && AGENT_TIMEOUTS[agentType]) {
    return AGENT_TIMEOUTS[agentType]
  }

  return DEFAULT_TIMEOUT_MS
}

function getMinInputBytes(agentType: string): number {
  return MIN_INPUT_BYTES[agentType] ?? DEFAULT_MIN_INPUT_BYTES
}

function computeContentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex")
}

/**
 * Stub for deterministic skip logic.
 * Returns true if LLM call should be skipped based on deterministic rules.
 * Placeholder for PR-B and future optimizations.
 */
function shouldSkipLLM(_agentType: AgentType, _input: unknown): boolean {
  // Stub: always returns false for now
  // Future: implement rules like "if this exact extraction already exists"
  return false
}

// =============================================================================
// CACHE HELPERS (PR-B)
// =============================================================================

/**
 * Get provider identifier from endpoint URL
 */
function getProviderFromEndpoint(endpoint: string): string {
  if (endpoint.includes("ollama.com") || endpoint.includes("ollama.ai")) {
    return "ollama_cloud"
  }
  if (endpoint.includes("openai.com")) {
    return "openai"
  }
  if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1")) {
    return "ollama_local"
  }
  // Tailscale or other internal endpoints
  if (endpoint.match(/^https?:\/\/100\./)) {
    return "ollama_local"
  }
  return "unknown"
}

interface CacheKey {
  agentType: AgentType
  provider: string
  model: string
  promptHash: string
  inputContentHash: string
}

/**
 * Look up cached result by composite key
 */
async function lookupCache(key: CacheKey) {
  return db.agentResultCache.findUnique({
    where: {
      agentType_provider_model_promptHash_inputContentHash: {
        agentType: key.agentType,
        provider: key.provider,
        model: key.model,
        promptHash: key.promptHash,
        inputContentHash: key.inputContentHash,
      },
    },
  })
}

/**
 * Write result to cache (only for success outcomes)
 * Note: outcome is NOT stored - cache is a pure artifact store.
 * On cache hit, the output is re-validated against the current outputSchema.
 */
async function writeCache(
  key: CacheKey,
  output: object,
  originalRunId: string,
  confidence?: number,
  tokensUsed?: number
) {
  await db.agentResultCache.upsert({
    where: {
      agentType_provider_model_promptHash_inputContentHash: {
        agentType: key.agentType,
        provider: key.provider,
        model: key.model,
        promptHash: key.promptHash,
        inputContentHash: key.inputContentHash,
      },
    },
    create: {
      agentType: key.agentType,
      provider: key.provider,
      model: key.model,
      promptHash: key.promptHash,
      inputContentHash: key.inputContentHash,
      output,
      originalRunId,
      confidence,
      tokensUsed,
    },
    update: {
      // Don't update existing cache entries - first result wins
    },
  })
}

/**
 * Increment cache hit counter
 */
async function incrementCacheHit(cacheId: string) {
  await db.agentResultCache.update({
    where: { id: cacheId },
    data: {
      hitCount: { increment: 1 },
      lastHitAt: new Date(),
    },
  })
}

// =============================================================================
// AGENT RUNNER OPTIONS & RESULT
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
  softFail?: boolean

  // Correlation fields (passed from workers)
  runId?: string
  jobId?: string
  parentJobId?: string
  sourceSlug?: string
  queueName?: string
}

export interface AgentRunResult<TOutput> {
  success: boolean
  output: TOutput | null
  error: string | null
  runId: string
  durationMs: number
  tokensUsed: number | null
  outcome?: AgentRunOutcome
  itemsProduced?: number
}

// =============================================================================
// HELPER: Create early exit result
// =============================================================================

async function createEarlyExitRun(params: {
  agentType: AgentType
  input: object
  status: AgentRunStatus
  outcome: AgentRunOutcome
  noChangeCode?: NoChangeCode
  noChangeDetail?: string
  error?: string
  evidenceId?: string
  ruleId?: string
  runId?: string
  jobId?: string
  parentJobId?: string
  sourceSlug?: string
  queueName?: string
  inputChars: number
  inputBytes: number
  inputContentHash: string
  promptTemplateId: string
  promptTemplateVersion: string
  promptHash: string
  durationMs: number
}): Promise<{ id: string }> {
  return db.agentRun.create({
    data: {
      agentType: params.agentType,
      status: params.status,
      outcome: params.outcome,
      noChangeCode: params.noChangeCode,
      noChangeDetail: params.noChangeDetail,
      input: params.input,
      error: params.error,
      evidenceId: params.evidenceId,
      ruleId: params.ruleId,
      runId: params.runId,
      jobId: params.jobId,
      parentJobId: params.parentJobId,
      sourceSlug: params.sourceSlug,
      queueName: params.queueName,
      inputChars: params.inputChars,
      inputBytes: params.inputBytes,
      inputContentHash: params.inputContentHash,
      promptTemplateId: params.promptTemplateId,
      promptTemplateVersion: params.promptTemplateVersion,
      promptHash: params.promptHash,
      durationMs: params.durationMs,
      completedAt: new Date(),
      itemsProduced: 0,
      cacheHit: false,
    },
  })
}

// =============================================================================
// AGENT RUNNER
// =============================================================================

/**
 * Run an agent with full validation, logging, and outcome taxonomy.
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
    softFail = true,
    runId,
    jobId,
    parentJobId,
    sourceSlug,
    queueName,
  } = options

  // Compute input metrics
  const inputStr = JSON.stringify(input)
  const inputChars = inputStr.length
  const inputBytes = Buffer.byteLength(inputStr, "utf8")
  const inputContentHash = computeContentHash(inputStr)

  // Get prompt provenance
  const provenance = getPromptProvenance(agentType, input)

  // ==========================================================================
  // PRE-LLM GATE 1: Input validation
  // ==========================================================================
  const inputValidation = inputSchema.safeParse(input)
  if (!inputValidation.success) {
    const errorMsg = `Invalid input: ${inputValidation.error.message}`
    const run = await createEarlyExitRun({
      agentType,
      input: input as object,
      status: "FAILED",
      outcome: "PARSE_FAILED",
      error: errorMsg,
      evidenceId,
      ruleId,
      runId,
      jobId,
      parentJobId,
      sourceSlug,
      queueName,
      inputChars,
      inputBytes,
      inputContentHash,
      promptTemplateId: provenance.templateId,
      promptTemplateVersion: provenance.version,
      promptHash: provenance.promptHash,
      durationMs: Date.now() - startTime,
    })
    return {
      success: false,
      output: null,
      error: errorMsg,
      runId: run.id,
      durationMs: Date.now() - startTime,
      tokensUsed: null,
      outcome: "PARSE_FAILED",
      itemsProduced: 0,
    }
  }

  // ==========================================================================
  // PRE-LLM GATE 2: Content quality check
  // ==========================================================================
  const minBytes = getMinInputBytes(agentType)
  if (inputBytes < minBytes) {
    const errorMsg = `Input too small: ${inputBytes} bytes < ${minBytes} minimum`
    const run = await createEarlyExitRun({
      agentType,
      input: input as object,
      status: "COMPLETED",
      outcome: "CONTENT_LOW_QUALITY",
      noChangeCode: "NO_RELEVANT_CHANGES",
      noChangeDetail: errorMsg,
      evidenceId,
      ruleId,
      runId,
      jobId,
      parentJobId,
      sourceSlug,
      queueName,
      inputChars,
      inputBytes,
      inputContentHash,
      promptTemplateId: provenance.templateId,
      promptTemplateVersion: provenance.version,
      promptHash: provenance.promptHash,
      durationMs: Date.now() - startTime,
    })
    return {
      success: false,
      output: null,
      error: errorMsg,
      runId: run.id,
      durationMs: Date.now() - startTime,
      tokensUsed: null,
      outcome: "CONTENT_LOW_QUALITY",
      itemsProduced: 0,
    }
  }

  // ==========================================================================
  // PRE-LLM GATE 3: Deterministic skip check
  // ==========================================================================
  if (shouldSkipLLM(agentType, input)) {
    const run = await createEarlyExitRun({
      agentType,
      input: input as object,
      status: "COMPLETED",
      outcome: "SKIPPED_DETERMINISTIC",
      noChangeDetail: "Deterministic rules decided LLM not needed",
      evidenceId,
      ruleId,
      runId,
      jobId,
      parentJobId,
      sourceSlug,
      queueName,
      inputChars,
      inputBytes,
      inputContentHash,
      promptTemplateId: provenance.templateId,
      promptTemplateVersion: provenance.version,
      promptHash: provenance.promptHash,
      durationMs: Date.now() - startTime,
    })
    return {
      success: true,
      output: null,
      error: null,
      runId: run.id,
      durationMs: Date.now() - startTime,
      tokensUsed: null,
      outcome: "SKIPPED_DETERMINISTIC",
      itemsProduced: 0,
    }
  }

  // ==========================================================================
  // PRE-LLM GATE 4: Cache lookup (PR-B)
  // ==========================================================================
  const extractEndpoint = getOllamaExtractEndpoint()
  const extractModel = getOllamaExtractModel()
  const provider = getProviderFromEndpoint(extractEndpoint)

  const cacheKey: CacheKey = {
    agentType,
    provider,
    model: extractModel,
    promptHash: provenance.promptHash,
    inputContentHash,
  }

  const cachedResult = await lookupCache(cacheKey)
  if (cachedResult) {
    // Cache hit - re-validate output against current outputSchema
    // This ensures schema evolution doesn't serve stale/invalid data
    const cachedOutputValidation = outputSchema.safeParse(cachedResult.output)
    const durationMs = Date.now() - startTime

    if (!cachedOutputValidation.success) {
      // Cached output fails current schema validation
      // Return VALIDATION_REJECTED, not DUPLICATE_CACHED
      console.log(
        `[runner] Cache hit for ${agentType} but validation failed: ${cachedOutputValidation.error.message}`
      )

      const run = await db.agentRun.create({
        data: {
          agentType,
          status: "COMPLETED",
          outcome: "VALIDATION_REJECTED",
          noChangeCode: "VALIDATION_BLOCKED",
          noChangeDetail: `Cached output failed current schema validation: ${cachedOutputValidation.error.message}`,
          input: input as object,
          output: cachedResult.output as object,
          evidenceId,
          ruleId,
          runId,
          jobId,
          parentJobId,
          sourceSlug,
          queueName,
          inputChars,
          inputBytes,
          inputContentHash,
          promptTemplateId: provenance.templateId,
          promptTemplateVersion: provenance.version,
          promptHash: provenance.promptHash,
          cacheHit: true, // It WAS a cache hit, but validation failed
          durationMs,
          completedAt: new Date(),
        },
      })

      // Note: We do NOT overwrite the cache entry or call incrementCacheHit
      // The stale cache entry will be replaced when a fresh LLM result arrives

      return {
        success: false,
        output: null,
        error: `Cached output failed validation: ${cachedOutputValidation.error.message}`,
        runId: run.id,
        durationMs,
        tokensUsed: undefined,
        outcome: "VALIDATION_REJECTED",
        itemsProduced: 0,
      }
    }

    // Validation passed - return cached output
    const run = await db.agentRun.create({
      data: {
        agentType,
        status: "COMPLETED",
        outcome: "DUPLICATE_CACHED",
        input: input as object,
        output: cachedResult.output as object,
        evidenceId,
        ruleId,
        runId,
        jobId,
        parentJobId,
        sourceSlug,
        queueName,
        inputChars,
        inputBytes,
        inputContentHash,
        promptTemplateId: provenance.templateId,
        promptTemplateVersion: provenance.version,
        promptHash: provenance.promptHash,
        cacheHit: true,
        durationMs,
        confidence: cachedResult.confidence,
        tokensUsed: cachedResult.tokensUsed,
        completedAt: new Date(),
      },
    })

    // Increment cache hit counter (fire and forget)
    incrementCacheHit(cachedResult.id).catch(() => {
      // Ignore errors - hit counting is best-effort
    })

    console.log(`[runner] Cache hit for ${agentType} (key=${inputContentHash.slice(0, 8)}...)`)

    return {
      success: true,
      output: cachedOutputValidation.data,
      error: null,
      runId: run.id,
      durationMs,
      tokensUsed: cachedResult.tokensUsed,
      outcome: "DUPLICATE_CACHED",
      itemsProduced: 0, // Caller should still run apply logic
    }
  }

  // ==========================================================================
  // CREATE RUN RECORD
  // ==========================================================================
  const run = await db.agentRun.create({
    data: {
      agentType,
      status: "RUNNING",
      input: input as object,
      evidenceId,
      ruleId,
      runId,
      jobId,
      parentJobId,
      sourceSlug,
      queueName,
      inputChars,
      inputBytes,
      inputContentHash,
      promptTemplateId: provenance.templateId,
      promptTemplateVersion: provenance.version,
      promptHash: provenance.promptHash,
    },
  })

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let timeoutId: NodeJS.Timeout | undefined
    try {
      // Update attempt number
      if (attempt > 1) {
        await db.agentRun.update({
          where: { id: run.id },
          data: { attempt },
        })
      }

      // Get prompt template
      const systemPrompt = getAgentPrompt(agentType)

      // Build user message with input
      const userMessage = `INPUT:\n${JSON.stringify(input, null, 2)}\n\nPlease process this input and return the result in the specified JSON format.`

      // Call Ollama
      const controller = new AbortController()
      const timeoutMs = getAgentTimeoutMs(agentType)
      timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      // extractEndpoint, extractModel, provider already computed above for cache lookup
      console.log(`[runner] Extraction call: endpoint=${extractEndpoint} model=${extractModel}`)

      const response = await fetch(`${extractEndpoint}/api/chat`, {
        method: "POST",
        headers: getOllamaExtractHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          model: extractModel,
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
      let rawContent = data.message?.content || ""
      if (!rawContent && data.message?.thinking) {
        rawContent = data.message.thinking
      }

      // Extract JSON from response
      let jsonContent = rawContent.trim()

      // Remove markdown code blocks if present
      const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1].trim()
      }

      // Try to find JSON object in response
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        // OUTCOME: PARSE_FAILED (no JSON found)
        await db.agentRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            outcome: "PARSE_FAILED",
            rawOutput: { rawContent },
            error: `No JSON object found in response`,
            durationMs: Date.now() - startTime,
            completedAt: new Date(),
            tokensUsed: data.eval_count || null,
          },
        })
        return {
          success: false,
          output: null,
          error: `No JSON object found in response: ${rawContent.slice(0, 200)}`,
          runId: run.id,
          durationMs: Date.now() - startTime,
          tokensUsed: data.eval_count || null,
          outcome: "PARSE_FAILED",
          itemsProduced: 0,
        }
      }
      jsonContent = jsonMatch[0]

      // Parse JSON
      let parsed: unknown
      try {
        parsed = JSON.parse(jsonContent)
      } catch (parseError) {
        // OUTCOME: PARSE_FAILED (invalid JSON)
        await db.agentRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            outcome: "PARSE_FAILED",
            rawOutput: { rawContent, jsonContent },
            error: `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
            durationMs: Date.now() - startTime,
            completedAt: new Date(),
            tokensUsed: data.eval_count || null,
          },
        })
        return {
          success: false,
          output: null,
          error: `Failed to parse JSON response: ${jsonContent.slice(0, 200)}`,
          runId: run.id,
          durationMs: Date.now() - startTime,
          tokensUsed: data.eval_count || null,
          outcome: "PARSE_FAILED",
          itemsProduced: 0,
        }
      }

      // Check for empty output
      const isEmptyOutput =
        parsed === null ||
        parsed === undefined ||
        (Array.isArray(parsed) && parsed.length === 0) ||
        (typeof parsed === "object" &&
          parsed !== null &&
          "extractions" in parsed &&
          Array.isArray((parsed as { extractions: unknown[] }).extractions) &&
          (parsed as { extractions: unknown[] }).extractions.length === 0)

      if (isEmptyOutput) {
        // OUTCOME: EMPTY_OUTPUT
        const durationMs = Date.now() - startTime
        await db.agentRun.update({
          where: { id: run.id },
          data: {
            status: "COMPLETED",
            outcome: "EMPTY_OUTPUT",
            output: parsed as object,
            durationMs,
            completedAt: new Date(),
            tokensUsed: data.eval_count || null,
            itemsProduced: 0,
          },
        })
        return {
          success: true,
          output: null,
          error: null,
          runId: run.id,
          durationMs,
          tokensUsed: data.eval_count || null,
          outcome: "EMPTY_OUTPUT",
          itemsProduced: 0,
        }
      }

      // Validate output schema
      const outputValidation = outputSchema.safeParse(parsed)
      if (!outputValidation.success) {
        // OUTCOME: VALIDATION_REJECTED
        await db.agentRun.update({
          where: { id: run.id },
          data: {
            status: "COMPLETED",
            outcome: "VALIDATION_REJECTED",
            noChangeCode: "VALIDATION_BLOCKED",
            noChangeDetail: outputValidation.error.message,
            rawOutput: parsed as object,
            error: `Schema validation failed: ${outputValidation.error.message}`,
            durationMs: Date.now() - startTime,
            completedAt: new Date(),
            tokensUsed: data.eval_count || null,
            itemsProduced: 0,
          },
        })
        return {
          success: false,
          output: null,
          error: `Invalid output: ${outputValidation.error.message}`,
          runId: run.id,
          durationMs: Date.now() - startTime,
          tokensUsed: data.eval_count || null,
          outcome: "VALIDATION_REJECTED",
          itemsProduced: 0,
        }
      }

      // Check confidence threshold
      const outputData = outputValidation.data as { confidence?: number }
      const confidence = outputData.confidence
      const MIN_CONFIDENCE = 0.5 // Configurable threshold
      if (confidence !== undefined && confidence < MIN_CONFIDENCE) {
        // OUTCOME: LOW_CONFIDENCE
        const durationMs = Date.now() - startTime
        await db.agentRun.update({
          where: { id: run.id },
          data: {
            status: "COMPLETED",
            outcome: "LOW_CONFIDENCE",
            noChangeCode: "BELOW_MIN_CONFIDENCE",
            noChangeDetail: `Confidence ${confidence} < ${MIN_CONFIDENCE}`,
            output: outputValidation.data as object,
            confidence,
            durationMs,
            completedAt: new Date(),
            tokensUsed: data.eval_count || null,
            itemsProduced: 0,
          },
        })
        return {
          success: false,
          output: null,
          error: `Low confidence: ${confidence}`,
          runId: run.id,
          durationMs,
          tokensUsed: data.eval_count || null,
          outcome: "LOW_CONFIDENCE",
          itemsProduced: 0,
        }
      }

      // OUTCOME: SUCCESS_APPLIED (caller will set itemsProduced)
      // Note: We set SUCCESS_APPLIED here, but caller should update to
      // SUCCESS_NO_CHANGE if no items were actually produced
      const durationMs = Date.now() - startTime
      await db.agentRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          outcome: "SUCCESS_APPLIED",
          output: outputValidation.data as object,
          durationMs,
          confidence,
          completedAt: new Date(),
          tokensUsed: data.eval_count || null,
        },
      })

      // ==========================================================================
      // CACHE WRITE (PR-B): Store successful result for future cache hits
      // ==========================================================================
      // Write to cache after successful LLM call (parse OK, schema OK, confidence OK)
      // Note: outcome is NOT stored - cache is a pure artifact store
      // On cache hit, output is re-validated against current schema
      writeCache(
        cacheKey,
        outputValidation.data as object,
        run.id,
        confidence,
        data.eval_count || undefined
      ).catch((err) => {
        // Cache write is best-effort - don't fail the run if cache write fails
        console.error(`[runner] Cache write failed: ${err.message}`)
      })

      return {
        success: true,
        output: outputValidation.data,
        error: null,
        runId: run.id,
        durationMs,
        tokensUsed: data.eval_count || null,
        outcome: "SUCCESS_APPLIED",
      }
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId)
      lastError = error as Error

      // Check if aborted due to timeout
      if (lastError?.name === "AbortError") {
        // OUTCOME: TIMEOUT
        const durationMs = Date.now() - startTime
        await db.agentRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            outcome: "TIMEOUT",
            error: `Agent ${agentType} timed out after ${getAgentTimeoutMs(agentType)}ms`,
            durationMs,
            completedAt: new Date(),
            attempt,
          },
        })
        return {
          success: false,
          output: null,
          error: `Agent ${agentType} timed out after ${getAgentTimeoutMs(agentType)}ms`,
          runId: run.id,
          durationMs,
          tokensUsed: null,
          outcome: "TIMEOUT",
          itemsProduced: 0,
        }
      }

      if (attempt < maxRetries) {
        // Exponential backoff
        const isRateLimit = lastError?.message?.includes("429")
        const baseDelay = isRateLimit ? 30000 : 1000
        const delay = Math.pow(2, attempt - 1) * baseDelay
        console.log(`[runner] Retry ${attempt}/${maxRetries} in ${delay / 1000}s...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // OUTCOME: RETRY_EXHAUSTED
  const durationMs = Date.now() - startTime
  const errorMsg = `Agent failed after ${maxRetries} attempts: ${lastError?.message}`

  await db.agentRun.update({
    where: { id: run.id },
    data: {
      status: "FAILED",
      outcome: "RETRY_EXHAUSTED",
      error: errorMsg,
      durationMs,
      completedAt: new Date(),
      attempt: maxRetries,
    },
  })

  return {
    success: false,
    output: null,
    error: errorMsg,
    runId: run.id,
    durationMs,
    tokensUsed: null,
    outcome: "RETRY_EXHAUSTED",
    itemsProduced: 0,
  }
}

/**
 * Update an AgentRun's outcome after items have been produced.
 * Call this from workers after they know how many items were created.
 */
export async function updateRunOutcome(
  runId: string,
  itemsProduced: number,
  noChangeCode?: NoChangeCode,
  noChangeDetail?: string
): Promise<void> {
  const outcome: AgentRunOutcome = itemsProduced > 0 ? "SUCCESS_APPLIED" : "SUCCESS_NO_CHANGE"
  await db.agentRun.update({
    where: { id: runId },
    data: {
      outcome,
      itemsProduced,
      noChangeCode: itemsProduced === 0 ? noChangeCode : undefined,
      noChangeDetail: itemsProduced === 0 ? noChangeDetail : undefined,
    },
  })
}
