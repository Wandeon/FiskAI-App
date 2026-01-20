// src/lib/regulatory-truth/services/hash-service.ts
// Determinism hashes for RTL2 publish telemetry

import { createHash } from "crypto"

/**
 * Computes SHA256 hash of a canonical JSON string.
 * Ensures deterministic output by sorting keys.
 */
function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex")
}

/**
 * Converts object to canonical JSON (sorted keys) for consistent hashing.
 */
function canonicalize(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort())
}

/**
 * Computes inputsHash for a rule.
 * This captures all inputs that affect rule composition:
 * - CandidateFact IDs (sorted for determinism)
 * - Evidence IDs referenced by those facts
 * - AgentRun IDs that created/modified the rule
 * - Any config that affects composition (future)
 *
 * Used to detect if a retry has the same inputs as a previous attempt.
 */
export function computeInputsHash(params: {
  candidateFactIds: string[]
  evidenceIds: string[]
  agentRunIds: string[]
  config?: Record<string, unknown>
}): string {
  const canonical = {
    candidateFactIds: [...params.candidateFactIds].sort(),
    evidenceIds: [...params.evidenceIds].sort(),
    agentRunIds: [...params.agentRunIds].sort(),
    config: params.config ?? {},
  }
  return sha256(canonicalize(canonical))
}

/**
 * Computes evidenceHash for a rule.
 * This is the SHA256 of all evidence.rawContent that backs the rule.
 *
 * Used to detect if evidence content has changed since last publish attempt.
 */
export function computeEvidenceHash(
  evidenceContents: Array<{
    id: string
    rawContent: string
  }>
): string {
  // Sort by ID for determinism
  const sorted = [...evidenceContents].sort((a, b) => a.id.localeCompare(b.id))
  const combined = sorted.map((e) => `${e.id}:${e.rawContent}`).join("\n---EVIDENCE_SEPARATOR---\n")
  return sha256(combined)
}

/**
 * Computes both hashes for a rule given its full context.
 * Returns { inputsHash, evidenceHash, hashAlgo: 'SHA256' }
 */
export function computeRuleHashes(params: {
  candidateFactIds: string[]
  agentRunIds: string[]
  evidenceRecords: Array<{ id: string; rawContent: string }>
  config?: Record<string, unknown>
}): {
  inputsHash: string
  evidenceHash: string
  hashAlgo: "SHA256"
} {
  const evidenceIds = params.evidenceRecords.map((e) => e.id)

  return {
    inputsHash: computeInputsHash({
      candidateFactIds: params.candidateFactIds,
      evidenceIds,
      agentRunIds: params.agentRunIds,
      config: params.config,
    }),
    evidenceHash: computeEvidenceHash(params.evidenceRecords),
    hashAlgo: "SHA256",
  }
}

/**
 * Checks if two hash sets are identical.
 * Used to detect if a retry is idempotent (same inputs, same evidence).
 */
export function hashesMatch(
  a: { inputsHash?: string | null; evidenceHash?: string | null },
  b: { inputsHash?: string | null; evidenceHash?: string | null }
): boolean {
  return a.inputsHash === b.inputsHash && a.evidenceHash === b.evidenceHash
}
