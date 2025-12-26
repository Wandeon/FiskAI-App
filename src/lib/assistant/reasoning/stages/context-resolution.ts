// src/lib/assistant/reasoning/stages/context-resolution.ts
import type { EventFactory } from "../event-factory"
import type {
  ReasoningEvent,
  ContextResolutionPayload,
  UserContextSnapshot,
  RiskTier,
} from "../types"
import { interpretQuery } from "@/lib/assistant/query-engine/query-interpreter"

export interface ContextResolution extends ContextResolutionPayload {
  concepts: string[]
  suggestedClarifications?: string[]
}

const CONFIDENCE_THRESHOLD = 0.9

export async function* contextResolutionStage(
  factory: EventFactory,
  query: string,
  companyContext?: {
    vatStatus?: "registered" | "unregistered" | "unknown"
    turnoverBand?: string
    companySize?: "micro" | "small" | "medium" | "large"
    jurisdiction?: string
  }
): AsyncGenerator<ReasoningEvent, ContextResolution> {
  // Emit started
  yield factory.emit({
    stage: "CONTEXT_RESOLUTION",
    status: "started",
    message: "Analysing question...",
  })

  // Use existing query interpreter
  const interpretation = interpretQuery(query, "APP")

  // Build user context snapshot (frozen at request start)
  const userContextSnapshot: UserContextSnapshot = {
    vatStatus: companyContext?.vatStatus,
    turnoverBand: companyContext?.turnoverBand,
    companySize: companyContext?.companySize,
    jurisdiction: companyContext?.jurisdiction || "HR",
    assumedDefaults: [],
  }

  // Add assumed defaults
  if (!companyContext?.vatStatus) {
    userContextSnapshot.assumedDefaults.push("vatStatus: unknown")
  }
  if (!companyContext?.turnoverBand) {
    userContextSnapshot.assumedDefaults.push("turnoverBand: unknown")
  }

  // Compute risk tier based on topic and confidence
  const riskTier = computeRiskTier(interpretation.topic, interpretation.entities)

  const resolution: ContextResolution = {
    summary: `${mapJurisdiction(interpretation.jurisdiction)} · ${interpretation.topic} · ${riskTier}`,
    jurisdiction: mapJurisdiction(interpretation.jurisdiction),
    domain: mapDomain(interpretation.topic),
    riskTier,
    language: "hr",
    intent: mapIntent(interpretation.intent),
    asOfDate: new Date().toISOString().split("T")[0],
    entities: interpretation.entities.map((e) => ({
      type: "keyword",
      value: e,
      confidence: interpretation.confidence,
    })),
    confidence: interpretation.confidence,
    requiresClarification: interpretation.confidence < CONFIDENCE_THRESHOLD,
    userContextSnapshot,
    concepts: interpretation.entities,
    suggestedClarifications: interpretation.suggestedClarifications,
  }

  // Emit complete with data
  yield factory.emit({
    stage: "CONTEXT_RESOLUTION",
    status: "complete",
    data: resolution,
  })

  return resolution
}

function mapJurisdiction(jurisdiction: string): "HR" | "EU" | "UNKNOWN" {
  if (jurisdiction === "HR" || jurisdiction === "croatia") return "HR"
  if (jurisdiction === "EU" || jurisdiction === "european_union") return "EU"
  return "HR" // Default to HR for Croatian tax assistant
}

function mapDomain(topic: string): "TAX" | "LABOR" | "COMPANY" | "FINANCE" | "OTHER" {
  if (topic === "REGULATORY") return "TAX"
  return "OTHER"
}

function mapIntent(intent: string): "QUESTION" | "HOWTO" | "CHECKLIST" | "UNKNOWN" {
  switch (intent) {
    case "query":
    case "question":
    case "EXPLAIN":
    case "DEFINITION":
      return "QUESTION"
    case "howto":
    case "PROCEDURE":
      return "HOWTO"
    case "checklist":
    case "CHECKLIST":
      return "CHECKLIST"
    default:
      return "QUESTION"
  }
}

function computeRiskTier(topic: string, entities: string[]): RiskTier {
  // T0: Critical - legal deadlines, penalties
  const t0Keywords = ["kazna", "penali", "rok", "obveza", "sankcija"]
  if (entities.some((e) => t0Keywords.some((k) => e.toLowerCase().includes(k)))) {
    return "T0"
  }

  // T1: High - tax obligations, VAT, contributions
  const t1Keywords = [
    "pdv",
    "porez",
    "doprinos",
    "fiskalizacija",
    "obracun",
    "VAT_THRESHOLD",
    "PDV",
  ]
  if (entities.some((e) => t1Keywords.some((k) => e.toLowerCase().includes(k.toLowerCase())))) {
    return "T1"
  }

  // T2: Medium - thresholds, limits
  const t2Keywords = ["prag", "limit", "granica", "iznos"]
  if (entities.some((e) => t2Keywords.some((k) => e.toLowerCase().includes(k)))) {
    return "T2"
  }

  // T3: Low - informational
  return "T3"
}
