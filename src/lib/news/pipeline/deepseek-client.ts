/**
 * DeepSeek API Client
 * Reusable helper for calling DeepSeek chat completion API
 */

import OpenAI from "openai"
import { trackAIUsage } from "@/lib/ai/usage-tracking"

interface DeepSeekMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface DeepSeekRequest {
  model: string
  messages: DeepSeekMessage[]
  temperature?: number
  max_tokens?: number
  response_format?: { type: "json_object" }
}

interface DeepSeekResponse {
  id: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class DeepSeekError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: any
  ) {
    super(message)
    this.name = "DeepSeekError"
  }
}

type NewsAiProvider = "deepseek" | "openai" | "ollama"

function resolveProvider(): NewsAiProvider {
  const explicit = (process.env.NEWS_AI_PROVIDER || process.env.AI_PROVIDER || "").toLowerCase()
  if (explicit === "openai") return "openai"
  if (explicit === "deepseek") return "deepseek"
  if (explicit === "ollama") return "ollama"

  // Check for available API keys
  if (process.env.OLLAMA_API_KEY) return "ollama"
  if (process.env.DEEPSEEK_API_KEY) return "deepseek"
  if (process.env.OPENAI_API_KEY) return "openai"

  // Default to Ollama if configured, otherwise DeepSeek
  return "ollama"
}

async function callOllamaCloud(
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    jsonMode?: boolean
    retries?: number
    operation?: string
  }
): Promise<string> {
  const {
    systemPrompt,
    temperature = 0.7,
    maxTokens = 4000,
    jsonMode = false,
    retries = 3,
    operation = "deepseek_chat",
  } = options

  const apiKey = process.env.OLLAMA_API_KEY
  if (!apiKey) {
    throw new DeepSeekError("OLLAMA_API_KEY environment variable is not set")
  }

  const endpoint = process.env.OLLAMA_ENDPOINT || "https://ollama.com"
  const model = process.env.OLLAMA_MODEL || "qwen3-next:80b"

  const messages: Array<{ role: "system" | "user"; content: string }> = []
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt })
  messages.push({ role: "user", content: prompt })

  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
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

      if (!response.ok) {
        const errorBody = await response.text()
        throw new DeepSeekError(
          `Ollama API error: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        )
      }

      const data = await response.json()
      const content = data.message?.content
      if (!content) throw new DeepSeekError("Ollama returned no content")

      // Track usage for system operations (news processing)
      await trackAIUsage({
        companyId: "system",
        operation: operation as any,
        model,
        inputTokens: 0, // Ollama doesn't provide token counts
        outputTokens: 0,
        success: true,
      })

      return content
    } catch (error) {
      lastError = error as Error

      if (error instanceof DeepSeekError && error.statusCode === 401) {
        throw error
      }

      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // Track failed request
  await trackAIUsage({
    companyId: "system",
    operation: operation as any,
    model,
    inputTokens: 0,
    outputTokens: 0,
    success: false,
  })

  throw new DeepSeekError(
    `Ollama API failed after ${retries} attempts: ${lastError?.message}`,
    undefined,
    lastError
  )
}

async function callOpenAI(
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    jsonMode?: boolean
    retries?: number
    operation?: string
  }
): Promise<string> {
  const {
    systemPrompt,
    temperature = 0.4,
    maxTokens = 2000,
    jsonMode = false,
    retries = 3,
    operation = "deepseek_chat",
  } = options

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new DeepSeekError("OPENAI_API_KEY environment variable is not set")
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini"
  const openai = new OpenAI({ apiKey })

  const messages: Array<{ role: "system" | "user"; content: string }> = []
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt })
  messages.push({ role: "user", content: prompt })

  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: jsonMode ? { type: "json_object" } : undefined,
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new DeepSeekError("OpenAI returned no content")

      // Track usage for system operations (news processing)
      await trackAIUsage({
        companyId: "system",
        operation: operation as any,
        model,
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        success: true,
      })

      return content
    } catch (error) {
      lastError = error as Error

      // Wait before retry (exponential backoff)
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // Track failed request
  await trackAIUsage({
    companyId: "system",
    operation: operation as any,
    model,
    inputTokens: 0,
    outputTokens: 0,
    success: false,
  })

  throw new DeepSeekError(
    `OpenAI API failed after ${retries} attempts: ${lastError?.message}`,
    undefined,
    lastError
  )
}

/**
 * Call DeepSeek API with automatic retry logic
 */
export async function callDeepSeek(
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
    operation = "deepseek_chat",
  } = options

  const provider = resolveProvider()
  if (provider === "ollama") {
    return callOllamaCloud(prompt, {
      systemPrompt,
      temperature,
      maxTokens,
      jsonMode,
      retries,
      operation,
    })
  }
  if (provider === "openai") {
    return callOpenAI(prompt, {
      systemPrompt,
      temperature,
      maxTokens,
      jsonMode,
      retries,
      operation,
    })
  }

  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new DeepSeekError("DEEPSEEK_API_KEY environment variable is not set")
  }

  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat"

  const messages: DeepSeekMessage[] = []
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt })
  }
  messages.push({ role: "user", content: prompt })

  const requestBody: DeepSeekRequest = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  }

  if (jsonMode) {
    requestBody.response_format = { type: "json_object" }
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new DeepSeekError(
          `DeepSeek API error: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        )
      }

      const data: DeepSeekResponse = await response.json()

      if (!data.choices || data.choices.length === 0) {
        throw new DeepSeekError("DeepSeek API returned no choices")
      }

      const content = data.choices[0].message.content

      // Track usage for system operations (news processing)
      if (data.usage) {
        await trackAIUsage({
          companyId: "system",
          operation: operation as any,
          model,
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          success: true,
        })
      }

      return content
    } catch (error) {
      lastError = error as Error

      // Don't retry on authentication errors
      if (error instanceof DeepSeekError && error.statusCode === 401) {
        throw error
      }

      // Wait before retry (exponential backoff)
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // Track failed request
  await trackAIUsage({
    companyId: "system",
    operation: operation as any,
    model: model || "deepseek-chat",
    inputTokens: 0,
    outputTokens: 0,
    success: false,
  })

  throw new DeepSeekError(
    `DeepSeek API failed after ${retries} attempts: ${lastError?.message}`,
    undefined,
    lastError
  )
}

/**
 * Call DeepSeek and parse JSON response
 */
export async function callDeepSeekJSON<T>(
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    retries?: number
    operation?: string
  } = {}
): Promise<T> {
  const response = await callDeepSeek(prompt, {
    ...options,
    jsonMode: true,
  })

  try {
    return JSON.parse(response) as T
  } catch (error) {
    throw new DeepSeekError(
      `Failed to parse DeepSeek JSON response: ${(error as Error).message}`,
      undefined,
      response
    )
  }
}
