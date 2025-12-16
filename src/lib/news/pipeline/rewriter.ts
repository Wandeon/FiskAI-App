/**
 * AI Pipeline - Pass 3: Rewrite
 * Incorporate review feedback and polish articles
 */

import type { ReviewFeedback } from "./reviewer"
import { callDeepSeek } from "./deepseek-client"

export interface RewriteResult {
  title: string
  content: string
  excerpt: string
}

const REWRITE_PROMPT = `Prepiši ovaj članak uzimajući u obzir feedback recenzenta.

ORIGINALNI ČLANAK:
Naslov: {original_title}

{original_content}

FEEDBACK RECENZENTA:
Ocjena: {score}/10
Problemi:
{problems}

Sugestije:
{suggestions}

Fokus prepravke: {rewrite_focus}

Zadržaj dobre dijelove, popravi probleme, implementiraj sugestije.

Format odgovora:
NASLOV: [novi naslov ako je potrebno]
EXCERPT: [kratak opis u 1-2 rečenice]
SADRŽAJ:
[prepravljeni članak u markdown formatu]`

/**
 * Rewrite article based on review feedback
 */
export async function rewriteArticle(
  draft: { title: string; content: string },
  feedback: ReviewFeedback
): Promise<RewriteResult> {
  const problemsList = feedback.problems.map((p, i) => `${i + 1}. ${p}`).join("\n")
  const suggestionsList = feedback.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")

  const prompt = REWRITE_PROMPT.replace("{original_title}", draft.title)
    .replace("{original_content}", draft.content)
    .replace("{score}", feedback.score.toString())
    .replace("{problems}", problemsList || "Nema značajnih problema")
    .replace("{suggestions}", suggestionsList || "Nema dodatnih sugestija")
    .replace("{rewrite_focus}", feedback.rewrite_focus)

  try {
    const response = await callDeepSeek(prompt, {
      temperature: 0.7,
      maxTokens: 2000,
    })

    // Parse the rewritten article
    const rewritten = parseRewriteResponse(response)

    // Validate
    if (!rewritten.title || rewritten.title.length < 10) {
      throw new Error("Rewritten title too short or missing")
    }

    if (!rewritten.excerpt || rewritten.excerpt.length < 20) {
      throw new Error("Rewritten excerpt too short or missing")
    }

    if (!rewritten.content || rewritten.content.length < 100) {
      throw new Error("Rewritten content too short or missing")
    }

    return rewritten
  } catch (error) {
    console.error("Rewrite failed for article:", draft.title, error)
    throw new Error(`Failed to rewrite article: ${(error as Error).message}`)
  }
}

/**
 * Parse the rewrite response into structured content
 */
function parseRewriteResponse(response: string): RewriteResult {
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

  return {
    title: title.trim(),
    excerpt: excerpt.trim(),
    content: content.trim(),
  }
}

/**
 * Rewrite multiple articles in batch
 */
export async function rewriteArticles(
  articles: Array<{
    id: string
    draft: { title: string; content: string }
    feedback: ReviewFeedback
  }>
): Promise<Map<string, RewriteResult>> {
  const results = new Map<string, RewriteResult>()

  // Process articles sequentially to avoid rate limits
  for (const article of articles) {
    try {
      const rewritten = await rewriteArticle(article.draft, article.feedback)
      results.set(article.id, rewritten)
    } catch (error) {
      console.error(`Failed to rewrite article ${article.id}:`, error)
      // Continue with other articles
    }
  }

  return results
}
