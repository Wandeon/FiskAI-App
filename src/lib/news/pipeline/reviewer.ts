/**
 * AI Pipeline - Pass 2: Review
 * Quality critique and feedback generation
 */

import { callDeepSeekJSON } from "./deepseek-client"

export interface ReviewFeedback {
  score: number // 1-10
  problems: string[]
  suggestions: string[]
  rewrite_focus: string
}

const REVIEW_PROMPT = `Pregledaj ovaj članak kao strogi urednik. Budi kritičan.

PROVJERI:
□ Ima li generičkih fraza koje ništa ne znače?
□ Je li struktura logična za OVU konkretnu vijest?
□ Jesu li informacije točne prema izvoru?
□ Može li čitatelj razumjeti bez prethodnog znanja?
□ Ako ima rok/akcija - je li dovoljno istaknut?
□ Je li predugačko? Može li se skratiti bez gubitka?

ČLANAK ZA PREGLED:
Naslov: {title}

{content}

Vrati odgovor ISKLJUČIVO u JSON formatu:
{
  "score": 1-10,
  "problems": ["konkretni problemi"],
  "suggestions": ["konkretne izmjene"],
  "rewrite_focus": "što treba najviše popraviti"
}`

/**
 * Review an article draft and provide structured feedback
 */
export async function reviewArticle(draft: {
  title: string
  content: string
}): Promise<ReviewFeedback> {
  const prompt = REVIEW_PROMPT.replace("{title}", draft.title).replace("{content}", draft.content)

  try {
    const feedback = await callDeepSeekJSON<ReviewFeedback>(prompt, {
      temperature: 0.5, // Balanced temperature for critical review
      maxTokens: 1000,
    })

    // Validate response
    if (typeof feedback.score !== "number" || feedback.score < 1 || feedback.score > 10) {
      throw new Error(`Invalid score: ${feedback.score}`)
    }

    if (!Array.isArray(feedback.problems)) {
      throw new Error("Problems must be an array")
    }

    if (!Array.isArray(feedback.suggestions)) {
      throw new Error("Suggestions must be an array")
    }

    if (!feedback.rewrite_focus || feedback.rewrite_focus.length < 10) {
      throw new Error("Rewrite focus too short or missing")
    }

    return feedback
  } catch (error) {
    console.error("Review failed for article:", draft.title, error)
    throw new Error(`Failed to review article: ${(error as Error).message}`)
  }
}

/**
 * Check if article needs rewriting based on review score
 */
export function needsRewrite(feedback: ReviewFeedback): boolean {
  // Articles scoring 7 or below need rewriting
  return feedback.score < 7
}

/**
 * Review multiple articles in batch
 */
export async function reviewArticles(
  drafts: Array<{ id: string; title: string; content: string }>
): Promise<Map<string, ReviewFeedback>> {
  const results = new Map<string, ReviewFeedback>()

  // Process articles sequentially to avoid rate limits
  for (const draft of drafts) {
    try {
      const feedback = await reviewArticle(draft)
      results.set(draft.id, feedback)
    } catch (error) {
      console.error(`Failed to review article ${draft.id}:`, error)
      // Continue with other articles
    }
  }

  return results
}
