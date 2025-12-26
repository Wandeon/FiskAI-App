// src/lib/assistant/reasoning/stages/source-discovery.ts
import type { EventFactory } from "../event-factory"
import type { ReasoningEvent, SourcesPayload, SourceSummary } from "../types"
import { matchConcepts, type ConceptMatch } from "@/lib/assistant/query-engine/concept-matcher"

export interface SourceDiscoveryResult {
  sources: SourceSummary[]
  conceptMatches: ConceptMatch[]
}

export async function* sourceDiscoveryStage(
  factory: EventFactory,
  keywords: string[]
): AsyncGenerator<ReasoningEvent, SourceDiscoveryResult> {
  // Emit started
  yield factory.emit({
    stage: "SOURCES",
    status: "started",
    message: "Searching authoritative sources...",
  })

  // Match concepts (uses existing concept matcher)
  const conceptMatches = await matchConcepts(keywords)

  const sources: SourceSummary[] = []

  // Emit progress for each concept found
  for (const match of conceptMatches) {
    const source: SourceSummary = {
      id: match.conceptId,
      name: match.nameHr,
      authority: "LAW", // Default, would be determined from actual source
    }
    sources.push(source)

    yield factory.emit({
      stage: "SOURCES",
      status: "progress",
      message: `Found: ${match.nameHr}`,
      data: { source } as unknown as SourcesPayload,
    })
  }

  // Emit complete
  const payload: SourcesPayload = {
    summary: `Found ${sources.length} source${sources.length !== 1 ? "s" : ""}`,
    sources,
  }

  yield factory.emit({
    stage: "SOURCES",
    status: "complete",
    data: payload,
  })

  return {
    sources,
    conceptMatches,
  }
}
