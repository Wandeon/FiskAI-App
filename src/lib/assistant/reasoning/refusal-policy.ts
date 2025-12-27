// src/lib/assistant/reasoning/refusal-policy.ts

/**
 * Refusal codes for deterministic safety enforcement
 */
export enum RefusalCode {
  // Coverage-based refusals
  NO_RULES_FOUND = "NO_RULES_FOUND",
  MISSING_REQUIRED_DIMENSION = "MISSING_REQUIRED_DIMENSION",

  // Content-based refusals
  GRAY_ZONE = "GRAY_ZONE",
  UNRESOLVED_CONFLICT = "UNRESOLVED_CONFLICT",

  // Capability-based refusals
  MISSING_STRATEGY_DATA = "MISSING_STRATEGY_DATA",
  UNSUPPORTED_JURISDICTION = "UNSUPPORTED_JURISDICTION",
  OUT_OF_SCOPE = "OUT_OF_SCOPE",

  // Temporal refusals
  FUTURE_LAW_UNCERTAIN = "FUTURE_LAW_UNCERTAIN",
}

/**
 * Next step types for guiding user action
 */
export interface NextStep {
  type: "CLARIFY" | "CONTACT_ADVISOR" | "TRY_DIFFERENT_QUESTION" | "PROVIDE_CONTEXT"
  prompt?: string
  promptHr?: string
  conceptId?: string
}

/**
 * Refusal template structure
 */
export interface RefusalTemplate {
  code: RefusalCode
  severity: "info" | "warning" | "critical"
  messageHr: string
  messageEn: string
  nextSteps: NextStep[]
  requiresHumanReview: boolean
}

/**
 * Context for the refusal
 */
export interface RefusalContext {
  missingDimensions?: string[]
  conflictingRules?: string[]
  grayZoneTopic?: string
  jurisdiction?: string
}

/**
 * Full refusal payload
 */
export interface RefusalPayload {
  template: RefusalTemplate
  context?: RefusalContext
}

/**
 * Refusal templates registry
 */
const REFUSAL_TEMPLATES: Record<RefusalCode, RefusalTemplate> = {
  [RefusalCode.NO_RULES_FOUND]: {
    code: RefusalCode.NO_RULES_FOUND,
    severity: "info",
    messageHr: "Nisam pronašao pravila koja se odnose na vaše pitanje.",
    messageEn: "I couldn't find rules that apply to your question.",
    nextSteps: [
      {
        type: "TRY_DIFFERENT_QUESTION",
        promptHr: "Pokušajte preformulirati pitanje",
        prompt: "Try rephrasing your question",
      },
      {
        type: "CONTACT_ADVISOR",
        promptHr: "Kontaktirajte poreznog savjetnika",
        prompt: "Contact a tax advisor",
      },
    ],
    requiresHumanReview: false,
  },

  [RefusalCode.MISSING_REQUIRED_DIMENSION]: {
    code: RefusalCode.MISSING_REQUIRED_DIMENSION,
    severity: "warning",
    messageHr: "Trebam više informacija da bih mogao odgovoriti.",
    messageEn: "I need more information to answer your question.",
    nextSteps: [
      {
        type: "PROVIDE_CONTEXT",
        promptHr: "Molim navedite dodatne detalje",
        prompt: "Please provide additional details",
      },
      {
        type: "CLARIFY",
        promptHr: "Pojasnite vaš upit",
        prompt: "Clarify your query",
      },
    ],
    requiresHumanReview: false,
  },

  [RefusalCode.GRAY_ZONE]: {
    code: RefusalCode.GRAY_ZONE,
    severity: "warning",
    messageHr: "Ovo pitanje spada u sivu zonu regulacije gdje nema jasnog odgovora.",
    messageEn: "This question falls into a regulatory gray zone with no clear answer.",
    nextSteps: [
      {
        type: "CONTACT_ADVISOR",
        promptHr: "Preporučujem konzultaciju s poreznim savjetnikom",
        prompt: "I recommend consulting a tax advisor",
      },
    ],
    requiresHumanReview: true,
  },

  [RefusalCode.UNRESOLVED_CONFLICT]: {
    code: RefusalCode.UNRESOLVED_CONFLICT,
    severity: "critical",
    messageHr: "Pronašao sam proturječna pravila i ne mogu dati siguran odgovor.",
    messageEn: "I found conflicting rules and cannot give a definitive answer.",
    nextSteps: [
      {
        type: "CONTACT_ADVISOR",
        promptHr: "Potrebna je stručna procjena",
        prompt: "Expert assessment needed",
      },
    ],
    requiresHumanReview: true,
  },

  [RefusalCode.MISSING_STRATEGY_DATA]: {
    code: RefusalCode.MISSING_STRATEGY_DATA,
    severity: "info",
    messageHr: "Nemam dovoljno podataka za strateški savjet.",
    messageEn: "I don't have enough data for strategic advice.",
    nextSteps: [
      {
        type: "PROVIDE_CONTEXT",
        promptHr: "Navedite više detalja o vašoj situaciji",
        prompt: "Provide more details about your situation",
      },
    ],
    requiresHumanReview: false,
  },

  [RefusalCode.UNSUPPORTED_JURISDICTION]: {
    code: RefusalCode.UNSUPPORTED_JURISDICTION,
    severity: "info",
    messageHr: "Trenutno podržavam samo hrvatsku regulativu.",
    messageEn: "I currently only support Croatian regulations.",
    nextSteps: [
      {
        type: "TRY_DIFFERENT_QUESTION",
        promptHr: "Pitanje vezano uz Hrvatsku",
        prompt: "Ask about Croatian regulations",
      },
    ],
    requiresHumanReview: false,
  },

  [RefusalCode.OUT_OF_SCOPE]: {
    code: RefusalCode.OUT_OF_SCOPE,
    severity: "info",
    messageHr: "Ovo pitanje nije u mom području stručnosti.",
    messageEn: "This question is outside my area of expertise.",
    nextSteps: [
      {
        type: "TRY_DIFFERENT_QUESTION",
        promptHr: "Pitajte o porezima, računovodstvu ili poslovanju",
        prompt: "Ask about taxes, accounting, or business",
      },
    ],
    requiresHumanReview: false,
  },

  [RefusalCode.FUTURE_LAW_UNCERTAIN]: {
    code: RefusalCode.FUTURE_LAW_UNCERTAIN,
    severity: "warning",
    messageHr: "Buduća pravila još nisu definitivna.",
    messageEn: "Future rules are not yet definitive.",
    nextSteps: [
      {
        type: "CLARIFY",
        promptHr: "Pitajte o trenutno važećim pravilima",
        prompt: "Ask about currently applicable rules",
      },
    ],
    requiresHumanReview: false,
  },
}

/**
 * Get refusal template by code
 */
export function getRefusalTemplate(code: RefusalCode): RefusalTemplate {
  return REFUSAL_TEMPLATES[code]
}

/**
 * Build complete refusal payload
 */
export function buildRefusalPayload(code: RefusalCode, context?: RefusalContext): RefusalPayload {
  return {
    template: getRefusalTemplate(code),
    context,
  }
}

/**
 * Determine refusal code based on decision coverage result
 */
export function determineRefusalCode(
  requiredScore: number,
  hasRules: boolean,
  hasConflicts: boolean,
  isGrayZone: boolean
): RefusalCode | null {
  // Decision tree from design doc
  if (requiredScore < 1) {
    return RefusalCode.MISSING_REQUIRED_DIMENSION
  }

  if (!hasRules) {
    return RefusalCode.NO_RULES_FOUND
  }

  if (hasConflicts) {
    return RefusalCode.UNRESOLVED_CONFLICT
  }

  if (isGrayZone) {
    return RefusalCode.GRAY_ZONE
  }

  // No refusal needed
  return null
}
