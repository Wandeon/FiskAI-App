/**
 * AI Pipeline - Pass 3: Rewrite
 * Incorporate review feedback, fix factual errors, and polish articles
 */

import type { ReviewFeedback } from "./reviewer"
import { callOllama } from "./ollama-client"

export interface RewriteResult {
  title: string
  content: string
  excerpt: string
}

const NEWS_REWRITER_SYSTEM_PROMPT =
  "Ti si urednik FiskAI portala. Prepravljaš tekst da bude činjenično točan, jasan i praktičan. Ne izmišljaš informacije; ako nešto nije u izvoru, izostavi ili napiši da izvor ne navodi."

const REWRITE_PROMPT = `Prepiši ovaj članak uzimajući u obzir feedback recenzenta.

## IZVORNI MATERIJAL (koristi za ispravljanje činjenica):
{source_title}
{source_content}
Izvor: {source_url}

## ORIGINALNI ČLANAK:
Naslov: {original_title}

{original_content}

## FEEDBACK RECENZENTA:
Ocjena: {score}/10

### ČINJENIČNE GREŠKE (OBAVEZNO ISPRAVI!):
{factual_issues}

### Ostali problemi:
{problems}

### Sugestije:
{suggestions}

### Fokus prepravke:
{rewrite_focus}

## UPUTE ZA PREPRAVLJANJE:
1. PRVO ispravi SVE činjenične greške koristeći izvorni materijal
2. NE IZMIŠLJAJ podatke koji nisu u izvoru
3. Ako nešto nije u izvoru, NEMOJ to uključiti u članak
4. Popravi strukturalne i stilske probleme (kratke rečenice, bez floskula)
5. Zadrži dobre dijelove originalnog članka
6. Zadrži strukturu s TL;DR i jasnim koracima kad je primjenjivo

Format odgovora:
NASLOV: [ispravljeni naslov]
EXCERPT: [kratak opis u 1-2 rečenice]
SADRŽAJ:
[prepravljeni članak u markdown formatu]`

/**
 * Rewrite article based on review feedback with source verification
 */
export async function rewriteArticle(
  draft: { title: string; content: string },
  feedback: ReviewFeedback,
  source?: {
    title: string
    content: string
    url: string
  }
): Promise<RewriteResult> {
  const factualIssuesList =
    feedback.factual_issues && feedback.factual_issues.length > 0
      ? feedback.factual_issues.map((f, i) => `${i + 1}. ${f}`).join("\n")
      : "Nema činjeničnih grešaka"

  const problemsList =
    feedback.problems.length > 0
      ? feedback.problems.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "Nema značajnih problema"

  const suggestionsList =
    feedback.suggestions.length > 0
      ? feedback.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : "Nema dodatnih sugestija"

  const prompt = REWRITE_PROMPT.replace("{original_title}", draft.title)
    .replace("{original_content}", draft.content)
    .replace("{score}", feedback.score.toString())
    .replace("{factual_issues}", factualIssuesList)
    .replace("{problems}", problemsList)
    .replace("{suggestions}", suggestionsList)
    .replace("{rewrite_focus}", feedback.rewrite_focus)
    .replace("{source_title}", source?.title || "N/A")
    .replace(
      "{source_content}",
      source?.content?.substring(0, 2000) || "Izvorni sadržaj nije dostupan"
    )
    .replace("{source_url}", source?.url || "N/A")

  try {
    const response = await callOllama(prompt, {
      systemPrompt: NEWS_REWRITER_SYSTEM_PROMPT,
      temperature: 0.35, // Lower for more accurate factual corrections
      maxTokens: 2500,
    })

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
 * Rewrite multiple articles in batch with sources
 */
export async function rewriteArticles(
  articles: Array<{
    id: string
    draft: { title: string; content: string }
    feedback: ReviewFeedback
    source?: { title: string; content: string; url: string }
  }>
): Promise<Map<string, RewriteResult>> {
  const results = new Map<string, RewriteResult>()

  for (const article of articles) {
    try {
      const rewritten = await rewriteArticle(article.draft, article.feedback, article.source)
      results.set(article.id, rewritten)
    } catch (error) {
      console.error(`Failed to rewrite article ${article.id}:`, error)
    }
  }

  return results
}
