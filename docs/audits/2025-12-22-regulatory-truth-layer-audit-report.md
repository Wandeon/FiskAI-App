# Regulatory Truth Layer - Audit Report

**Date:** 2025-12-22
**Auditor:** Gemini CLI Agent
**Target:** Regulatory Truth Layer (FiskAI)
**Verdict:** 🔴 **NOT PRODUCTION READY**

---

## 1. Executive Summary

The Regulatory Truth Layer contains **Critical** discrepancies between documentation and implementation, along with severe scalability and testing flaws. While the architectural concept of the "Six Agents" is implemented and the data schema is robust, the current codebase relies on a **different AI provider** than documented (Ollama/Qwen vs. Anthropic/Claude), uses **fake tests** that verify mocked logic instead of real code, and includes **artificial bottlenecks** (2-minute sleeps) that make the "overnight" pipeline unscalable.

**Immediate remediation is required before any production deployment.**

---

## 2. Critical Findings (Severity: CRITICAL)

### 2.1. Tech Stack Mismatch & AI Provider Risk

**Location:** `src/lib/regulatory-truth/agents/runner.ts`

- **Documented:** Anthropic Claude (claude-sonnet-4-20250514)
- **Implemented:** Ollama (Qwen3-next / Llama 3.1)
- **Finding:** The code explicitly connects to a local/custom `OLLAMA_ENDPOINT` and includes workaround logic for `qwen3-next` quirks (parsing "thinking" fields).
- **Impact:**
  - **Production Readiness:** Fails. Local models (Qwen/Llama) have significantly different hallucination rates and reasoning capabilities compared to Claude 3.5 Sonnet. The "Truth" layer cannot be trusted with the current model configuration.
  - **Infrastructure:** Requires GPU infrastructure management (Ollama) which is not described in the "Hosting" section (Hetzner ARM64).

### 2.2. "False Positive" Testing

**Location:** `src/lib/regulatory-truth/__tests__/arbiter.test.ts`

- **Finding:** The test file re-implements core logic (`getAuthorityScore`, `checkEscalationCriteria`) inside a `getMockFunctions` helper instead of importing the actual functions from `arbiter.ts`.
- **Impact:** The tests do **not** verify the application code. If a developer introduces a bug in `arbiter.ts`, the tests will still pass. This gives a false sense of security for the critical Conflict Resolution logic.

### 2.3. Scalability Bottleneck (The "2-Minute Sleep")

**Location:** `src/lib/regulatory-truth/scripts/overnight-run.ts`

- **Finding:** The script enforces a hardcoded `RATE_LIMIT_DELAY = 120000` (2 minutes) between **every** batch of operations.
- **Impact:**
  - Processing 10 evidence records takes ~20 minutes.
  - Processing 10 domains takes ~20 minutes.
  - The system cannot scale to "100+ sources" and "1000+ rules" as requested. It will fail to complete within the overnight window.

### 2.4. DSL Security & ReDoS Vulnerability

**Location:** `src/lib/regulatory-truth/agents/reviewer.ts` & `src/lib/regulatory-truth/dsl/applies-when.ts`

- **Finding 1 (Validation):** The `Reviewer` agent validates the `appliesWhen` DSL **only via AI**. There is no code-level pre-save validation to ensure the string matches the schema.
- **Finding 2 (ReDoS):** The DSL `matches` operator uses `new RegExp(predicate.pattern)`.
  - **Risk:** If the AI hallucinates or is injected with a malicious regex pattern, evaluating it in `evaluate/route.ts` can cause a Denial of Service (ReDoS) by hanging the Node.js event loop.

---

## 3. High Priority Findings (Severity: HIGH)

### 3.1. Data Provenance Risk (Cascade Delete)

**Location:** `prisma/schema.prisma`

- **Finding:** `SourcePointer` has `onDelete: Cascade` relation to `Evidence`. `Evidence` has `onDelete: Cascade` relation to `RegulatorySource`.
- **Impact:** If a Source or Evidence record is deleted (accidentally or via cleanup), all `SourcePointer` records are deleted. The `RegulatoryRule` remains but loses its link to the source (provenance). This violates the "Legal Defensibility" requirement, as you can no longer prove _where_ a rule came from.

### 3.2. Placeholder "Trigger" API

**Location:** `src/app/api/admin/regulatory-truth/trigger/route.ts`

- **Finding:** The API endpoint creates `AgentRun` records but does **not** actually trigger any processing. It contains the comment: `// In a real implementation, this would: ... 2. Trigger the Sentinel agent`.
- **Impact:** The Admin Dashboard "Trigger" button is a placebo. It records an intent but performs no action.

### 3.3. Fragile Authority Logic

**Location:** `src/lib/regulatory-truth/utils/authority.ts`

- **Finding:** Authority levels (`LAW`, `GUIDANCE`) are derived by simple string matching on the source slug (e.g., `if (slug.includes("porezna")) return "GUIDANCE"`).
- **Impact:** Any source slug that doesn't strictly match these hardcoded English/Croatian keywords will default to `PRACTICE` (lowest authority), potentially misclassifying laws.

### 3.4. Missing Knowledge Graph API

**Location:** `src/app/api/*`

- **Finding:** Confirmed gap from audit request. There are no endpoints to query the graph relationships (`GraphEdge`), meaning dependency analysis ("If this law changes, what breaks?") is impossible via API.

---

## 4. Risk Registry Updates

Add these new risks to the registry:

| ID      | Risk                                                                                         | Likelihood         | Impact       | Severity     | Mitigation                            |
| ------- | -------------------------------------------------------------------------------------------- | ------------------ | ------------ | ------------ | ------------------------------------- |
| **R16** | **Tech Stack Divergence:** System runs on weaker local LLM instead of verified Claude model. | **100% (Certain)** | **Critical** | **CRITICAL** | Switch to Anthropic API immediately.  |
| **R17** | **Fake Test Coverage:** Tests verify mocks, not code.                                        | **100% (Certain)** | **High**     | **CRITICAL** | Rewrite tests to import actual logic. |
| **R18** | **ReDoS Attack:** Malicious regex in DSL hangs server.                                       | **Medium**         | **High**     | **HIGH**     | Use `re2` or validated regex subset.  |
| **R19** | **Provenance Loss:** Deleting evidence erases audit trail.                                   | **Low**            | **Critical** | **HIGH**     | Change to Soft Delete (`deletedAt`).  |

---

## 5. Recommendations Roadmap

### Phase 1: Critical Fixes (Week 1)

1.  **Switch AI Provider:** Update `runner.ts` to use Anthropic API as documented. Remove Ollama workarounds.
2.  **Fix Tests:** Rewrite `arbiter.test.ts` to import functions from `arbiter.ts`.
3.  **Remove Sleep:** Replace `sleep(120000)` in `overnight-run.ts` with a proper job queue (e.g., BullMQ) or a much shorter delay (2s) combined with real rate limit handling.
4.  **Secure DSL:** Add `validateAppliesWhen(rule.appliesWhen)` in `composer.ts` and `reviewer.ts` before saving. Sanitize regex patterns.

### Phase 2: Integrity & Logic (Week 2)

1.  **Soft Delete:** Update Prisma schema to use `isDeleted` or `deletedAt` for `Evidence` and `SourcePointer` instead of Cascade Delete.
2.  **Implement Trigger:** Connect `trigger/route.ts` to the actual runner logic (or a queue worker).
3.  **Robust Authority:** Move authority logic to a configuration table or database field on `RegulatorySource`, rather than hardcoded string matching.

---

**End of Report**
