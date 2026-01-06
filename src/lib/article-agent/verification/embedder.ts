// src/lib/article-agent/verification/embedder.ts
// Embeddings API - uses dedicated endpoint (local Ollama via Tailscale)
// Separate from extraction/LLM which uses Ollama Cloud

import { OllamaError } from "../llm/ollama-client"

/**
 * Get embedding-specific configuration.
 * Uses OLLAMA_EMBED_* env vars, completely separate from LLM/extraction config.
 */
function getEmbedConfig() {
  return {
    endpoint: process.env.OLLAMA_EMBED_ENDPOINT || "http://localhost:11434",
    model: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
    dims: parseInt(process.env.OLLAMA_EMBED_DIMS || "768"),
    apiKey: process.env.OLLAMA_EMBED_API_KEY,
  }
}

export async function embedText(text: string): Promise<number[]> {
  const config = getEmbedConfig()

  const headers: HeadersInit = { "Content-Type": "application/json" }
  // Only add auth header if API key is set and not "local"
  if (config.apiKey && config.apiKey !== "local") {
    headers["Authorization"] = `Bearer ${config.apiKey}`
  }

  const response = await fetch(`${config.endpoint}/api/embed`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      input: text,
    }),
  })

  if (!response.ok) {
    throw new OllamaError(`Ollama embedding failed: ${response.statusText}`, response.status)
  }

  const data = await response.json()

  // Ollama embed API returns { embeddings: [[...]] } for single input
  if (!data.embeddings || !Array.isArray(data.embeddings) || !data.embeddings[0]) {
    throw new OllamaError("Ollama returned invalid embedding format")
  }

  return data.embeddings[0]
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const config = getEmbedConfig()

  const headers: HeadersInit = { "Content-Type": "application/json" }
  // Only add auth header if API key is set and not "local"
  if (config.apiKey && config.apiKey !== "local") {
    headers["Authorization"] = `Bearer ${config.apiKey}`
  }

  // Ollama embed API supports batch input
  const response = await fetch(`${config.endpoint}/api/embed`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      input: texts,
    }),
  })

  if (!response.ok) {
    throw new OllamaError(`Ollama batch embedding failed: ${response.statusText}`, response.status)
  }

  const data = await response.json()

  if (!data.embeddings || !Array.isArray(data.embeddings)) {
    throw new OllamaError("Ollama returned invalid batch embedding format")
  }

  return data.embeddings
}
