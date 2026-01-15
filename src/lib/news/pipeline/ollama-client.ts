/**
 * Ollama Client for News Pipeline
 *
 * Provides LLM capabilities for news processing using Ollama.
 * Supports both local Ollama instances and Ollama Cloud.
 */

import { trackAIUsage, type AIOperation } from "@/lib/ai/usage-tracking"
import { llmCircuitBreaker } from "@/lib/regulatory-truth/watchdog/llm-circuit-breaker"

export class OllamaError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown
  ) {
    super(message)
    this.name = "OllamaError"
  }
}

export class CircuitOpenError extends Error {
  constructor() {
    super("Circuit breaker OPEN for Ollama - failing fast")
    this.name = "CircuitOpenError"
  }
}

/**
 * Call Ollama API with automatic retry logic
 */
export async function callOllama(
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    jsonMode?: boolean
    retries?: number
    operation?: string
  } = {}
): Promise<string> {
  const {
    systemPrompt,
    temperature = 0.7,
    maxTokens = 4000,
    jsonMode = false,
    retries = 3,
    operation = "ollama_chat",
  } = options

  // Check circuit breaker before attempting call
  if (!(await llmCircuitBreaker.canCall("ollama"))) {
    throw new CircuitOpenError()
  }

  const apiKey = process.env.OLLAMA_API_KEY
  if (!apiKey) {
    throw new OllamaError("OLLAMA_API_KEY environment variable is not set")
  }

  const endpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434"
  const model = process.env.OLLAMA_MODEL || "llama3.2"

  const messages: Array<{ role: "system" | "user"; content: string }> = []
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt })
  messages.push({ role: "user", content: prompt })

  let lastError: Error | null = null
  const startTime = Date.now()

  for (let attempt = 0; attempt < retries; attempt++) {
    const attemptStart = Date.now()
    try {
      const response = await fetch(`${endpoint}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          format: jsonMode ? "json" : undefined,
          options: {
            temperature,
            num_predict: maxTokens,
          },
        }),
      })
      const durationMs = Date.now() - attemptStart

      if (!response.ok) {
        const errorBody = await response.text()
        throw new OllamaError(
          `Ollama API error: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        )
      }

      const data = await response.json()
      const content = data.message?.content
      if (!content) throw new OllamaError("Ollama returned no content")

      // Track usage for system operations (news processing)
      await trackAIUsage({
        companyId: "system",
        operation: operation as AIOperation,
        model,
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0,
        success: true,
        durationMs,
        provider: "ollama",
      })

      await llmCircuitBreaker.recordSuccess("ollama")

      return content
    } catch (error) {
      lastError = error as Error

      if (error instanceof OllamaError && error.statusCode === 401) {
        throw error
      }

      // Record failure for circuit breaker on last attempt
      if (attempt === retries - 1) {
        await llmCircuitBreaker.recordFailure("ollama", lastError?.message || "Unknown error")
      }

      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  const totalDurationMs = Date.now() - startTime
  // Track failed request
  await trackAIUsage({
    companyId: "system",
    operation: operation as AIOperation,
    model,
    inputTokens: 0,
    outputTokens: 0,
    success: false,
    durationMs: totalDurationMs,
    provider: "ollama",
  })

  throw new OllamaError(
    `Ollama API failed after ${retries} attempts: ${lastError?.message}`,
    undefined,
    lastError
  )
}

/**
 * Call Ollama and parse JSON response
 */
export async function callOllamaJSON<T>(
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    retries?: number
    operation?: string
  } = {}
): Promise<T> {
  const response = await callOllama(prompt, {
    ...options,
    jsonMode: true,
  })

  try {
    return JSON.parse(response) as T
  } catch (error) {
    throw new OllamaError(
      `Failed to parse Ollama JSON response: ${(error as Error).message}`,
      undefined,
      response
    )
  }
}

// CircuitOpenError is exported above with its class definition
