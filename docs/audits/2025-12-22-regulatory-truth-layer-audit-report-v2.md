# Regulatory Truth Layer - Audit Report v2

**Date:** 2025-12-22 (Re-Audit)
**Auditor:** Gemini CLI Agent
**Target:** Regulatory Truth Layer (FiskAI)
**Verdict:** 🔴 **STILL NOT PRODUCTION READY**

---

## 1. Executive Summary

A re-audit was performed following reported changes. While some issues (DSL security, Trigger API, Authority logic) have been addressed, the **most critical** findings regarding the AI Provider and Testing methodology remain unresolved. The system continues to rely on a local LLM (Ollama) despite documentation claiming Claude, and the tests continue to verify mocked logic rather than actual code.

**The system remains uncertifiable for production usage.**

---

## 2. Status of Previous Critical Findings

| ID     | Finding                                    | Status                 | Notes                                                                                                                                                       |
| ------ | ------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | **Tech Stack Mismatch (Ollama vs Claude)** | 🔴 **UNRESOLVED**      | Code still uses `OLLAMA_ENDPOINT`. Added timeouts/aborts, but fundamentally still using local Qwen/Llama models instead of the documented Anthropic Claude. |
| **C2** | **"False Positive" Testing**               | 🔴 **UNRESOLVED**      | `arbiter.test.ts` still tests `getMockFunctions()` instead of importing real functions. **Zero** actual coverage for conflict resolution.                   |
| **C3** | **Scalability Bottleneck (Sleep)**         | 🟡 **PARTIALLY FIXED** | Sleep reduced from 120s to 3s (via `AGENT_RATE_LIMIT_MS`). This is better, but still a naive blocking sleep rather than a proper queue.                     |
| **C4** | **DSL ReDoS Vulnerability**                | 🟢 **FIXED**           | `safeRegexTest` implemented with length (100 chars) and timeout (50ms) limits.                                                                              |

---

## 3. New & Remaining Critical Findings (Severity: CRITICAL)

### 3.1. Persistent Tech Stack Deception

**Location:** `src/lib/regulatory-truth/agents/runner.ts`

- **Finding:** The code explicitly hardcodes `OLLAMA_ENDPOINT` and `OLLAMA_MODEL` defaults. It includes specific logic to handle `qwen3-next` quirks (parsing "thinking" field).
- **Impact:** The system **cannot** deliver "Regulatory Truth" using small local models (7B-14B params) which have high hallucination rates compared to SOTA models like Claude 3.5 Sonnet. The "Truth Layer" moniker is misleading under this architecture.

### 3.2. Testing Theater

**Location:** `src/lib/regulatory-truth/__tests__/arbiter.test.ts`

- **Finding:** The test file defines:
  ```typescript
  function getMockFunctions() { ... }
  ```
  And then tests _that_ local function. It does **not** test `src/lib/regulatory-truth/agents/arbiter.ts`.
- **Impact:** If `arbiter.ts` logic is broken (e.g., inverted priority), the tests will still pass. This is dangerous for a legal compliance system.

---

## 4. Improvements Noted (Severity: LOW/MEDIUM)

### 4.1. Trigger API Implemented

**Location:** `src/app/api/admin/regulatory-truth/trigger/route.ts`

- **Status:** **Fixed**. The API now properly imports and calls `runSentinel`, `runExtractorBatch`, etc. The "Placebo Button" issue is resolved.

### 4.2. Authority Logic Hardening

**Location:** `src/lib/regulatory-truth/utils/authority.ts`

- **Status:** **Improved**. Added `deriveAuthorityLevelAsync` which queries the DB for explicit hierarchy scores before falling back to string matching. This is much more robust.

### 4.3. DSL Sanitization

**Location:** `src/lib/regulatory-truth/dsl/applies-when.ts`

- **Status:** **Fixed**. `safeRegexTest` prevents ReDoS attacks by enforcing timeouts and length limits on regex execution.

---

## 5. Updated Recommendations

1.  **MANDATORY:** Replace `runner.ts` logic to use the Anthropic API (SDK) as originally documented. Remove all Ollama/Qwen specific code.
2.  **MANDATORY:** Rewrite `arbiter.test.ts` to `import { checkEscalationCriteria } from '../agents/arbiter'` and test the _actual_ exported function.
3.  **RECOMMENDED:** Implement a proper job queue (BullMQ/Redis) instead of `sleep()` for the overnight runner to ensure reliability and observability.

---

**End of Report v2**
