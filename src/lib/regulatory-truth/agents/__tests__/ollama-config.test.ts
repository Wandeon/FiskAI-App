// src/lib/regulatory-truth/agents/__tests__/ollama-config.test.ts
// Unit tests for Ollama config split (extraction vs embeddings)

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getOllamaExtractEndpoint, getOllamaExtractModel } from "../ollama-config"
import { getEmbedConfig } from "@/lib/article-agent/verification/embedder"

describe("Ollama Config Split", () => {
  // Store original env vars
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clear all Ollama env vars before each test
    delete process.env.OLLAMA_EXTRACT_ENDPOINT
    delete process.env.OLLAMA_EXTRACT_MODEL
    delete process.env.OLLAMA_EXTRACT_API_KEY
    delete process.env.OLLAMA_ENDPOINT
    delete process.env.OLLAMA_MODEL
    delete process.env.OLLAMA_API_KEY
    delete process.env.OLLAMA_EMBED_ENDPOINT
    delete process.env.OLLAMA_EMBED_MODEL
    delete process.env.OLLAMA_EMBED_API_KEY
  })

  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv }
  })

  describe("Extraction config (OLLAMA_EXTRACT_*)", () => {
    it("uses OLLAMA_EXTRACT_* when set", () => {
      process.env.OLLAMA_EXTRACT_ENDPOINT = "https://api.ollama.ai"
      process.env.OLLAMA_EXTRACT_MODEL = "gemma-3-27b"

      expect(getOllamaExtractEndpoint()).toBe("https://api.ollama.ai")
      expect(getOllamaExtractModel()).toBe("gemma-3-27b")
    })

    it("falls back to OLLAMA_* when OLLAMA_EXTRACT_* not set", () => {
      process.env.OLLAMA_ENDPOINT = "http://fallback:11434"
      process.env.OLLAMA_MODEL = "fallback-model"

      expect(getOllamaExtractEndpoint()).toBe("http://fallback:11434")
      expect(getOllamaExtractModel()).toBe("fallback-model")
    })

    it("prefers OLLAMA_EXTRACT_* over OLLAMA_*", () => {
      process.env.OLLAMA_EXTRACT_ENDPOINT = "https://api.ollama.ai"
      process.env.OLLAMA_EXTRACT_MODEL = "gemma-3-27b"
      process.env.OLLAMA_ENDPOINT = "http://local:11434"
      process.env.OLLAMA_MODEL = "local-model"

      expect(getOllamaExtractEndpoint()).toBe("https://api.ollama.ai")
      expect(getOllamaExtractModel()).toBe("gemma-3-27b")
    })

    it("uses default when no env vars set", () => {
      expect(getOllamaExtractEndpoint()).toBe("https://ollama.com")
      expect(getOllamaExtractModel()).toBe("llama3.1")
    })
  })

  describe("Embedding config (OLLAMA_EMBED_*)", () => {
    it("uses OLLAMA_EMBED_* for embeddings", () => {
      process.env.OLLAMA_EMBED_ENDPOINT = "http://100.89.2.111:11434"
      process.env.OLLAMA_EMBED_MODEL = "nomic-embed-text"

      const config = getEmbedConfig()
      expect(config.endpoint).toBe("http://100.89.2.111:11434")
      expect(config.model).toBe("nomic-embed-text")
    })

    it("does NOT use OLLAMA_EXTRACT_* for embeddings", () => {
      process.env.OLLAMA_EXTRACT_ENDPOINT = "https://api.ollama.ai"
      process.env.OLLAMA_EXTRACT_MODEL = "gemma-3-27b"

      const config = getEmbedConfig()
      // Should use defaults, not OLLAMA_EXTRACT_*
      expect(config.endpoint).toBe("http://localhost:11434")
      expect(config.model).toBe("nomic-embed-text")
    })

    it("embedding and extraction configs are independent", () => {
      // Set up completely different configs
      process.env.OLLAMA_EXTRACT_ENDPOINT = "https://api.ollama.ai"
      process.env.OLLAMA_EXTRACT_MODEL = "gemma-3-27b"
      process.env.OLLAMA_EMBED_ENDPOINT = "http://100.89.2.111:11434"
      process.env.OLLAMA_EMBED_MODEL = "nomic-embed-text"

      // Extraction should use OLLAMA_EXTRACT_*
      expect(getOllamaExtractEndpoint()).toBe("https://api.ollama.ai")
      expect(getOllamaExtractModel()).toBe("gemma-3-27b")

      // Embeddings should use OLLAMA_EMBED_*
      const embedConfig = getEmbedConfig()
      expect(embedConfig.endpoint).toBe("http://100.89.2.111:11434")
      expect(embedConfig.model).toBe("nomic-embed-text")
    })
  })
})
