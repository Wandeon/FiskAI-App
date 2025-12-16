// src/lib/news/ai-processor.ts

export interface AIConfig {
  provider: "deepseek" | "ollama"
  model: string
  endpoint?: string
  apiKey?: string
}

export interface NewsSummary {
  summaryHr: string
  categories: string[]
  relevanceScore: number
}

/**
 * Get AI configuration from environment variables
 */
export function getAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER || "deepseek") as "deepseek" | "ollama"

  if (provider === "ollama") {
    return {
      provider: "ollama",
      model: process.env.OLLAMA_MODEL || "llama3.2",
      endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
    }
  }

  // DeepSeek by default
  return {
    provider: "deepseek",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    endpoint: process.env.DEEPSEEK_ENDPOINT || "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY,
  }
}

/**
 * Call DeepSeek API for news summarization
 */
async function callDeepSeek(
  config: AIConfig,
  content: string,
  title: string
): Promise<NewsSummary> {
  if (!config.apiKey) {
    throw new Error("DeepSeek API key not configured")
  }

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
    const response = await fetch(`${config.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
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
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`)
    }

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content)

    return {
      summaryHr: result.summaryHr || "",
      categories: result.categories || [],
      relevanceScore: result.relevanceScore || 0,
    }
  } catch (error) {
    console.error("DeepSeek API call failed:", error)
    throw error
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
    const response = await fetch(`${config.endpoint}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        format: "json",
        system:
          "Ti si stručnjak za porezno i računovodstveno zakonodavstvo u Hrvatskoj. Tvoj zadatak je analizirati vijesti i procjenjivati njihovu važnost za poduzetnike.",
        options: {
          temperature: 0.3,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`)
    }

    const data = await response.json()
    const result = JSON.parse(data.response)

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
 * Main function to summarize news using configured AI provider
 */
export async function summarizeNews(content: string, title: string): Promise<NewsSummary> {
  const config = getAIConfig()

  if (config.provider === "ollama") {
    return callOllama(config, content, title)
  }

  return callDeepSeek(config, content, title)
}
