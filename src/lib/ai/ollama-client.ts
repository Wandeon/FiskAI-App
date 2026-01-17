/**
 * Unified Ollama Client
 *
 * Provides a single interface for all LLM operations using Ollama.
 * Supports both local Ollama instances and Ollama Cloud.
 *
 * Environment Variables:
 * - OLLAMA_ENDPOINT: API endpoint (default: http://localhost:11434)
 * - OLLAMA_API_KEY: API key for authentication (optional for local)
 * - OLLAMA_MODEL: Default model for text generation
 * - OLLAMA_VISION_MODEL: Model for vision/OCR tasks
 */

import { trackAIUsage, type AIOperation } from "./usage-tracking"
import { llmCircuitBreaker } from "@/lib/infra/circuit-breaker"

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

interface OllamaMessage {
  role: "system" | "user" | "assistant"
  content: string
  images?: string[] // Base64 encoded images for vision
}

interface OllamaChatRequest {
  model: string
  messages: OllamaMessage[]
  stream: false
  format?: "json"
  options?: {
    temperature?: number
    num_predict?: number
  }
}

interface OllamaChatResponse {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
  total_duration?: number
  prompt_eval_count?: number
  eval_count?: number
}

/**
 * Get Ollama configuration from environment
 */
function getConfig() {
  return {
    endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
    apiKey: process.env.OLLAMA_API_KEY,
    model: process.env.OLLAMA_MODEL || "llama3.2",
    visionModel: process.env.OLLAMA_VISION_MODEL || "llava",
  }
}

/**
 * Core Ollama API call with retry and circuit breaker
 */
async function callOllamaAPI(
  request: OllamaChatRequest,
  options: {
    retries?: number
    operation?: AIOperation
    companyId?: string
  } = {}
): Promise<OllamaChatResponse> {
  const { retries = 3, operation = "ollama_chat" as AIOperation, companyId } = options
  const config = getConfig()

  // Check circuit breaker before attempting call
  if (!(await llmCircuitBreaker.canCall("ollama"))) {
    throw new CircuitOpenError()
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`
  }

  let lastError: Error | null = null
  const startTime = Date.now()

  for (let attempt = 0; attempt < retries; attempt++) {
    const attemptStart = Date.now()
    try {
      const response = await fetch(`${config.endpoint}/api/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
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

      const data: OllamaChatResponse = await response.json()

      if (!data.message?.content) {
        throw new OllamaError("Ollama returned no content")
      }

      // Track usage
      if (companyId) {
        await trackAIUsage({
          companyId,
          operation,
          model: request.model,
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0,
          success: true,
          durationMs,
          provider: "ollama",
        })
      }

      await llmCircuitBreaker.recordSuccess("ollama")
      return data
    } catch (error) {
      lastError = error as Error

      // Don't retry on authentication errors
      if (error instanceof OllamaError && error.statusCode === 401) {
        throw error
      }

      // Record failure for circuit breaker on last attempt
      if (attempt === retries - 1) {
        await llmCircuitBreaker.recordFailure("ollama", lastError?.message || "Unknown error")
      }

      // Exponential backoff
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  const totalDurationMs = Date.now() - startTime

  // Track failed request
  if (companyId) {
    await trackAIUsage({
      companyId,
      operation,
      model: request.model,
      inputTokens: 0,
      outputTokens: 0,
      success: false,
      durationMs: totalDurationMs,
      provider: "ollama",
    })
  }

  throw new OllamaError(
    `Ollama API failed after ${retries} attempts: ${lastError?.message}`,
    undefined,
    lastError
  )
}

/**
 * Simple chat completion
 */
export async function chat(
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    jsonMode?: boolean
    retries?: number
    operation?: AIOperation
    companyId?: string
    model?: string
  } = {}
): Promise<string> {
  const config = getConfig()
  const {
    systemPrompt,
    temperature = 0.7,
    maxTokens = 4000,
    jsonMode = false,
    retries = 3,
    operation = "ollama_chat" as AIOperation,
    companyId,
    model = config.model,
  } = options

  const messages: OllamaMessage[] = []
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt })
  }
  messages.push({ role: "user", content: prompt })

  const response = await callOllamaAPI(
    {
      model,
      messages,
      stream: false,
      format: jsonMode ? "json" : undefined,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    },
    { retries, operation, companyId }
  )

  return response.message.content
}

/**
 * Chat completion with JSON response
 */
export async function chatJSON<T>(
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    retries?: number
    operation?: AIOperation
    companyId?: string
    model?: string
  } = {}
): Promise<T> {
  const response = await chat(prompt, {
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

/**
 * Vision/OCR - analyze image content
 */
export async function vision(
  imageBase64: string,
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    jsonMode?: boolean
    retries?: number
    operation?: AIOperation
    companyId?: string
  } = {}
): Promise<string> {
  const config = getConfig()
  const {
    systemPrompt,
    temperature = 0.3,
    maxTokens = 2000,
    jsonMode = false,
    retries = 3,
    operation = "ocr_receipt" as AIOperation,
    companyId,
  } = options

  const messages: OllamaMessage[] = []
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt })
  }
  messages.push({
    role: "user",
    content: prompt,
    images: [imageBase64],
  })

  const response = await callOllamaAPI(
    {
      model: config.visionModel,
      messages,
      stream: false,
      format: jsonMode ? "json" : undefined,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    },
    { retries, operation, companyId }
  )

  return response.message.content
}

/**
 * Vision with JSON response
 */
export async function visionJSON<T>(
  imageBase64: string,
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    retries?: number
    operation?: AIOperation
    companyId?: string
  } = {}
): Promise<T> {
  const response = await vision(imageBase64, prompt, {
    ...options,
    jsonMode: true,
  })

  try {
    return JSON.parse(response) as T
  } catch (error) {
    throw new OllamaError(
      `Failed to parse Ollama vision JSON response: ${(error as Error).message}`,
      undefined,
      response
    )
  }
}

/**
 * Check if Ollama is available
 */
export async function isAvailable(): Promise<boolean> {
  try {
    const config = getConfig()
    const headers: Record<string, string> = {}
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`
    }

    const response = await fetch(`${config.endpoint}/api/tags`, {
      method: "GET",
      headers,
    })
    return response.ok
  } catch {
    return false
  }
}
