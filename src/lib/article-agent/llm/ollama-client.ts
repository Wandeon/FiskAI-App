// src/lib/article-agent/llm/ollama-client.ts

export interface OllamaConfig {
  endpoint: string
  model: string
  embedModel: string
  embedDims: number
}

export function getOllamaConfig(): OllamaConfig {
  return {
    endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "llama3.1",
    embedModel: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
    embedDims: parseInt(process.env.OLLAMA_EMBED_DIMS || "768"),
  }
}

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

export async function callOllama(
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    retries?: number
  } = {}
): Promise<string> {
  const config = getOllamaConfig()
  const { systemPrompt, temperature = 0.7, maxTokens = 4000, retries = 3 } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`${config.endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          prompt,
          system: systemPrompt,
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens,
          },
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new OllamaError(
          `Ollama API error: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        )
      }

      const data = await response.json()
      return data.response
    } catch (error) {
      lastError = error as Error

      if (error instanceof OllamaError && error.statusCode === 401) {
        throw error
      }

      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw new OllamaError(
    `Ollama API failed after ${retries} attempts: ${lastError?.message}`,
    undefined,
    lastError
  )
}

export async function callOllamaJSON<T>(
  prompt: string,
  options: {
    systemPrompt?: string
    temperature?: number
    retries?: number
  } = {}
): Promise<T> {
  const config = getOllamaConfig()
  const { systemPrompt, temperature = 0.3, retries = 3 } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(`${config.endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          prompt,
          system: systemPrompt,
          stream: false,
          format: "json",
          options: {
            temperature,
          },
        }),
      })

      if (!response.ok) {
        throw new OllamaError(`Ollama API error: ${response.statusText}`, response.status)
      }

      const data = await response.json()
      return JSON.parse(data.response) as T
    } catch (error) {
      lastError = error as Error

      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw new OllamaError(
    `Ollama JSON call failed after ${retries} attempts: ${lastError?.message}`,
    undefined,
    lastError
  )
}
