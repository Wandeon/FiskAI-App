# FiskAI Regulatory Intelligence Platform — Spec Compliance Audit (v1.0)

**Audit date:** 2025-12-26  
**Spec version:** FiskAI Regulatory Intelligence Platform v1.0 (provided in prompt)  
**Audit scope:** Regulatory ingestion, reasoning engine, and Visible Reasoning UX (end-to-end)  
**Repository audited:** `FiskAI/` (Next.js + PostgreSQL + Prisma + worker pipeline)

---

## 0) Executive Summary (What You Have vs. The Spec)

### Overall verdict

FiskAI already contains strong foundations for the spec’s philosophy (“never pretend”) and several non-negotiable safety invariants (fail-closed behavior, evidence-backed citations, conflict escalation). The primary divergences from the spec are:

1. **The “8-layer brain” requirement is not complete**: you have implemented **7 knowledge shapes** in the database schema, but **Layer 8 (Comparison Matrix) is missing**, and the 7 shapes are not yet wired into the end-user assistant router.
2. **The spec’s 3-pass ingestion contract is not implemented as defined**, especially **Pass 1 EvidenceBlocks segmentation** (stable paragraph/table/list blocks with immutable hashes).
3. **The Decision Coverage Safety Engine is not implemented**: you do not compute topic-specific required dimensions → coverage score → outcome (`ANSWER` vs branching `CONDITIONAL_ANSWER` vs `REFUSAL`).
4. **Visible Reasoning UX is implemented as an architecture scaffold**, but key semantics are placeholders (especially “source discovery”, applicability exclusions, interactive counterfactual toggles, and the mandatory pre-answer pause).

### What is already strong (high alignment)

- **Immutable evidence + provenance discipline**: evidence content is hashed, treated as immutable, and rules are linked back to evidence via pointers. See `FiskAI/docs/01_ARCHITECTURE/trust-guarantees.md` and `FiskAI/prisma/schema.prisma` (`Evidence`, `EvidenceArtifact`, `SourcePointer`, `RegulatoryRule`).
- **Operational regulatory pipeline exists** (Sentinel → OCR → Extractor → Composer → Reviewer → Arbiter → Releaser). See `FiskAI/docs/05_REGULATORY/PIPELINE.md` and `FiskAI/src/lib/regulatory-truth/workers/*`.
- **Answer-time citation enforcement is real**: legacy assistant validates citations, and the streaming route fail-closes before emitting content. See `FiskAI/src/lib/assistant/validation.ts` and `FiskAI/src/app/api/assistant/chat/stream/route.ts`.
- **Visible Reasoning architecture exists**: generator + sinks pattern, SSE event stream, UI stepper, and persisted reasoning traces (`ReasoningTrace`). See `FiskAI/src/lib/assistant/reasoning/*` and `FiskAI/src/app/api/assistant/chat/reasoning/route.ts`.

### Critical gaps (spec blockers)

- **Layer 8: Comparison Matrix**: no structured data model and no assistant routing for strategy comparisons (e.g., Paušalni vs d.o.o.).
- **EvidenceBlocks segmentation**: no stable block-level model and no pipeline stage that produces immutable segmented blocks with hashes.
- **Decision Coverage**: no per-topic “required dimensions” model, no coverage score, and no `CONDITIONAL_ANSWER` branching.
- **Intent router across LOGIC / WORKFLOW / REFERENCE / STRATEGY**: assistant retrieval currently targets `RegulatoryRule` only.
- **Visible Reasoning stage truthfulness**: “source discovery” currently streams concept matches as “sources” and defaults authority to LAW, which risks becoming “theatrical reasoning” (explicitly prohibited by the spec).
- **Interactive counterfactual toggles**: not implemented; the UI can display exclusions but the pipeline currently emits none.
- **Mandatory 600–1000ms pause before final answer**: not implemented in the reasoning pipeline or SSE sink.

---

## 1) Audit Methodology (What Was Inspected)

### Code & configuration reviewed

- DB schema: `FiskAI/prisma/schema.prisma`
- Regulatory pipeline docs: `FiskAI/docs/05_REGULATORY/OVERVIEW.md`, `FiskAI/docs/05_REGULATORY/PIPELINE.md`
- Regulatory workers: `FiskAI/src/lib/regulatory-truth/workers/*`
- Regulatory agents/extractors: `FiskAI/src/lib/regulatory-truth/agents/*`
- Assistant legacy (fail-closed answers): `FiskAI/src/lib/assistant/query-engine/*`, `FiskAI/src/lib/assistant/validation.ts`, `FiskAI/src/app/api/assistant/chat/stream/route.ts`
- Visible Reasoning pipeline + sinks + types: `FiskAI/src/lib/assistant/reasoning/*`
- Visible Reasoning API + UI: `FiskAI/src/app/api/assistant/chat/reasoning/route.ts`, `FiskAI/src/components/assistant-v2/reasoning/*`
- Feature flags for reasoning rollout: `FiskAI/src/lib/assistant/reasoning/feature-flags.ts`, `FiskAI/.env.example`
- Design specs present in repo (for “planned vs implemented” comparisons):
  - `FiskAI/docs/plans/2025-12-26-visible-reasoning-ux-design.md`
  - `FiskAI/docs/plans/2025-12-26-knowledge-shapes-design.md`

### What was not done (to avoid speculation)

- No production DB content inspection (counts/coverage) was performed.
- No secrets were inspected; `.env` values were not included. Only `FiskAI/.env.example` was referenced.

---

## 2) Spec Compliance Scoreboard (High Level)

Legend:

- **IMPLEMENTED** = exists and is wired end-to-end
- **PARTIAL** = exists but incomplete, not wired, or semantics differ materially
- **MISSING** = not present

| Spec Area                                                                                             | Status  | Notes                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| “Never pretend” philosophy (explicit knowns/unknowns)                                                 | PARTIAL | Strong fail-closed + citation enforcement exists; missing-context transparency and conditional branching are not implemented as spec’d. |
| 8-layer data architecture (all ingested content maps to 8 schemas)                                    | PARTIAL | 7 shapes exist in schema; Comparison Matrix missing; ingestion still primarily produces `SourcePointer` + `RegulatoryRule`.             |
| Ingestion pipeline (3 passes; EvidenceBlocks; classifier; taxonomy/linkage)                           | PARTIAL | Operational pipeline exists; EvidenceBlocks segmentation missing; taxonomy/linkage not integrated into assistant retrieval.             |
| Reasoning engine (“Router” + Decision Coverage + outcomes)                                            | PARTIAL | Intent classification exists, but Decision Coverage + conditional answers + multi-shape routing are missing.                            |
| Visible Reasoning UX (7 stages, real source streaming, applicability filters, pause, counterfactuals) | PARTIAL | Generator+sinks+SSE+UI stepper exist; key stages are placeholders; pause/counterfactuals missing.                                       |
| Safety & boundaries (“Red Line”)                                                                      | PARTIAL | Citation enforcement and conflict refusal exist; gray-zone handling and strategy gating not implemented as spec’d.                      |

---

## 3) Data Architecture (“8-Layer Brain”) — Current State vs Spec

### Spec requirement

> “The system is not built on documents. Every piece of content ingested must map to one of these schemas (Layers 1–8).”

### What exists in FiskAI today (models)

Your regulatory layer currently uses:

- `Evidence` + `EvidenceArtifact` (immutable capture + derived artifacts)
- `SourcePointer` (legacy flat extraction)
- `RegulatoryRule` (composed rule with `appliesWhen` DSL, risk tiers, effective dates, citations)
- `GraphEdge` + `RegulatoryConflict` (edges + conflict workflow)
- **Knowledge shapes (new, in schema):**
  - `AtomicClaim` + `ClaimException`
  - `ConceptNode` (taxonomy)
  - `RegulatoryProcess` + `ProcessStep` (workflow)
  - `ReferenceTable` + `ReferenceEntry` (lookups)
  - `RegulatoryAsset` (documents)
  - `TransitionalProvision` (temporal bridges)

All are defined in `FiskAI/prisma/schema.prisma`.

### Layer-by-layer mapping

| Spec Layer | Spec Model                       | Current Model(s)                           | Status  | Evidence / Notes                                                                                                                                                                                                                                                                                                                                              |
| ---------- | -------------------------------- | ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1          | Atomic Rule                      | `AtomicClaim` (shape) and `RegulatoryRule` | PARTIAL | Schema exists (`AtomicClaim`). Extraction exists (`FiskAI/src/lib/regulatory-truth/agents/claim-extractor.ts`). Production workers still run legacy `Extractor` → `SourcePointer` (`FiskAI/src/lib/regulatory-truth/workers/extractor.worker.ts`). Assistant retrieval uses `RegulatoryRule` only (`FiskAI/src/lib/assistant/query-engine/rule-selector.ts`). |
| 2          | Concept (Taxonomy)               | `Concept` (legacy) + `ConceptNode` (new)   | PARTIAL | `ConceptNode` supports synonyms/hypernyms; traversal utilities exist (`FiskAI/src/lib/regulatory-truth/taxonomy/concept-graph.ts`). Assistant uses legacy `Concept` token matcher (`FiskAI/src/lib/assistant/query-engine/concept-matcher.ts`).                                                                                                               |
| 3          | Graph Edge (Precedence/Conflict) | `GraphEdge` + `RegulatoryConflict`         | PARTIAL | Conflict workflow exists; `GraphEdgeType` includes `OVERRIDES` but current graph builder creates `SUPERSEDES` and `DEPENDS_ON` (`FiskAI/src/lib/regulatory-truth/graph/knowledge-graph.ts`). No override edge generation/usage at query-time.                                                                                                                 |
| 4          | Process (Workflow)               | `RegulatoryProcess` + `ProcessStep`        | PARTIAL | Schema exists; extractor exists (`FiskAI/src/lib/regulatory-truth/agents/process-extractor.ts`). Not routed to by assistant.                                                                                                                                                                                                                                  |
| 5          | Reference Table                  | `ReferenceTable` + `ReferenceEntry`        | PARTIAL | Schema exists; extractor exists (`FiskAI/src/lib/regulatory-truth/agents/reference-extractor.ts`). Not routed to by assistant.                                                                                                                                                                                                                                |
| 6          | Asset (Document)                 | `RegulatoryAsset`                          | PARTIAL | Schema exists; extractor exists (`FiskAI/src/lib/regulatory-truth/agents/asset-extractor.ts`). Not routed to by assistant.                                                                                                                                                                                                                                    |
| 7          | Transition Rule                  | `TransitionalProvision`                    | PARTIAL | Schema exists; extractor exists (`FiskAI/src/lib/regulatory-truth/agents/transitional-extractor.ts`). Not routed to by assistant.                                                                                                                                                                                                                             |
| 8          | Comparison Matrix                | (none)                                     | MISSING | No structured model. Some human-readable comparison content exists in `FiskAI/content/usporedbe/*.mdx`, but that is not a structured strategic matrix usable by a deterministic router.                                                                                                                                                                       |

### Technical requirement checks

**Graph support for Layers 1–3**

- Postgres 16 is deployed (`FiskAI/docker-compose.yml`).
- `GraphEdge` provides an explicit edge table; recursive traversal is feasible.
- Precedence (`OVERRIDES`) is not yet applied at retrieval-time.

**JSON/Document storage for Layers 4–8**

- Postgres JSON is used for extensibility (e.g., `AtomicClaim.parameters`, `RegulatoryProcess.prerequisites`).
- Layer 8 is missing.

**Vector store used only for semantic entry points**

- pgvector exists in the project via Drizzle custom vector type (`FiskAI/src/lib/db/drizzle/schema/embeddings.ts`), but not used in the regulatory-truth assistant router.
- The assistant’s answer-time logic does not depend on vectors (good alignment with the “never authoritative” requirement), but the spec expects vectors as entry points.

---

## 4) Ingestion Pipeline (“The Feeder”) — Spec vs Current Pipeline

### Spec ingestion contract (required)

1. **Pass 1: Structural segmentation**: HTML/PDF → stable blocks → immutable `EvidenceBlocks` with hashes
2. **Pass 2: 8-model extraction classifier**: route each block to the correct extractor (rules/workflows/tables/assets/transitions/matrix)
3. **Pass 3: taxonomy & linkage**: link to taxonomy, map colloquial terms, identify override edges (lex specialis)

### Current FiskAI operational pipeline (implemented)

Discovery → OCR → Extraction → Composition → Review → Arbiter → Release  
Documented in `FiskAI/docs/05_REGULATORY/PIPELINE.md` and implemented in `FiskAI/src/lib/regulatory-truth/workers/*`.

Key implementation points:

- OCR preprocessing and artifact selection: `FiskAI/src/lib/regulatory-truth/utils/content-provider.ts` (used by workers) and OCR worker `FiskAI/src/lib/regulatory-truth/workers/ocr.worker.ts`.
- Extraction (legacy, flat facts): `FiskAI/src/lib/regulatory-truth/agents/extractor.ts` (creates `SourcePointer`).
- Composition into rules: `FiskAI/src/lib/regulatory-truth/agents/composer.ts` (creates `RegulatoryRule` + links pointers; validates explanation against quotes).
- Conflict resolution workflow: `FiskAI/src/lib/regulatory-truth/agents/arbiter.ts`.

### Pass-by-pass gap analysis

#### Pass 1: Structural segmentation (EvidenceBlocks)

**Status: MISSING (as spec defines it)**

What exists instead:

- Whole-document immutability: `Evidence.contentHash`, `Evidence.rawContent`, `EvidenceArtifact.contentHash`.
- Content cleaning utilities (`FiskAI/src/lib/regulatory-truth/utils/content-cleaner.ts`).

What is missing relative to the spec:

- A first-class `EvidenceBlock` model that captures stable blocks (paragraphs/tables/lists), each with its own hash and provenance.
- A deterministic segmentation stage that emits blocks prior to classification/extraction.

Operational impact:

- Mixed documents cannot be reliably routed at sub-document granularity.
- Provenance is coarser than the spec expects (document/artifact-level rather than block-level).
- Harder to implement “stream sources as found” with precise block pointers.

#### Pass 2: 8-model extraction classifier and routing

**Status: PARTIAL**

What exists (new work, not yet wired into worker pipeline):

- Content classifier: `FiskAI/src/lib/regulatory-truth/agents/content-classifier.ts`
- Multi-shape extractor runner: `FiskAI/src/lib/regulatory-truth/agents/multi-shape-extractor.ts`
- Shape extractors: claim/process/reference/asset/transitional (`FiskAI/src/lib/regulatory-truth/agents/*-extractor.ts`)

What is missing operationally:

- Worker orchestration still calls **legacy** extractor:
  - `FiskAI/src/lib/regulatory-truth/workers/extractor.worker.ts` runs `runExtractor()` which produces `SourcePointer` records only.
- No coverage gate ensures each evidence item is classified and mapped into the shape models.

Constraint: “Discard generic marketing fluff; store only structured data.”

- You have navigation/noise cleaning (`content-cleaner.ts`) but no explicit “fluff rejection” gate as a pipeline invariant.

#### Pass 3: taxonomy & linkage

**Status: PARTIAL**

What exists:

- `ConceptNode` schema supports synonyms/hypernyms.
- Query utilities exist (`FiskAI/src/lib/regulatory-truth/taxonomy/concept-graph.ts`).

What is missing:

- Assistant retrieval and visible reasoning do not surface taxonomy mapping events (“juice” → legal category).
- No override-edge (`OVERRIDES`) creation/usage in conflict resolution or retrieval.

---

## 5) Reasoning Engine (“The Router”) — Spec vs Current Implementation

### Spec requirements

1. Intent classification: `LOGIC`, `WORKFLOW`, `REFERENCE`, `STRATEGY`
2. Decision Coverage calculation: required dimensions, resolved dimensions, coverage score
3. Outcomes:
   - Coverage = 100% → `ANSWER`
   - Coverage > 50% with critical ambiguity → `CONDITIONAL_ANSWER` (branching)
   - Coverage < 50% or strategic data missing → `REFUSAL` (specific reason)

### Current assistant architecture in FiskAI

You have two assistant paths today:

1. **Legacy fail-closed answer builder** (non-visible reasoning)
   - `FiskAI/src/lib/assistant/query-engine/answer-builder.ts`
   - Deterministic concept matching (`concept-matcher.ts`) + deterministic rule selection (`rule-selector.ts` + `appliesWhen` DSL).
   - Strong refusal logic (nonsense detection, low confidence, unsupported jurisdictions, missing citations).

2. **Visible Reasoning pipeline** (generator + sinks + SSE + UI)
   - Pipeline: `FiskAI/src/lib/assistant/reasoning/pipeline.ts`
   - SSE endpoint: `FiskAI/src/app/api/assistant/chat/reasoning/route.ts`
   - UI: `FiskAI/src/components/assistant-v2/reasoning/*`
   - Audit persistence: `ReasoningTrace` in `FiskAI/prisma/schema.prisma`

Reasoning UX rollout flags exist in `FiskAI/.env.example` and `FiskAI/src/lib/assistant/reasoning/feature-flags.ts` (`REASONING_MODE=off|shadow|live`).

### Intent classification

**Status: PARTIAL**

- `interpretQuery()` provides intents like `EXPLAIN`, `CALCULATE`, `DEADLINE`, `PROCEDURE`, etc. (`FiskAI/src/lib/assistant/query-engine/query-interpreter.ts`).
- Visible Reasoning `contextResolutionStage()` maps these into `QUESTION | HOWTO | CHECKLIST` (`FiskAI/src/lib/assistant/reasoning/stages/context-resolution.ts`).

Missing per spec:

- A router that selects _which knowledge shape(s)_ to retrieve based on intent:
  - no workflow retrieval from `RegulatoryProcess`
  - no lookup retrieval from `ReferenceTable`
  - no asset retrieval from `RegulatoryAsset`
  - no temporal bridging from `TransitionalProvision`
  - no strategy retrieval from a Comparison Matrix (missing entirely)

### Decision Coverage calculator (spec-defined)

**Status: MISSING**

Closest existing mechanisms:

- **Interpretation confidence thresholds** (clarify if confidence < 0.6; stricter retrieval if < 0.75). See `FiskAI/src/lib/assistant/query-engine/query-interpreter.ts`.
- **Rule eligibility gating** via `appliesWhen` DSL required fields and missing-context detection (`FiskAI/src/lib/assistant/query-engine/rule-eligibility.ts`).

Key difference vs spec:

- The spec requires a **topic-aware “required dimensions” model** (e.g., VAT rate needs Item, ServiceContext, Date, Place) producing a coverage score used for branching answers.
- Current system does not compute “required dimensions”, does not compute coverage score, and does not emit conditional branches.

### Terminal outcomes

**Status: PARTIAL**

- Legacy assistant returns `ANSWER` or `REFUSAL` with explicit reasons (`FiskAI/src/lib/assistant/query-engine/answer-builder.ts`).
- Visible Reasoning defines terminals `ANSWER`, `QUALIFIED_ANSWER`, `REFUSAL`, `ERROR` (`FiskAI/src/lib/assistant/reasoning/types.ts`).

Missing per spec:

- `CONDITIONAL_ANSWER` terminal outcome with branching logic and a dedicated UX card.

### Determinism (“LLM not used for logic”)

**Status: PARTIAL**

Aligned:

- Answer-time selection is deterministic (token match + eligibility checks).
- `appliesWhen` is evaluated deterministically (`FiskAI/src/lib/regulatory-truth/dsl/applies-when.ts`).

Not aligned (yet):

- Rule explanations are LLM-composed during ingestion (`FiskAI/src/lib/regulatory-truth/agents/composer.ts`), though guarded by explanation validation (`FiskAI/src/lib/regulatory-truth/utils/explanation-validator.ts`).
- `rule-eligibility.ts` treats parse failures as “eligible” (fail-open) which weakens a strict fail-closed reading of the spec.

---

## 6) Visible Reasoning UX — Spec vs Current Implementation

### Spec requirements (must-haves)

- 7-stage epistemic streaming.
- “No magic”: never show an answer without showing the work.
- Stream real sources as discovered (not approximations).
- Applicability filters must be explicit and interactive (counterfactual toggles).
- A deliberate 600–1000ms pause before terminal answer.

### What exists today (implementation)

Core architecture exists:

- Generator + sinks pattern: `FiskAI/src/lib/assistant/reasoning/sinks/consumer.ts`
- SSE streaming: `FiskAI/src/app/api/assistant/chat/reasoning/route.ts`
- UI stepper and reasoning cards: `FiskAI/src/components/assistant-v2/reasoning/*`
- Audit persistence: `FiskAI/src/lib/assistant/reasoning/sinks/audit-sink.ts` → `ReasoningTrace` model

Stage-by-stage evaluation:

| Spec Stage                              | Current Stage(s)                 | Status          | Notes                                                                                                                                                                                    |
| --------------------------------------- | -------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Question intake                         | `CONTEXT_RESOLUTION` (started)   | PARTIAL         | Exists, but not separated as its own “buffered intake” stage; acceptable if semantics remain truthful.                                                                                   |
| Classification (domain + risk tier)     | `CONTEXT_RESOLUTION` (complete)  | PARTIAL         | Payload includes jurisdiction/domain/risk tier; UI does not prominently render risk tier beyond the summary string.                                                                      |
| Source discovery (stream sources found) | `SOURCES`                        | PARTIAL         | Streams concept matches as “sources” and sets authority to LAW by default (`FiskAI/src/lib/assistant/reasoning/stages/source-discovery.ts`). This is materially different from the spec. |
| Retrieval (show concepts matched)       | `RETRIEVAL`                      | PARTIAL         | Retrieves candidate rules by concept slug; no explicit taxonomy mapping events.                                                                                                          |
| Applicability (filters/exclusions)      | `APPLICABILITY`                  | MISSING/PARTIAL | Payload currently emits `exclusions: []` in pipeline; UI supports displaying exclusions but pipeline doesn’t generate them.                                                              |
| Analysis (stream checkpoints)           | `ANALYSIS`                       | PARTIAL         | Placeholder checkpoints (“Comparing sources...”) and a static bullet list; no override checking or coverage checkpoints.                                                                 |
| Confidence & answer (pause + final)     | `CONFIDENCE` + terminal `ANSWER` | PARTIAL         | Confidence exists; mandated pause is not implemented.                                                                                                                                    |

### Mandatory UX features not implemented

1. **Counterfactual toggles**
   - `ConfidencePayload` supports `interactiveDrivers`, but pipeline does not populate it and UI has no toggle actions wired. See `FiskAI/src/lib/assistant/reasoning/types.ts` and `FiskAI/src/lib/assistant/reasoning/client/useReasoningStream.ts`.
2. **Clarification gate is not functional**
   - Pipeline emits `CLARIFICATION` but does not await a response and continues without user input. See `FiskAI/src/lib/assistant/reasoning/pipeline.ts` and the placeholder `answerClarification()` client method.
3. **The Pause**
   - No delay is implemented in `FiskAI/src/lib/assistant/reasoning/pipeline.ts` or `FiskAI/src/lib/assistant/reasoning/sinks/sse-sink.ts`.
4. **“Never fake reasoning” risk**
   - “Source discovery” currently claims to find “authoritative sources” but actually enumerates concept matches; this is exactly the kind of “magic theater” the spec prohibits.

---

## 7) Safety & Boundaries (“Red Line”) — Spec vs Current Behavior

### Strong alignment

- **Citations are enforced for regulatory answers**:
  - Validation rules: `FiskAI/src/lib/assistant/validation.ts`
  - Fail-closed streaming route: `FiskAI/src/app/api/assistant/chat/stream/route.ts`
- **Conflicts can block answering**:
  - Assistant conflict refusal: `FiskAI/src/lib/assistant/query-engine/answer-builder.ts`
  - Arbiter conflict workflow: `FiskAI/src/lib/regulatory-truth/agents/arbiter.ts`
- **Ingestion-time explanation validation**:
  - Composer validates explanations against source quotes and falls back to quote-only explanations if validation fails: `FiskAI/src/lib/regulatory-truth/agents/composer.ts` + `FiskAI/src/lib/regulatory-truth/utils/explanation-validator.ts`

### Gaps vs spec

1. **Missing-context conditional answering**
   - Spec: conditional branching `CONDITIONAL_ANSWER` when partial coverage.
   - Current: refusal/clarification or silent exclusion of rules requiring missing context; no branching answer.
2. **Gray zone refusal mode**
   - Spec: explicit refusal when law does not define something and practice varies.
   - Current: no dedicated “gray zone” terminal reason/message.
3. **Strategy refusal mode**
   - Spec: refuse if comparison matrix missing.
   - Current: no structured strategy layer; no router to detect “missing matrix”.

### Evidence integrity note (leave-no-stone-unturned)

The system references a rejection type `QUOTE_NOT_IN_EVIDENCE` (e.g., in health gates `FiskAI/src/lib/regulatory-truth/utils/health-gates.ts`) but the legacy extractor’s deterministic validators primarily enforce “value appears in quote” (`FiskAI/src/lib/regulatory-truth/utils/deterministic-validators.ts`) rather than “quote exists verbatim in evidence”. If “quote-in-evidence” enforcement is a hard requirement, it is not obviously wired end-to-end.

---

## 8) Notable Engineering Mismatches / Debt (Spec-Relevant)

These are not spec requirements per se, but they affect the platform’s ability to meet the spec reliably.

1. **Legacy e2e assistant suite appears stale vs current schema**
   - `FiskAI/src/lib/regulatory-truth/e2e/assistant-suite.ts` queries `db.regulatoryRule` using fields like `domain`/`field`, which do not exist on the current `RegulatoryRule` model in `FiskAI/prisma/schema.prisma`. This suggests the suite is either outdated or not compiled/executed.
2. **Vector embedding column mismatch between Drizzle and Prisma**
   - Drizzle schema defines `SourceChunk.embedding` as a pgvector column (`FiskAI/src/lib/db/drizzle/schema/embeddings.ts`), but Prisma `SourceChunk` in `FiskAI/prisma/schema.prisma` does not include `embedding`. If the DB actually has this column, Prisma will not “see” it; if it does not, Drizzle operations will fail.
3. **Fail-open edge case in rule eligibility parsing**
   - `FiskAI/src/lib/assistant/query-engine/rule-eligibility.ts` treats invalid `appliesWhen` predicates as “eligible” (it logs a warning and returns eligible). This is in tension with strict fail-closed semantics and with the spec’s “never pretend” philosophy.
4. **Visible Reasoning “surface” handling**
   - `contextResolutionStage()` calls `interpretQuery(query, "APP")` regardless of actual surface (`FiskAI/src/lib/assistant/reasoning/stages/context-resolution.ts`). This can skew intent/risk classification for `MARKETING` vs `APP` contexts.

---

## 9) Readiness vs Spec “V1 Complete”

Spec definition:

> “Answer 90% of 50 real-world stress test questions correctly—verified answer, correct workflow, or correct conditional path—without a single hallucination on statutory facts.”

Current readiness:

- **No-hallucination on statutory facts:** trending toward “strong”, but full quote-in-evidence enforcement is not clearly present in the legacy extractor path.
- **Coverage of workflows, lookups, temporal bridges, strategy:** not met; the assistant does not route to those layers.
- **Stress test readiness:** not met; there is no integrated 50-question suite covering the router behaviors and the Visible Reasoning UX.

---

## 10) Spec-Driven Remediation Plan (Minimum to Close the Gaps)

### P0 (must-do to claim compliance with the blueprint)

1. **Implement Pass 1 EvidenceBlocks**
   - Add a stable segmentation model (`EvidenceBlock`) with block hashes and provenance.
   - Ensure segmentation is deterministic and re-runnable.
2. **Wire multi-shape extraction into workers**
   - Integrate `content-classifier` + `multi-shape-extractor` into the worker pipeline (replace or augment `extractor.worker.ts`).
   - Decide how legacy `SourcePointer` extraction coexists (compat vs deprecation).
3. **Implement the Decision Coverage Safety Engine**
   - Create a topic → required-dimensions map (start with VAT rates).
   - Compute coverage score from user context + defaults.
   - Add `CONDITIONAL_ANSWER` with branching payload and UX card.
4. **Implement real source discovery streaming**
   - Source discovery stage must stream actual sources searched/selected (Narodne novine, Porezna, FINA, etc.) with URLs and authority levels.
   - Remove “concepts-as-sources” semantics.
5. **Implement counterfactual toggles**
   - Applicability stage must produce rule-level exclusions with structured `expected/actual/source/userCanFix`.
   - Add a “re-run with modified assumptions” contract and UI interactions.
6. **Add Layer 8 (Comparison Matrix)**
   - Implement a structured strategy model.
   - Seed at least “Paušalni vs d.o.o.” and ensure the router can refuse on “missing matrix”.

### P1 (strongly recommended to preserve “never pretend”)

- Enforce “quote exists verbatim in evidence” checks in the ingestion path and surface metrics.
- Ensure Visible Reasoning stages reflect real work (avoid placeholder theater).
- Add the mandated 600–1000ms pause before the final answer.
- Add an explicit “gray zone” refusal mode (no explicit law; practice varies).

---

## 11) Appendix — Key File Map (Where Things Live)

**Regulatory ingestion + truth layer**

- Pipeline docs: `FiskAI/docs/05_REGULATORY/OVERVIEW.md`, `FiskAI/docs/05_REGULATORY/PIPELINE.md`
- Workers: `FiskAI/src/lib/regulatory-truth/workers/*`
- Agents: `FiskAI/src/lib/regulatory-truth/agents/*`
- Knowledge graph builder: `FiskAI/src/lib/regulatory-truth/graph/knowledge-graph.ts`
- DB schema: `FiskAI/prisma/schema.prisma`

**Assistant (legacy fail-closed)**

- Answer builder: `FiskAI/src/lib/assistant/query-engine/answer-builder.ts`
- Validation gate: `FiskAI/src/lib/assistant/validation.ts`
- Streaming API (NDJSON): `FiskAI/src/app/api/assistant/chat/stream/route.ts`

**Visible Reasoning UX**

- UX design spec: `FiskAI/docs/plans/2025-12-26-visible-reasoning-ux-design.md`
- Pipeline + stages + sinks: `FiskAI/src/lib/assistant/reasoning/*`
- SSE API: `FiskAI/src/app/api/assistant/chat/reasoning/route.ts`
- UI components: `FiskAI/src/components/assistant-v2/reasoning/*`
- Audit persistence: `ReasoningTrace` in `FiskAI/prisma/schema.prisma`

**Knowledge Shapes design**

- `FiskAI/docs/plans/2025-12-26-knowledge-shapes-design.md`
