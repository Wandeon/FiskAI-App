// src/lib/regulatory-truth/retrieval/index.ts

// Query router
export {
  routeQuery,
  detectIntentFromPatterns,
  classifyQueryIntent,
  type RouterResult,
} from "./query-router"

// Engines
export { runLogicEngine, type LogicEngineResult } from "./logic-engine"
export { runProcessEngine, type ProcessEngineResult } from "./process-engine"
export { runReferenceEngine, type ReferenceEngineResult } from "./reference-engine"
export { runAssetEngine, type AssetEngineResult } from "./asset-engine"
export { runTemporalEngine, type TemporalEngineResult } from "./temporal-engine"
export {
  runStrategyEngine,
  detectStrategyIntent,
  extractDomainTags,
  type StrategyEngineResult,
} from "./strategy-engine"

// Taxonomy-aware query (from Phase 3)
export { executeQuery, findVatRate, type QueryResult } from "./taxonomy-aware-query"

// Schemas (re-export from schemas for convenience)
export {
  QueryIntentSchema,
  QueryClassificationSchema,
  type QueryIntent,
  type QueryClassification,
  type ExtractedEntities,
} from "../schemas/query-intent"
