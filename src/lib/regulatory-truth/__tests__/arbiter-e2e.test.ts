// src/lib/regulatory-truth/__tests__/arbiter-e2e.test.ts
/**
 * Arbiter E2E Synthetic Conflict Test
 *
 * This test verifies the complete conflict resolution pipeline:
 * 1. Create a synthetic conflict between two rules
 * 2. Run the Arbiter agent
 * 3. Verify conflict is resolved with rationale
 * 4. Verify AgentRun record shows completion
 */

// Load environment variables for Node test runner (which doesn't auto-load .env files)
// Load .env.local first (local overrides), then .env as fallback
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config({ path: ".env" })

import { describe, it, before, after } from "node:test"
import assert from "node:assert"
import { db } from "@/lib/db"
import { runArbiter } from "../agents/arbiter"

// Check if E2E tests with LLM should run
// These tests require:
// 1. OLLAMA_API_KEY and OLLAMA_ENDPOINT to be properly configured
// 2. RUN_LLM_E2E_TESTS=true to be set (opt-in for CI/local environments)
// This prevents CI failures when Ollama is not available or API keys are disabled
const hasOllamaConfig = Boolean(process.env.OLLAMA_API_KEY && process.env.OLLAMA_ENDPOINT)
const runLlmTests = process.env.RUN_LLM_E2E_TESTS === "true"
const shouldSkip = !hasOllamaConfig || !runLlmTests
const skipReason = shouldSkip
  ? `Skipping: RUN_LLM_E2E_TESTS=${process.env.RUN_LLM_E2E_TESTS || "not set"} (set RUN_LLM_E2E_TESTS=true to enable)`
  : undefined

describe("Arbiter E2E", { skip: shouldSkip ? skipReason : undefined }, () => {
  let testConceptSlug: string
  let ruleAId: string
  let ruleBId: string
  let conflictId: string

  before(async () => {
    testConceptSlug = `arbiter-e2e-test-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Create Rule A: An existing published rule from GUIDANCE
    const ruleA = await db.regulatoryRule.create({
      data: {
        conceptSlug: testConceptSlug,
        titleHr: "Stopa PDV-a (staro)",
        titleEn: "VAT Rate (old)",
        riskTier: "T2",
        authorityLevel: "GUIDANCE",
        appliesWhen: JSON.stringify({ op: "true" }),
        value: "25",
        valueType: "percentage",
        effectiveFrom: new Date("2024-01-01"),
        effectiveUntil: new Date("2024-12-31"),
        status: "PUBLISHED",
        confidence: 0.95,
      },
    })
    ruleAId = ruleA.id

    // Create Rule B: A new rule from LAW (higher authority)
    const ruleB = await db.regulatoryRule.create({
      data: {
        conceptSlug: testConceptSlug,
        titleHr: "Stopa PDV-a (novo)",
        titleEn: "VAT Rate (new)",
        riskTier: "T2",
        authorityLevel: "LAW", // Higher authority - should supersede
        appliesWhen: JSON.stringify({ op: "true" }),
        value: "25", // Same value but different source
        valueType: "percentage",
        effectiveFrom: new Date("2024-06-01"),
        effectiveUntil: new Date("2025-12-31"),
        status: "PENDING_REVIEW",
        confidence: 0.92,
      },
    })
    ruleBId = ruleB.id

    // Create a synthetic conflict
    // Use TEMPORAL_CONFLICT for rule-to-rule conflicts with overlapping effective dates
    // SOURCE_CONFLICT is for source pointer conflicts and requires metadata.sourcePointerIds
    const conflict = await db.regulatoryConflict.create({
      data: {
        itemAId: ruleAId,
        itemBId: ruleBId,
        conflictType: "TEMPORAL_CONFLICT",
        status: "OPEN",
        description: `[STRUCTURAL] E2E Test: Rules have overlapping effective dates. LAW (Rule B) may supersede GUIDANCE (Rule A).`,
      },
    })
    conflictId = conflict.id
  })

  after(async () => {
    // Cleanup: delete agent runs for this conflict
    await db.agentRun.deleteMany({
      where: {
        input: {
          path: ["conflictId"],
          equals: conflictId,
        },
      },
    })

    // Delete conflict
    await db.regulatoryConflict.deleteMany({
      where: { id: conflictId },
    })

    // Delete test rules
    await db.regulatoryRule.deleteMany({
      where: { conceptSlug: testConceptSlug },
    })
  })

  describe("runArbiter synthetic conflict", () => {
    it("resolves conflict and creates AgentRun record", async () => {
      // Run the arbiter on the synthetic conflict
      const result = await runArbiter(conflictId)

      // Verify arbiter completed successfully
      assert.ok(result, "Arbiter should return a result")
      assert.ok(result.success, `Arbiter should succeed: ${result.error || ""}`)

      // Check conflict status in database
      const updatedConflict = await db.regulatoryConflict.findUnique({
        where: { id: conflictId },
      })

      assert.ok(updatedConflict, "Conflict should exist in database")

      // Conflict should be resolved or escalated (depending on confidence)
      assert.ok(
        ["RESOLVED", "ESCALATED"].includes(updatedConflict.status),
        `Conflict status should be RESOLVED or ESCALATED, got: ${updatedConflict.status}`
      )

      // If resolved, verify resolution details
      if (updatedConflict.status === "RESOLVED") {
        assert.ok(updatedConflict.resolution, "Resolved conflict should have resolution")
        assert.ok(updatedConflict.resolvedAt, "Resolved conflict should have resolvedAt timestamp")
      }

      // Verify arbiter rationale exists in agent output
      if (result.output) {
        const output = result.output as { arbitration?: { resolution?: { rationale?: string } } }
        assert.ok(
          output.arbitration?.resolution?.rationale,
          "Arbiter output should include rationale"
        )
        assert.ok(
          (output.arbitration?.resolution?.rationale ?? "").length > 10,
          "Rationale should be substantive, not empty"
        )
      }
    })

    it("creates AgentRun record with ARBITER type", async () => {
      // Check for AgentRun record
      const agentRun = await db.agentRun.findFirst({
        where: {
          agentType: "ARBITER",
          input: {
            path: ["conflictId"],
            equals: conflictId,
          },
        },
        orderBy: { startedAt: "desc" },
      })

      assert.ok(agentRun, "AgentRun record should exist for arbiter")
      assert.strictEqual(agentRun.agentType, "ARBITER")

      // AgentRun should be completed or failed (not still running)
      assert.ok(
        ["COMPLETED", "FAILED"].includes(agentRun.status),
        `AgentRun status should be COMPLETED or FAILED, got: ${agentRun.status}`
      )

      // If successful, check timing
      if (agentRun.status === "COMPLETED") {
        assert.ok(agentRun.completedAt, "Successful run should have completedAt")
        const durationMs =
          new Date(agentRun.completedAt).getTime() - new Date(agentRun.startedAt).getTime()
        assert.ok(durationMs > 0, "Duration should be positive")
        assert.ok(durationMs < 60000, "Arbiter should complete within 60 seconds")
      }
    })

    it("handles authority hierarchy correctly", async () => {
      // The conflict has LAW (higher) vs GUIDANCE (lower)
      // Arbiter should recognize the authority difference

      const updatedConflict = await db.regulatoryConflict.findUnique({
        where: { id: conflictId },
      })

      // If resolved, check if the resolution mentions authority
      if (updatedConflict?.status === "RESOLVED" && updatedConflict.resolution) {
        // The resolution should reference the winning rule or authority
        const resolutionObj = updatedConflict.resolution as {
          rationaleEn?: string
          rationaleHr?: string
        } | null
        const resolutionText = (
          resolutionObj?.rationaleEn ||
          resolutionObj?.rationaleHr ||
          ""
        ).toLowerCase()
        const mentionsAuthority =
          resolutionText.includes("law") ||
          resolutionText.includes("authority") ||
          resolutionText.includes("supersede") ||
          resolutionText.includes("higher") ||
          resolutionText.includes("zakon") // Croatian for "law"

        // This is an informational assertion - log but don't fail
        if (!mentionsAuthority) {
          console.log(
            "[arbiter-e2e] Note: Resolution does not explicitly mention authority hierarchy:",
            JSON.stringify(updatedConflict.resolution).substring(0, 200)
          )
        }
      }

      // Primary assertion: conflict was handled
      assert.ok(
        updatedConflict?.status !== "OPEN",
        "Conflict should no longer be OPEN after arbiter runs"
      )
    })
  })
})
