// src/lib/news/ai-processor.ts

export interface AIConfig {
  provider: "ollama"
  model: string
  endpoint: string
  apiKey?: string
}

export interface NewsSummary {
  summaryHr: string
  categories: string[]
  relevanceScore: number
}

/**
 * Get AI configuration from environment variables
 * Uses Ollama exclusively (local or cloud instance)
 */
export function getAIConfig(): AIConfig {
  return {
    provider: "ollama",
    model: process.env.OLLAMA_MODEL || "llama3.2",
    endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
    apiKey: process.env.OLLAMA_API_KEY,
  }
}

/**
 * Call Ollama API for news summarization
 */
async function callOllama(config: AIConfig, content: string, title: string): Promise<NewsSummary> {
  const prompt = `Analiziraj sljedeću vijest i daj sažetak na hrvatskom jeziku, kategorije i ocjenu relevantnosti za hrvatske poduzetnike i računovođe.

Naslov: ${title}

Sadržaj: ${content}

Vrati rezultat SAMO u JSON formatu sa sljedećim poljima:
{
  "summaryHr": "Sažetak na hrvatskom (2-3 rečenice)",
  "categories": ["kategorija1", "kategorija2"], // Možeš koristiti: tax, vat, payroll, compliance, reporting, legislation, business, finance
  "relevanceScore": 0-100 // Koliko je ovo važno za ciljanu publiku
}`

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // Add authorization header if API key is configured (for Ollama Cloud)
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`
    }

    const response = await fetch(`${config.endpoint}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content:
              "Ti si stručnjak za porezno i računovodstveno zakonodavstvo u Hrvatskoj. Tvoj zadatak je analizirati vijesti i procjenjivati njihovu važnost za poduzetnike.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: false,
        format: "json",
        options: {
          temperature: 0.3,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    const data = await response.json()
    const messageContent = data.message?.content
    if (!messageContent) {
      throw new Error("No content in Ollama response")
    }

    const result = JSON.parse(messageContent)

    return {
      summaryHr: result.summaryHr || "",
      categories: result.categories || [],
      relevanceScore: result.relevanceScore || 0,
    }
  } catch (error) {
    console.error("Ollama API call failed:", error)
    throw error
  }
}

/**
 * Main function to summarize news using Ollama
 */
export async function summarizeNews(content: string, title: string): Promise<NewsSummary> {
  const config = getAIConfig()
  return callOllama(config, content, title)
}
