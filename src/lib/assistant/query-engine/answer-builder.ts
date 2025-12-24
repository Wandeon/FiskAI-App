import { nanoid } from "nanoid"
import {
  SCHEMA_VERSION,
  type AssistantResponse,
  type Surface,
  type Topic,
  type RefusalReason,
  type ClientContextBlock,
} from "@/lib/assistant/types"
import { extractKeywords } from "./text-utils"
import { matchConcepts } from "./concept-matcher"
import { selectRules } from "./rule-selector"
import { detectConflicts } from "./conflict-detector"
import { buildCitations } from "./citation-builder"

// Simple topic classification keywords
const PRODUCT_KEYWORDS = ["fiskai", "prijava", "registracija", "aplikacija", "cijena", "plan"]
const SUPPORT_KEYWORDS = ["pomoc", "podrska", "greska", "bug", "ne-radi", "problem"]

// Keywords that indicate personalization is needed (Croatian)
const PERSONALIZATION_KEYWORDS = [
  // Possessives
  "moj",
  "moja",
  "moje",
  "moji",
  "moju",
  "mojim",
  "mojoj",
  // Questions about specific calculations
  "koliko",
  "izračunaj",
  "izracunaj",
  "obračunaj",
  "obracunaj",
  // Specific to user's situation
  "trebam",
  "moram",
  "platiti",
  "placati",
  // Thresholds with personal context
  "prelazim",
  "prijelaz",
  "granicu",
]

// Fields that would be used for personalization
const PERSONALIZATION_FIELDS: Record<string, string[]> = {
  pausalni: ["yearlyRevenue", "businessType", "activityCode"],
  pdv: ["yearlyRevenue", "euTransactions", "vatRegistered"],
  doprinosi: ["businessType", "yearlyIncome", "employeeCount"],
  fiskalizacija: ["businessType", "cashTransactions", "posDevice"],
}

interface PersonalizationCheck {
  needed: boolean
  requiredFields: string[]
  matchedKeywords: string[]
}

function classifyTopic(keywords: string[]): Topic {
  const normalizedKeywords = keywords.map((k) => k.toLowerCase())

  if (PRODUCT_KEYWORDS.some((pk) => normalizedKeywords.includes(pk))) {
    return "PRODUCT"
  }
  if (SUPPORT_KEYWORDS.some((sk) => normalizedKeywords.includes(sk))) {
    return "SUPPORT"
  }

  // Default to regulatory for this assistant
  return "REGULATORY"
}

/**
 * Detect if query requires client-specific data for personalization.
 * NOTE: This uses the raw query, not extracted keywords, because
 * personalization keywords (moj, koliko, trebam) are filtered as stopwords.
 * Returns the fields that would be needed for a personalized answer.
 */
function detectPersonalizationNeed(rawQuery: string, conceptSlugs: string[]): PersonalizationCheck {
  // Tokenize raw query (without stopword removal) for personalization detection
  const rawTokens = rawQuery
    .toLowerCase()
    .replace(/[čćžšđ]/g, (c) =>
      c === "č" || c === "ć" ? "c" : c === "ž" ? "z" : c === "š" ? "s" : c === "đ" ? "d" : c
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)

  // Check for personalization keywords in raw query tokens
  const matchedKeywords = PERSONALIZATION_KEYWORDS.filter((pk) =>
    rawTokens.some((t) => t === pk || t.startsWith(pk) || pk.startsWith(t))
  )

  if (matchedKeywords.length === 0) {
    return { needed: false, requiredFields: [], matchedKeywords: [] }
  }

  // Determine required fields based on matched concepts
  const requiredFields: string[] = []
  for (const slug of conceptSlugs) {
    for (const [domain, fields] of Object.entries(PERSONALIZATION_FIELDS)) {
      if (slug.includes(domain)) {
        requiredFields.push(...fields)
      }
    }
  }

  return {
    needed: true,
    requiredFields: [...new Set(requiredFields)],
    matchedKeywords,
  }
}

export async function buildAnswer(
  query: string,
  surface: Surface,
  companyId?: string
): Promise<AssistantResponse> {
  const requestId = `req_${nanoid()}`
  const traceId = `trace_${nanoid()}`
  const createdAt = new Date().toISOString()

  // Base response fields
  const baseResponse = {
    schemaVersion: SCHEMA_VERSION,
    requestId,
    traceId,
    surface,
    createdAt,
  }

  // 1. Extract keywords
  const keywords = extractKeywords(query)

  // 2. Classify topic
  const topic = classifyTopic(keywords)

  // If not regulatory, return refusal (this assistant only handles regulatory)
  if (topic !== "REGULATORY") {
    return {
      ...baseResponse,
      kind: "REFUSAL",
      topic,
      headline: "Ovo pitanje nije regulatorne prirode",
      directAnswer: "",
      refusalReason: "OUT_OF_SCOPE",
      refusal: {
        message:
          "Ovaj asistent odgovara samo na regulatorna pitanja o porezima, PDV-u, doprinosima i fiskalizaciji.",
        relatedTopics: ["porez na dohodak", "PDV", "doprinosi", "fiskalizacija"],
      },
    }
  }

  // 3. Match concepts
  const conceptMatches = await matchConcepts(keywords)

  if (conceptMatches.length === 0) {
    return buildNoCitableRulesRefusal(baseResponse, topic)
  }

  // 3.5. Early personalization detection (for proper error handling)
  const conceptSlugs = conceptMatches.map((c) => c.slug)
  const personalization = detectPersonalizationNeed(query, conceptSlugs)

  // 3.6. MINIMUM INTENT CHECK: Require ≥2 meaningful tokens for confident ANSWER
  // Single-token queries are too ambiguous for regulatory advice
  // EXCEPTION: Skip for personalization queries - they should trigger MISSING_CLIENT_DATA
  const totalMatchedTokens = new Set(conceptMatches.flatMap((c) => c.matchedKeywords)).size
  const isLowIntent = keywords.length < 2 || totalMatchedTokens < 2

  if (isLowIntent && !personalization.needed) {
    // For low-intent non-personalized queries, return REFUSAL asking for clarification
    return {
      ...baseResponse,
      kind: "REFUSAL",
      topic,
      headline: "Molimo precizirajte pitanje",
      directAnswer: "",
      refusalReason: "NO_CITABLE_RULES" as RefusalReason,
      refusal: {
        message:
          "Vaše pitanje je preopćenito. Molimo navedite više detalja, npr. 'Koja je opća stopa PDV-a u Hrvatskoj?' ili 'Koji je prag za paušalni obrt?'",
        relatedTopics: ["porez na dohodak", "PDV stope", "paušalni obrt", "fiskalizacija"],
      },
    }
  }

  // 4. Select rules for matched concepts
  const rules = await selectRules(conceptSlugs)

  if (rules.length === 0) {
    return buildNoCitableRulesRefusal(baseResponse, topic)
  }

  // 4.5. Check personalization needs (APP surface only)
  // personalization already computed at step 3.5 using raw query (keywords have stopwords removed)
  if (surface === "APP" && personalization.needed && !companyId) {
    // APP surface requires client data for personalized answers
    return {
      ...baseResponse,
      kind: "REFUSAL",
      topic,
      headline: "Potrebni su podaci o poslovanju",
      directAnswer: "",
      refusalReason: "MISSING_CLIENT_DATA" as RefusalReason,
      refusal: {
        message:
          "Za personalizirani odgovor na ovo pitanje potrebni su podaci o vašem poslovanju. Molimo povežite vaš poslovni profil.",
      },
      clientContext: {
        used: [],
        completeness: {
          status: "NONE",
          score: 0,
        },
        missing: personalization.requiredFields.map((f) => ({
          label: f,
          impact: "Required for personalized answer",
        })),
      },
    }
  }

  // 5. Check for conflicts
  const conflictResult = detectConflicts(rules)

  if (conflictResult.hasConflict && !conflictResult.canResolve) {
    return {
      ...baseResponse,
      kind: "REFUSAL",
      topic,
      headline: "Proturječni propisi",
      directAnswer: "",
      refusalReason: "UNRESOLVED_CONFLICT",
      conflict: {
        status: "UNRESOLVED",
        description: conflictResult.description || "Višestruki izvori se ne slažu",
        sources: [],
      },
      refusal: {
        message:
          "Pronađeni su proturječni propisi za vaše pitanje. Preporučujemo konzultaciju sa stručnjakom.",
        conflictingSources: [],
      },
    }
  }

  // 6. Build citations
  const citations = buildCitations(rules)

  if (!citations) {
    return buildNoCitableRulesRefusal(baseResponse, topic)
  }

  // 7. Build answer from primary rule
  const primaryRule = rules[0]

  // Build client context for APP surface
  let clientContext: ClientContextBlock | undefined
  if (surface === "APP") {
    if (personalization.needed && companyId) {
      // In future: fetch actual client data here
      // For now, indicate what would be used
      clientContext = {
        used: [], // Would be populated from actual client data
        completeness: {
          status: "PARTIAL",
          score: 0.5,
        },
        missing: personalization.requiredFields.map((f) => ({
          label: f,
          impact: "Would improve answer accuracy",
        })),
      }
    } else if (!personalization.needed) {
      // No personalization needed for this query
      clientContext = {
        used: [],
        completeness: {
          status: "COMPLETE",
          score: 1.0,
        },
      }
    }
  }

  return {
    ...baseResponse,
    kind: "ANSWER",
    topic,
    headline: primaryRule.titleHr,
    directAnswer:
      primaryRule.explanationHr || formatValue(primaryRule.value, primaryRule.valueType),
    citations,
    confidence: {
      level:
        primaryRule.confidence >= 0.9 ? "HIGH" : primaryRule.confidence >= 0.7 ? "MEDIUM" : "LOW",
      score: primaryRule.confidence,
    },
    relatedQuestions: generateRelatedQuestions(conceptSlugs),
    ...(clientContext && { clientContext }),
  }
}

function buildNoCitableRulesRefusal(
  base: Partial<AssistantResponse>,
  topic: Topic
): AssistantResponse {
  return {
    ...base,
    kind: "REFUSAL",
    topic,
    headline: "Nema dostupnih službenih izvora",
    directAnswer: "",
    refusalReason: "NO_CITABLE_RULES",
    refusal: {
      message: "Nismo pronašli službene izvore koji odgovaraju na vaše pitanje.",
      relatedTopics: ["porez na dohodak", "PDV stope", "paušalni obrt", "fiskalizacija"],
    },
  } as AssistantResponse
}

function formatValue(value: string, valueType: string): string {
  switch (valueType) {
    case "currency_eur":
      return `${parseFloat(value).toLocaleString("hr-HR")} EUR`
    case "currency_hrk":
      return `${parseFloat(value).toLocaleString("hr-HR")} HRK`
    case "percentage":
      return `${value}%`
    default:
      return value
  }
}

function generateRelatedQuestions(conceptSlugs: string[]): string[] {
  // Static related questions based on concept areas
  const questionMap: Record<string, string[]> = {
    pausalni: ["Koji su uvjeti za paušalni obrt?", "Kada prelazim u redovno oporezivanje?"],
    pdv: ["Koje su stope PDV-a?", "Kada moram u sustav PDV-a?"],
    doprinosi: ["Koliki su doprinosi za obrtnike?", "Kada se plaćaju doprinosi?"],
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

// Re-export types for API layer
export type { ConceptMatch } from "./concept-matcher"
export type { RuleCandidate } from "./rule-selector"
export type { ConflictResult } from "./conflict-detector"
