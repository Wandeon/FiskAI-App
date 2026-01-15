/**
 * AI Pipeline - Pass 1: Writing
 * Generates articles and digest entries from classified news
 */

import type { NewsItem } from "@/lib/db/schema/news"
import { callOllama } from "./ollama-client"

export interface ArticleContent {
  title: string
  content: string // markdown
  excerpt: string
}

const NEWS_WRITER_SYSTEM_PROMPT =
  "Ti si urednik FiskAI portala za hrvatske poduzetnike i računovođe. Pišeš jasno, konkretno i bez floskula. Ne izmišljaš činjenice i nikad ne nagađaš."

const WRITING_PROMPT_HIGH_IMPACT = `Napiši članak za FiskAI portal o ovoj vijesti.

PRAVILA:
1. Koristi ISKLJUČIVO informacije iz izvora ispod. Ako nešto nije u izvoru, napiši: "Izvor ne navodi …"
2. Bez generičkih uvoda i fraza ("ključno je", "važno je napomenuti", "u konačnici").
3. Budi konkretan: brojevi, datumi, iznosi, pragovi i rokovi (ako postoje).
4. Ako postoji ROK ili OBVEZA, istakni ga odmah i napiši točno što napraviti.
5. Ne piši pravne savjete izvan izvora; fokus je na praktičnim koracima.
6. Ne spominji da si AI. Ne koristi HTML — samo Markdown.

STRUKTURA (zadrži redoslijed, ali prilagodi duljinu):
- **TL;DR** (3 kratke stavke)
- **Što se promijenilo**
- **Koga se tiče**
- **Rokovi** (samo ako postoje; datume podebljaj)
- **Što trebate napraviti** (checklista 3–7 koraka)
- **Kako FiskAI pomaže** (1–2 rečenice + 2 konkretne bullet stavke, bez prodajnog tona)

Ton: Profesionalan ali pristupačan. Kao da kolega računovođa objašnjava.

Duljina: 350-550 riječi, ovisno o kompleksnosti.

Vijest: {title}
{content}
Izvor: {source_url}

Format odgovora:
NASLOV: [naslov članka]
EXCERPT: [kratak opis u 1-2 rečenice]
SADRŽAJ:
[markdown sadržaj članka]`

const WRITING_PROMPT_MEDIUM_IMPACT = `Napiši sažetak ove vijesti za dnevni digest FiskAI portala.

PRAVILA:
- 2-3 rečenice
- Konkretno i točno
- Bez generičkih fraza
- Fokus na ključne informacije
- Ne izmišljaj činjenice; drži se izvora

Vijest: {title}
{content}

Format odgovora:
NASLOV: [kratak naslov]
EXCERPT: [2-3 rečenice sažetka]`

/**
 * Generate article content based on impact level
 */
export async function writeArticle(
  item: NewsItem,
  impact: "high" | "medium" | "low"
): Promise<ArticleContent> {
  if (impact === "low") {
    throw new Error("Cannot write article for low-impact items")
  }

  const prompt = impact === "high" ? WRITING_PROMPT_HIGH_IMPACT : WRITING_PROMPT_MEDIUM_IMPACT

  const filledPrompt = prompt
    .replace("{title}", item.originalTitle)
    .replace("{content}", item.originalContent || item.summaryHr || "")
    .replace("{source_url}", item.sourceUrl)

  try {
    const response = await callOllama(filledPrompt, {
      systemPrompt: NEWS_WRITER_SYSTEM_PROMPT,
      temperature: impact === "high" ? 0.4 : 0.2,
      maxTokens: impact === "high" ? 2000 : 500,
    })

    // Parse the structured response
    const article = parseArticleResponse(response, impact)

    // Validate
    if (!article.title || article.title.length < 10) {
      throw new Error("Article title too short or missing")
    }

    if (!article.excerpt || article.excerpt.length < 20) {
      throw new Error("Article excerpt too short or missing")
    }

    if (impact === "high" && article.content.length < 200) {
      throw new Error("Article content too short for high-impact item")
    }

    return article
  } catch (error) {
    console.error("Writing failed for item:", item.id, error)
    throw new Error(`Failed to write article: ${(error as Error).message}`)
  }
}

/**
 * Parse the AI response into structured article content
 */
function parseArticleResponse(response: string, impact: "high" | "medium"): ArticleContent {
  const lines = response.split("\n")
  let title = ""
  let excerpt = ""
  let content = ""
  let section: "none" | "title" | "excerpt" | "content" = "none"

  for (const line of lines) {
    if (line.startsWith("NASLOV:")) {
      title = line.replace("NASLOV:", "").trim()
      section = "title"
    } else if (line.startsWith("EXCERPT:")) {
      excerpt = line.replace("EXCERPT:", "").trim()
      section = "excerpt"
    } else if (line.startsWith("SADRŽAJ:") || line.startsWith("SADRŽ")) {
      section = "content"
    } else if (section === "title" && line.trim()) {
      title += " " + line.trim()
    } else if (section === "excerpt" && line.trim()) {
      excerpt += " " + line.trim()
    } else if (section === "content") {
      content += line + "\n"
    }
  }

  // For medium impact, the excerpt is the content
  if (impact === "medium" && !content.trim()) {
    content = excerpt
  }

  return {
    title: title.trim(),
    excerpt: excerpt.trim(),
    content: content.trim(),
  }
}

/**
 * Write multiple articles in batch
 */
export async function writeArticles(
  items: Array<{ item: NewsItem; impact: "high" | "medium" | "low" }>
): Promise<Map<string, ArticleContent>> {
  const results = new Map<string, ArticleContent>()

  // Process items sequentially to avoid rate limits
  for (const { item, impact } of items) {
    if (impact === "low") {
      continue // Skip low-impact items
    }

    try {
      const article = await writeArticle(item, impact)
      results.set(item.id, article)
    } catch (error) {
      console.error(`Failed to write article for item ${item.id}:`, error)
      // Continue with other items
    }
  }

  return results
}
