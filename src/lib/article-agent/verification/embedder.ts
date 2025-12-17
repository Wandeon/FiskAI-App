// src/lib/article-agent/verification/embedder.ts

import { getOllamaConfig, OllamaError } from "../llm/ollama-client"

export async function embedText(text: string): Promise<number[]> {
  const config = getOllamaConfig()

  const response = await fetch(`${config.endpoint}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.embedModel,
      prompt: text,
    }),
  })

  if (!response.ok) {
    throw new OllamaError(`Ollama embedding failed: ${response.statusText}`, response.status)
  }

  const data = await response.json()

  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new OllamaError("Ollama returned invalid embedding format")
  }

  return data.embedding
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  // Ollama doesn't have native batch, so we parallelize with concurrency limit
  const CONCURRENCY = 5
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const batch = texts.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map((text) => embedText(text)))
    results.push(...batchResults)
  }

  return results
}
