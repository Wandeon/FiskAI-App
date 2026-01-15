import type { RuleCandidate } from "./rule-selector"
import { assistantLogger } from "@/lib/logger"
import { chatJSON, OllamaError } from "@/lib/ai/ollama-client"

/**
 * CONTEXTUAL QUESTION GENERATION
 *
 * Generates related questions based on:
 * - Retrieved rules and their concepts
 * - User query context
 * - Company profile (when available)
 * - Rule dependencies and related concepts
 *
 * This replaces the hardcoded question maps with dynamic LLM generation.
 * Uses Ollama for LLM inference.
 */

interface QuestionGenerationContext {
  userQuery: string
  retrievedRules: RuleCandidate[]
  conceptSlugs: string[]
  surface: "MARKETING" | "APP"
  companyProfile?: {
    businessType?: string
    yearlyRevenue?: number
    vatRegistered?: boolean
  }
}

/**
 * Generate contextually relevant follow-up questions
 * using LLM based on the actual answer given.
 */
export async function generateContextualQuestions(
  context: QuestionGenerationContext
): Promise<string[]> {
  try {
    // Build prompt with retrieved rules context
    const rulesContext = context.retrievedRules
      .slice(0, 3) // Use top 3 rules for context
      .map((rule) => {
        return `- ${rule.titleHr} (concept: ${rule.conceptSlug})`
      })
      .join("\n")

    const conceptsContext = [...new Set(context.conceptSlugs)].join(", ")

    const systemPrompt = `You are an AI assistant helping Croatian business owners with regulatory questions.

Your task is to generate 3-4 relevant follow-up questions that users might naturally ask after receiving an answer to their query.

Guidelines:
- Questions should be written in Croatian, as complete questions (not keywords)
- They should be directly related to the concepts and rules mentioned
- Prioritize questions about:
  1. Related regulatory concepts in the same domain
  2. Practical implications or next steps
  3. Prerequisites or conditions mentioned in the rules
  4. Common edge cases or exceptions
- Questions should be concise (max 60 characters)
- DO NOT repeat the original question
- DO NOT suggest generic questions like "Gdje mogu naći više informacija?"

Return ONLY a JSON array of question strings, nothing else.
Example: ["Koje su stope PDV-a?", "Kada moram u sustav PDV-a?", "Kako se prijavljuje PDV?"]`

    let userPrompt = `Original query: "${context.userQuery}"

Retrieved rules context:
${rulesContext}

Concepts: ${conceptsContext}
Surface: ${context.surface}
`

    if (context.companyProfile) {
      userPrompt += `\nCompany context: ${JSON.stringify(context.companyProfile)}`
    }

    userPrompt += `\n\nGenerate 3-4 relevant follow-up questions in Croatian:`

    const parsed = await chatJSON<{ questions: string[] } | string[]>(userPrompt, {
      systemPrompt,
      temperature: 0.7,
      maxTokens: 300,
      operation: "ollama_assistant",
    })

    if (!parsed) {
      assistantLogger.warn(
        { context },
        "No response from Ollama for contextual questions, falling back to static"
      )
      return getFallbackQuestions(context.conceptSlugs)
    }

    // Parse response - expect either array or object with questions array
    const questions: string[] = Array.isArray(parsed)
      ? parsed
      : (parsed as { questions: string[] }).questions || []

    // Validate and filter questions
    const validQuestions = questions
      .filter((q) => typeof q === "string" && q.length > 10 && q.length < 100)
      .slice(0, 4)

    if (validQuestions.length === 0) {
      assistantLogger.warn({ questions }, "No valid questions generated, falling back to static")
      return getFallbackQuestions(context.conceptSlugs)
    }

    assistantLogger.info(
      {
        query: context.userQuery,
        generated: validQuestions.length,
      },
      "Generated contextual questions"
    )

    return validQuestions
  } catch (error) {
    assistantLogger.error(
      { error, context },
      "Error generating contextual questions, falling back to static"
    )
    return getFallbackQuestions(context.conceptSlugs)
  }
}

/**
 * Generate clarification questions for low-confidence queries
 * using LLM to suggest relevant topics based on partial matches.
 */
export async function generateContextualClarifications(
  userQuery: string,
  topic: string,
  entities: string[]
): Promise<string[]> {
  try {
    const systemPrompt = `You are an AI assistant helping Croatian business owners with regulatory questions.

The user's query was too vague or unclear to answer directly.

Your task is to generate 3-5 clarification questions that would help narrow down what they're asking about.

Guidelines:
- Questions should be written in Croatian, as complete questions users could click on
- They should be related to Croatian business regulations, taxes, and compliance
- Cover different common regulatory topics: PDV (VAT), paušalni obrt, doprinosi, fiskalizacija, porez na dohodak
- Questions should be specific and actionable (not generic)
- Questions should be concise (max 70 characters)

Return ONLY a JSON array of question strings, nothing else.`

    let userPrompt = `User's vague query: "${userQuery}"\nDetected topic: ${topic}\n`

    if (entities.length > 0) {
      userPrompt += `Detected entities: ${entities.join(", ")}\n`
    }

    userPrompt += `\nGenerate 3-5 clarification questions in Croatian:`

    const parsed = await chatJSON<{ questions: string[] } | string[]>(userPrompt, {
      systemPrompt,
      temperature: 0.8,
      maxTokens: 400,
      operation: "ollama_assistant",
    })

    if (!parsed) {
      return getDefaultClarifications(topic)
    }

    const questions: string[] = Array.isArray(parsed)
      ? parsed
      : (parsed as { questions: string[] }).questions || []

    const validQuestions = questions
      .filter((q) => typeof q === "string" && q.length > 10 && q.length < 120)
      .slice(0, 5)

    if (validQuestions.length < 3) {
      return getDefaultClarifications(topic)
    }

    assistantLogger.info(
      {
        query: userQuery,
        generated: validQuestions.length,
      },
      "Generated contextual clarifications"
    )

    return validQuestions
  } catch (error) {
    assistantLogger.error({ error, userQuery }, "Error generating clarifications")
    return getDefaultClarifications(topic)
  }
}

/**
 * Fallback questions based on concept slugs when LLM fails
 */
function getFallbackQuestions(conceptSlugs: string[]): string[] {
  const questionMap: Record<string, string[]> = {
    pausalni: ["Koji su uvjeti za paušalni obrt?", "Kada prelazim u redovno oporezivanje?"],
    pdv: ["Koje su stope PDV-a?", "Kada moram u sustav PDV-a?"],
    doprinosi: ["Koliki su doprinosi za obrtnike?", "Kada se plaćaju doprinosi?"],
    fiskalizacija: ["Kako fiskalizirati račun?", "Što mi treba za fiskalizaciju?"],
    "porez-dohodak": ["Koji je porez na dohodak?", "Kako se prijavljuje porez na dohodak?"],
  }

  const questions: string[] = []
  for (const slug of conceptSlugs) {
    for (const [key, qs] of Object.entries(questionMap)) {
      if (slug.includes(key)) {
        questions.push(...qs)
      }
    }
  }

  return [...new Set(questions)].slice(0, 4)
}

/**
 * Default clarifications when LLM is unavailable
 */
function getDefaultClarifications(topic: string): string[] {
  if (topic === "REGULATORY") {
    return [
      "Koja je opća stopa PDV-a u Hrvatskoj?",
      "Koji je prag za paušalni obrt?",
      "Kako fiskalizirati račun?",
      "Kada moram u sustav PDV-a?",
      "Koliki su doprinosi za obrtnike?",
    ]
  } else if (topic === "PRODUCT") {
    return [
      "Koje su cijene FiskAI pretplate?",
      "Kako se registrirati za FiskAI?",
      "Koje funkcije nudi FiskAI?",
    ]
  } else {
    return ["Kako prijaviti tehnički problem?", "Gdje mogu dobiti pomoć?"]
  }
}
