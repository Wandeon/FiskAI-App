// src/lib/regulatory-truth/retrieval/query-router.ts
import { runAgent } from "../agents/runner"
import {
  QueryClassificationSchema,
  type QueryClassification,
  type QueryIntent,
} from "../schemas/query-intent"
import { z } from "zod"

// Engines
import { runLogicEngine } from "./logic-engine"
import { runProcessEngine } from "./process-engine"
import { runReferenceEngine } from "./reference-engine"
import { runAssetEngine } from "./asset-engine"
import { runTemporalEngine } from "./temporal-engine"
import { runStrategyEngine } from "./strategy-engine"

const RouterInputSchema = z.object({
  query: z.string(),
  context: z
    .object({
      userId: z.string().optional(),
      companyType: z.string().optional(),
      isVatPayer: z.boolean().optional(),
    })
    .optional(),
})

type RouterInput = z.infer<typeof RouterInputSchema>

export interface RouterResult {
  success: boolean
  classification: QueryClassification | null
  response: unknown
  error: string | null
}

/**
 * Pattern-based intent detection (fast, no LLM)
 */
export function detectIntentFromPatterns(query: string): QueryIntent | null {
  const lowerQuery = query.toLowerCase()

  // PROCESS patterns
  const processPatterns = [
    /kako\s+(da|mogu|se)/,
    /koraci\s+za/,
    /postupak/,
    /registracija/,
    /prijava\s+za/,
    /what are the steps/i,
    /how do i/i,
    /how to/i,
  ]
  if (processPatterns.some((p) => p.test(lowerQuery))) {
    return "PROCESS"
  }

  // REFERENCE patterns
  const referencePatterns = [
    /iban\s+(za|račun)/,
    /koji\s+je\s+iban/,
    /uplatni\s+račun/,
    /šifra\s+za/,
    /cn\s+kod/,
    /what is the iban/i,
    /account number/i,
  ]
  if (referencePatterns.some((p) => p.test(lowerQuery))) {
    return "REFERENCE"
  }

  // DOCUMENT patterns
  const documentPatterns = [
    /obrazac/,
    /formular/,
    /download/,
    /preuzmi/,
    /gdje\s+(je|mogu|mogu naći)/,
    /pdv-[a-z]/i,
    /joppd/i,
    /where can i find/i,
    /form\s+for/i,
  ]
  if (documentPatterns.some((p) => p.test(lowerQuery))) {
    return "DOCUMENT"
  }

  // TEMPORAL patterns
  const temporalPatterns = [
    /prijelazn[ae]/,
    /stara\s+stopa/,
    /nova\s+stopa/,
    /od\s+\d{1,2}\.\s*\d{1,2}\.\s*\d{4}/,
    /prije\s+\d{1,2}\./,
    /poslije\s+\d{1,2}\./,
    /račun\s+iz\s+\w+\s*,?\s*isporuka/,
    /old vs new/i,
    /transitional/i,
  ]
  if (temporalPatterns.some((p) => p.test(lowerQuery))) {
    return "TEMPORAL"
  }

  // STRATEGY patterns (comparison/decision queries)
  const strategyPatterns = [
    /trebam\s+li/,
    /sto\s+je\s+bolje/,
    /koji\s+je\s+bolji/,
    /should\s+i/i,
    /\bvs\.?\b/,
    /odabrati/,
  ]
  if (strategyPatterns.some((p) => p.test(lowerQuery))) {
    return "STRATEGY"
  }

  // LOGIC patterns (most common, check last)
  const logicPatterns = [
    /moram\s+li/,
    /koliko\s+iznosi/,
    /koja\s+je\s+stopa/,
    /prag\s+za/,
    /ako\s+prodajem/,
    /do i have to/i,
    /what is the rate/i,
    /threshold/i,
    /am i required/i,
  ]
  if (logicPatterns.some((p) => p.test(lowerQuery))) {
    return "LOGIC"
  }

  return null
}

/**
 * Get engine name for intent
 */
function getEngineForIntent(intent: QueryIntent): string {
  const engineMap: Record<QueryIntent, string> = {
    LOGIC: "logic-engine",
    PROCESS: "process-engine",
    REFERENCE: "reference-engine",
    DOCUMENT: "asset-engine",
    TEMPORAL: "temporal-engine",
    STRATEGY: "strategy-engine",
    GENERAL: "logic-engine",
  }
  return engineMap[intent]
}

/**
 * Classify query intent using LLM
 */
export async function classifyQueryIntent(query: string): Promise<QueryClassification> {
  // Try pattern-based detection first
  const patternIntent = detectIntentFromPatterns(query)

  if (patternIntent) {
    return {
      intent: patternIntent,
      confidence: 0.85,
      extractedEntities: {
        subjects: [],
        conditions: [],
        products: [],
        locations: [],
        dates: [],
        formCodes: [],
      },
      suggestedEngines: [getEngineForIntent(patternIntent)],
      reasoning: `Pattern-based detection: ${patternIntent}`,
    }
  }

  // Fall back to LLM classification
  const input: RouterInput = { query }

  const result = await runAgent<RouterInput, QueryClassification>({
    agentType: "QUERY_CLASSIFIER",
    input,
    inputSchema: RouterInputSchema,
    outputSchema: QueryClassificationSchema,
    temperature: 0.1,
  })

  if (!result.success || !result.output) {
    // Default to GENERAL if classification fails
    return {
      intent: "GENERAL",
      confidence: 0.5,
      extractedEntities: {
        subjects: [],
        conditions: [],
        products: [],
        locations: [],
        dates: [],
        formCodes: [],
      },
      suggestedEngines: ["logic-engine"],
      reasoning: "Classification failed, defaulting to GENERAL",
    }
  }

  return result.output
}

/**
 * Route query to appropriate engine based on intent
 */
export async function routeQuery(
  query: string,
  context?: RouterInput["context"]
): Promise<RouterResult> {
  // Step 1: Classify intent
  const classification = await classifyQueryIntent(query)
  console.log(`[router] Intent: ${classification.intent} (${classification.confidence})`)

  // Step 2: Route to appropriate engine
  try {
    let response: unknown

    switch (classification.intent) {
      case "LOGIC":
        response = await runLogicEngine(query, classification.extractedEntities)
        break

      case "PROCESS":
        response = await runProcessEngine(query, classification.extractedEntities)
        break

      case "REFERENCE":
        response = await runReferenceEngine(query, classification.extractedEntities)
        break

      case "DOCUMENT":
        response = await runAssetEngine(query, classification.extractedEntities)
        break

      case "TEMPORAL":
        response = await runTemporalEngine(query, classification.extractedEntities)
        break

      case "STRATEGY":
        response = await runStrategyEngine(query, classification.extractedEntities)
        break

      case "GENERAL":
      default:
        response = await runLogicEngine(query, classification.extractedEntities)
        break
    }

    return {
      success: true,
      classification,
      response,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
      classification,
      response: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
