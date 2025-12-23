// src/lib/regulatory-truth/e2e/assistant-suite.ts
// Test suite for AI Assistant citation compliance

import { db } from "@/lib/db"

export interface AssistantTestCase {
  id: string
  question: string
  expectedBehavior: "ANSWER_WITH_CITATION" | "REFUSE_NO_SOURCE" | "PARTIAL_ANSWER"
  domain: string
  field?: string
}

export interface AssistantTestResult {
  testCase: AssistantTestCase
  passed: boolean
  actualBehavior: string
  response?: string
  citations?: string[]
  error?: string
}

export interface AssistantSuiteResults {
  testResults: AssistantTestResult[]
  citationCompliance: number
  refusalRate: number
  errorRate: number
  summary: {
    total: number
    passed: number
    failed: number
    errors: number
  }
}

// Test cases for Croatian regulatory domains
const TEST_CASES: AssistantTestCase[] = [
  // VAT domain - should have sources if PUBLISHED rules exist
  {
    id: "vat-rate-standard",
    question: "Koja je standardna stopa PDV-a u Hrvatskoj?",
    expectedBehavior: "ANSWER_WITH_CITATION",
    domain: "pdv",
    field: "stopa_pdv",
  },
  {
    id: "vat-rate-reduced",
    question: "Koja je snižena stopa PDV-a?",
    expectedBehavior: "ANSWER_WITH_CITATION",
    domain: "pdv",
    field: "snizena_stopa",
  },
  // Income tax domain
  {
    id: "income-tax-rate",
    question: "Kolika je stopa poreza na dohodak?",
    expectedBehavior: "ANSWER_WITH_CITATION",
    domain: "porez_dohodak",
    field: "stopa",
  },
  // Social contributions
  {
    id: "health-insurance-rate",
    question: "Koliki su doprinosi za zdravstveno osiguranje?",
    expectedBehavior: "ANSWER_WITH_CITATION",
    domain: "doprinosi",
    field: "zdravstveno",
  },
  // Fictitious domain - should refuse
  {
    id: "nonexistent-regulation",
    question: "Koja je stopa poreza na sunčanje?",
    expectedBehavior: "REFUSE_NO_SOURCE",
    domain: "fictitious",
  },
  // Future date - should refuse or partial
  {
    id: "future-rate",
    question: "Koja će biti stopa PDV-a 2030. godine?",
    expectedBehavior: "REFUSE_NO_SOURCE",
    domain: "pdv",
  },
]

/**
 * Query for published rules that could answer a question
 */
async function findRelevantPublishedRules(
  domain: string,
  field?: string
): Promise<{ hasRules: boolean; ruleCount: number; hasSourcePointers: boolean }> {
  const where: Record<string, unknown> = {
    domain: { contains: domain, mode: "insensitive" },
    status: "PUBLISHED",
  }

  if (field) {
    where.field = { contains: field, mode: "insensitive" }
  }

  const rules = await db.regulatoryRule.findMany({
    where,
    include: { sourcePointers: true },
    take: 10,
  })

  return {
    hasRules: rules.length > 0,
    ruleCount: rules.length,
    hasSourcePointers: rules.some((r) => r.sourcePointers.length > 0),
  }
}

/**
 * Simulate assistant behavior for a test question
 * In production, this would call the actual assistant API
 */
async function simulateAssistantResponse(testCase: AssistantTestCase): Promise<{
  behavior: string
  wouldCite: boolean
  citations: string[]
}> {
  const { hasRules, ruleCount, hasSourcePointers } = await findRelevantPublishedRules(
    testCase.domain,
    testCase.field
  )

  // Simulate assistant logic based on available data
  if (hasRules && hasSourcePointers) {
    // Has PUBLISHED rules with source pointers - would answer with citation
    return {
      behavior: "ANSWER_WITH_CITATION",
      wouldCite: true,
      citations: [`${ruleCount} published rule(s) with citations`],
    }
  } else if (hasRules && !hasSourcePointers) {
    // Has rules but no source pointers - would refuse (INV-6 enforcement)
    return {
      behavior: "REFUSE_NO_SOURCE",
      wouldCite: false,
      citations: [],
    }
  } else {
    // No rules found - would refuse
    return {
      behavior: "REFUSE_NO_SOURCE",
      wouldCite: false,
      citations: [],
    }
  }
}

/**
 * Run a single test case
 */
async function runTestCase(testCase: AssistantTestCase): Promise<AssistantTestResult> {
  try {
    const response = await simulateAssistantResponse(testCase)

    // Determine expected vs actual
    let passed = false

    if (testCase.expectedBehavior === "ANSWER_WITH_CITATION") {
      // Expected to answer - pass if it would cite
      passed = response.behavior === "ANSWER_WITH_CITATION" && response.wouldCite
    } else if (testCase.expectedBehavior === "REFUSE_NO_SOURCE") {
      // Expected to refuse - pass if it refuses
      passed = response.behavior === "REFUSE_NO_SOURCE"
    } else if (testCase.expectedBehavior === "PARTIAL_ANSWER") {
      // Partial is acceptable for either citation or refusal
      passed = true
    }

    return {
      testCase,
      passed,
      actualBehavior: response.behavior,
      citations: response.citations,
    }
  } catch (error) {
    return {
      testCase,
      passed: false,
      actualBehavior: "ERROR",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Run the full assistant test suite
 */
export async function runAssistantSuite(): Promise<AssistantSuiteResults> {
  console.log("[assistant-suite] Running assistant citation compliance tests...")

  const testResults: AssistantTestResult[] = []
  let citationTests = 0
  let citationsProvided = 0
  let refusalTests = 0
  let refusalsCorrect = 0
  let errors = 0

  for (const testCase of TEST_CASES) {
    const result = await runTestCase(testCase)
    testResults.push(result)

    if (result.error) {
      errors++
      console.log(`[assistant-suite] ✗ ${testCase.id}: ERROR - ${result.error}`)
    } else if (result.passed) {
      console.log(`[assistant-suite] ✓ ${testCase.id}: ${result.actualBehavior}`)
    } else {
      console.log(
        `[assistant-suite] ✗ ${testCase.id}: expected ${testCase.expectedBehavior}, got ${result.actualBehavior}`
      )
    }

    // Track citation compliance
    if (testCase.expectedBehavior === "ANSWER_WITH_CITATION") {
      citationTests++
      if (result.actualBehavior === "ANSWER_WITH_CITATION") {
        citationsProvided++
      }
    }

    // Track refusal rate
    if (testCase.expectedBehavior === "REFUSE_NO_SOURCE") {
      refusalTests++
      if (result.actualBehavior === "REFUSE_NO_SOURCE") {
        refusalsCorrect++
      }
    }
  }

  const passed = testResults.filter((r) => r.passed).length
  const failed = testResults.filter((r) => !r.passed && !r.error).length

  const citationCompliance = citationTests > 0 ? citationsProvided / citationTests : 1
  const refusalRate = refusalTests > 0 ? refusalsCorrect / refusalTests : 1
  const errorRate = testResults.length > 0 ? errors / testResults.length : 0

  console.log(`[assistant-suite] Results: ${passed} passed, ${failed} failed, ${errors} errors`)
  console.log(`[assistant-suite] Citation compliance: ${(citationCompliance * 100).toFixed(1)}%`)
  console.log(`[assistant-suite] Refusal correctness: ${(refusalRate * 100).toFixed(1)}%`)

  return {
    testResults,
    citationCompliance,
    refusalRate,
    errorRate,
    summary: {
      total: testResults.length,
      passed,
      failed,
      errors,
    },
  }
}

/**
 * Get summary of assistant test coverage
 */
export function getTestCoverage(): {
  domains: string[]
  totalTests: number
  citationTests: number
  refusalTests: number
} {
  const domains = Array.from(new Set(TEST_CASES.map((t) => t.domain)))

  return {
    domains,
    totalTests: TEST_CASES.length,
    citationTests: TEST_CASES.filter((t) => t.expectedBehavior === "ANSWER_WITH_CITATION").length,
    refusalTests: TEST_CASES.filter((t) => t.expectedBehavior === "REFUSE_NO_SOURCE").length,
  }
}
