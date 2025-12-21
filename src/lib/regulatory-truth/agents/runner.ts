// src/lib/regulatory-truth/agents/runner.ts

import { z } from "zod"
import { db } from "@/lib/db"
import type { AgentType } from "../schemas"
import { getAgentPrompt } from "../prompts"

// =============================================================================
// OLLAMA CLIENT (reuse existing pattern)
// =============================================================================

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || "https://ollama.com"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1"
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY

function getOllamaHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (OLLAMA_API_KEY) {
    headers["Authorization"] = `Bearer ${OLLAMA_API_KEY}`
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
 * Run an agent with full validation and logging
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
    try {
      // Get prompt template
      const systemPrompt = getAgentPrompt(agentType)

      // Build user message with input
      const userMessage = `INPUT:\n${JSON.stringify(input, null, 2)}\n\nPlease process this input and return the result in the specified JSON format.`

      // Call Ollama
      const response = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
        method: "POST",
        headers: getOllamaHeaders(),
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          stream: false,
          format: "json",
          options: {
            temperature,
            num_predict: 8192, // Allow longer responses for complex extractions
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.message?.content || "{}"

      // Parse JSON from response
      let parsed: unknown
      try {
        parsed = JSON.parse(content)
      } catch {
        throw new Error(`Failed to parse JSON response: ${content.slice(0, 200)}`)
      }

      // Validate output
      const outputValidation = outputSchema.safeParse(parsed)
      if (!outputValidation.success) {
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
      lastError = error as Error

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
