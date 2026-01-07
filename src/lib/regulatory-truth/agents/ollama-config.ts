// src/lib/regulatory-truth/agents/ollama-config.ts
// Ollama configuration for extraction (separate from embeddings)
//
// Split configuration:
// - Extraction: OLLAMA_EXTRACT_* (Ollama Cloud with larger models)
// - Embeddings: OLLAMA_EMBED_* (local Ollama for fast vector generation)
//
// Extraction vars fall back to generic OLLAMA_* for backwards compatibility.

/**
 * Get Ollama endpoint for extraction.
 * Priority: OLLAMA_EXTRACT_ENDPOINT > OLLAMA_ENDPOINT > default
 */
export function getOllamaExtractEndpoint(): string {
  return process.env.OLLAMA_EXTRACT_ENDPOINT || process.env.OLLAMA_ENDPOINT || "https://ollama.com"
}

/**
 * Get Ollama model for extraction.
 * Priority: OLLAMA_EXTRACT_MODEL > OLLAMA_MODEL > default
 */
export function getOllamaExtractModel(): string {
  return process.env.OLLAMA_EXTRACT_MODEL || process.env.OLLAMA_MODEL || "llama3.1"
}

/**
 * Get Ollama headers for extraction.
 * Priority: OLLAMA_EXTRACT_API_KEY > OLLAMA_API_KEY
 */
export function getOllamaExtractHeaders(): HeadersInit {
  const apiKey = process.env.OLLAMA_EXTRACT_API_KEY || process.env.OLLAMA_API_KEY
  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (apiKey && apiKey !== "local") {
    headers["Authorization"] = `Bearer ${apiKey}`
  }
  return headers
}
