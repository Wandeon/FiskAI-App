/**
 * AI Pipeline - Pass 1: Writing
 * Generates articles and digest entries from classified news
 */

import type { NewsItem } from "@/lib/db/schema/news"
import { callDeepSeek } from "./deepseek-client"

export interface ArticleContent {
  title: string
  content: string // markdown
  excerpt: string
}

const WRITING_PROMPT_HIGH_IMPACT = `Napiši članak za FiskAI portal o ovoj vijesti.

PRAVILA:
1. NE koristi uvijek iste sekcije - struktura ovisi o sadržaju
2. NE počinji sa "U današnjem dinamičnom poslovnom okruženju..."
3. NE koristi fraze: "ključno je napomenuti", "važno je istaknuti", "u konačnici"
4. BUDI konkretan - brojke, datumi, iznosi
5. AKO ima rok - stavi ga prominentno
6. AKO zahtijeva akciju - objasni točno što napraviti
7. AKO je samo informativno - nemoj izmišljati akcije

Ton: Profesionalan ali pristupačan. Kao da kolega računovođa objašnjava.

Duljina: 400-600 riječi, ovisno o kompleksnosti.

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
    const response = await callDeepSeek(filledPrompt, {
      temperature: 0.7,
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
