/**
 * AI Pipeline - Pass 2: Review
 * Quality critique and feedback generation with source verification
 */

import { callOllamaJSON } from "./ollama-client"

export interface ReviewFeedback {
  score: number // 1-10
  problems: string[]
  suggestions: string[]
  rewrite_focus: string
  factual_issues: string[] // NEW: specific factual problems found
}

const NEWS_REVIEWER_SYSTEM_PROMPT =
  "Ti si strogi urednik FiskAI portala. Prioritet je činjenična točnost, jasnoća i korisnost za hrvatske poduzetnike. Ne toleriraš generičan sadržaj."

const REVIEW_PROMPT = `Ti si STROGI urednik FiskAI portala. Tvoj posao je osigurati kvalitetu i TOČNOST članaka.

## IZVORNI MATERIJAL (koristi za provjeru činjenica):
{source_title}
{source_content}
Izvor: {source_url}

## ČLANAK ZA PREGLED:
Naslov: {title}

{content}

## PROVJERI KRITIČKI:

### 1. ČINJENIČNA TOČNOST (najvažnije!)
- Usporedi SVAKI datum, broj, iznos, rok s izvorom
- Jesu li imena, institucije, zakoni točno navedeni?
- Je li kontekst ispravan ili je nešto izmišljeno/pretpostavljeno?
- AKO NEMA U IZVORU, NE SMIJE BITI U ČLANKU

### 2. AI SLOP DETEKCIJA
- Generičke fraze: "ključno je", "važno je napomenuti", "u konačnici"
- Prazne rečenice koje ništa ne govore
- Pretjerano duge uvode bez konkretnih informacija
- Repetitivni zaključci

### 3. STRUKTURA I KORISNOST
- Je li struktura logična za OVU vijest?
- Ako ima ROK - je li istaknut na početku?
- Ako zahtijeva AKCIJU - je li jasno što napraviti?
- Može li čitatelj razumjeti bez prethodnog znanja?
- Ima li jasni TL;DR i checklistu koraka (ako je primjenjivo)?

### 4. DULJINA
- Je li predugačko za sadržaj koji nudi?
- Ima li ponavljanja?

## OCJENJIVANJE (budi strog, variraj ocjene!):
- 9-10: Izvrsno, bez greški, odmah spremno za objavu
- 7-8: Dobro, male korekcije potrebne
- 5-6: Prosječno, treba prepraviti
- 3-4: Loše, značajni problemi
- 1-2: Neprihvatljivo, potpuno prepisati

NE DAJI SVIMA 7! Ako je članak stvarno dobar, daj 8-9. Ako ima problema, daj 5-6.

Vrati odgovor ISKLJUČIVO u JSON formatu:
{
  "score": <broj 1-10>,
  "factual_issues": ["lista KONKRETNIH činjeničnih grešaka pronađenih usporedbom s izvorom"],
  "problems": ["ostali problemi - struktura, stil, duljina"],
  "suggestions": ["konkretne izmjene koje treba napraviti"],
  "rewrite_focus": "što treba NAJVIŠE popraviti u jednoj rečenici"
}`

/**
 * Review an article draft with source verification
 */
export async function reviewArticle(
  draft: {
    title: string
    content: string
  },
  source?: {
    title: string
    content: string
    url: string
  }
): Promise<ReviewFeedback> {
  const prompt = REVIEW_PROMPT.replace("{title}", draft.title)
    .replace("{content}", draft.content)
    .replace("{source_title}", source?.title || "N/A")
    .replace(
      "{source_content}",
      source?.content?.substring(0, 2000) || "Izvorni sadržaj nije dostupan"
    )
    .replace("{source_url}", source?.url || "N/A")

  try {
    const feedback = await callOllamaJSON<ReviewFeedback>(prompt, {
      systemPrompt: NEWS_REVIEWER_SYSTEM_PROMPT,
      temperature: 0.6, // Slightly higher for more varied scoring
      maxTokens: 1500,
    })

    // Validate response
    if (typeof feedback.score !== "number" || feedback.score < 1 || feedback.score > 10) {
      throw new Error(`Invalid score: ${feedback.score}`)
    }

    if (!Array.isArray(feedback.problems)) {
      feedback.problems = []
    }

    if (!Array.isArray(feedback.suggestions)) {
      feedback.suggestions = []
    }

    if (!Array.isArray(feedback.factual_issues)) {
      feedback.factual_issues = []
    }

    // Penalize if factual issues found
    if (feedback.factual_issues.length > 0 && feedback.score > 6) {
      feedback.score = Math.min(feedback.score, 6)
      feedback.problems.unshift(`ČINJENIČNE GREŠKE: ${feedback.factual_issues.length} problema`)
    }

    if (!feedback.rewrite_focus || feedback.rewrite_focus.length < 10) {
      feedback.rewrite_focus = "Pregledati i popraviti označene probleme"
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
  // Articles scoring below 7 OR with factual issues need rewriting
  return feedback.score < 7 || feedback.factual_issues.length > 0
}

/**
 * Review multiple articles in batch with sources
 */
export async function reviewArticles(
  drafts: Array<{
    id: string
    title: string
    content: string
    source?: { title: string; content: string; url: string }
  }>
): Promise<Map<string, ReviewFeedback>> {
  const results = new Map<string, ReviewFeedback>()

  for (const draft of drafts) {
    try {
      const feedback = await reviewArticle(
        { title: draft.title, content: draft.content },
        draft.source
      )
      results.set(draft.id, feedback)
    } catch (error) {
      console.error(`Failed to review article ${draft.id}:`, error)
    }
  }

  return results
}
