// src/lib/article-agent/verification/embedder.ts
// Ollama Cloud embeddings API

import { getOllamaConfig, OllamaError } from "../llm/ollama-client"

export async function embedText(text: string): Promise<number[]> {
  const config = getOllamaConfig()

  if (!config.apiKey) {
    throw new OllamaError("OLLAMA_API_KEY is required for embeddings")
  }

  const response = await fetch(`${config.endpoint}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.embedModel,
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

  const config = getOllamaConfig()

  if (!config.apiKey) {
    throw new OllamaError("OLLAMA_API_KEY is required for embeddings")
  }

  // Ollama embed API supports batch input
  const response = await fetch(`${config.endpoint}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.embedModel,
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
