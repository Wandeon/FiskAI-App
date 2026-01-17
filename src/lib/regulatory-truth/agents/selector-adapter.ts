// src/lib/regulatory-truth/agents/selector-adapter.ts
//
// LLM-Based Selector Adaptation (Task 3.2: RTL Autonomy)
//
// Problem: When regulatory site formats change, scrapers fail silently (0 items extracted).
// Solution: When fingerprint drift detected + 0 items extracted:
//   1. Queue LLM job to suggest new CSS selectors
//   2. Validate selectors against sample HTML
//   3. Enforce precision gates (90% content, not nav/footer)
//   4. Create PR for human approval (never auto-merge)
//
// Critical Safeguards (Appendix A.8):
// - Validation: Test selectors against fixed sample set
// - Precision Gate: Require 90% content nodes (exclude nav/footer)
// - Yield Range: Enforce minimum/maximum yield expectations
// - Human Approval: Block auto-merge, require PR review

import { JSDOM } from "jsdom"
// Use article-agent's simpler ollama client instead of app's usage-tracking one
// This removes the app dependency for workers repo split
import { callOllamaJSON } from "@/lib/article-agent/llm/ollama-client"

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Minimum precision threshold (90%) for content vs nav/footer elements.
 * Selectors that capture more than 10% nav/footer elements are rejected.
 */
export const MIN_PRECISION_THRESHOLD = 0.9

/**
 * Minimum expected yield for a valid selector.
 * Selectors that match too few elements may be too specific.
 */
export const MIN_YIELD = 1

/**
 * Maximum expected yield for a valid selector.
 * Selectors that match too many elements may be too broad.
 */
export const MAX_YIELD = 500

/**
 * Navigation/footer ancestor tags that indicate non-content elements.
 */
const NAV_FOOTER_TAGS = new Set(["nav", "footer", "header", "aside"])

/**
 * ARIA roles that indicate navigation/auxiliary content.
 */
const NAV_FOOTER_ROLES = new Set(["navigation", "banner", "contentinfo", "complementary"])

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for selector adaptation job.
 */
export interface SelectorAdaptationInput {
  /** URL of the endpoint that needs adaptation */
  endpointUrl: string
  /** Current HTML content where selectors are failing */
  currentHtml: string
  /** Historical examples of successful extractions */
  historicalExamples: Array<{
    html: string
    extractedItems: string[]
  }>
  /** Current selectors that are no longer working */
  currentSelectors: string[]
}

/**
 * LLM response for selector suggestions.
 */
export interface SelectorSuggestionResponse {
  /** Suggested CSS selectors to try */
  suggestedSelectors: string[]
  /** LLM's reasoning for the suggestions */
  reasoning: string
}

/**
 * Result of validating a single selector.
 */
export interface SelectorValidation {
  /** The selector that was validated */
  selector: string
  /** Number of elements matched */
  yield: number
  /** Percentage of matched elements that are content (not nav/footer) */
  precision: number
  /** Whether the selector passes all validation criteria */
  isValid: boolean
  /** Reason for rejection if not valid */
  rejectionReason?: string
}

/**
 * Validation options for yield range.
 */
export interface ValidationOptions {
  minYield?: number
  maxYield?: number
}

/**
 * Pull request for selector suggestions awaiting human approval.
 */
export interface SelectorSuggestionPR {
  /** ID of the endpoint these selectors are for */
  endpointId: string
  /** Suggested selectors from LLM */
  suggestedSelectors: string[]
  /** Validation results for each selector */
  validationResults: SelectorValidation[]
  /** Approval status - always starts as pending_review */
  status: "pending_review" | "approved" | "rejected"
  /** When the PR was created */
  createdAt: Date
}

// =============================================================================
// SELECTOR SUGGESTION (LLM)
// =============================================================================

/**
 * Generate selector suggestions using LLM analysis.
 *
 * Provides the LLM with:
 * - Current HTML where selectors are failing
 * - Historical examples of what successful extractions looked like
 * - Current selectors that no longer work
 *
 * @param input - Selector adaptation input
 * @returns Suggested selectors and reasoning
 */
export async function generateSelectorSuggestions(
  input: SelectorAdaptationInput
): Promise<SelectorSuggestionResponse> {
  const systemPrompt = `You are an expert at analyzing HTML structure and CSS selectors.
Your task is to suggest CSS selectors that will extract regulatory content from a webpage.

Key requirements:
1. Selectors should target CONTENT elements (articles, documents, regulations)
2. Avoid selecting navigation, footer, header, or sidebar elements
3. Prefer semantic selectors (article, main, .content) over position-based ones
4. Consider class names that indicate document/content purpose
5. Return multiple selector options ranked by specificity`

  const userPrompt = `The following webpage selectors are no longer working. Analyze the HTML and suggest new selectors.

## Endpoint URL
${input.endpointUrl}

## Current Selectors (not working)
${input.currentSelectors.map((s) => `- ${s}`).join("\n")}

## Historical Examples (what we successfully extracted before)
${input.historicalExamples
  .slice(0, 3) // Limit to 3 examples to save tokens
  .map(
    (ex, i) => `
### Example ${i + 1}
HTML snippet: ${ex.html.slice(0, 500)}...
Extracted items: ${ex.extractedItems.slice(0, 5).join(", ")}
`
  )
  .join("\n")}

## Current HTML Structure
${input.currentHtml.slice(0, 5000)}${input.currentHtml.length > 5000 ? "..." : ""}

## Instructions
Analyze the HTML structure and suggest CSS selectors that would:
1. Match the regulatory content items (similar to historical examples)
2. Exclude navigation, footer, and sidebar elements
3. Return a reasonable number of items (not too few, not too many)

Return your response as JSON:
{
  "suggestedSelectors": ["selector1", "selector2", "selector3"],
  "reasoning": "Brief explanation of why these selectors should work"
}`

  const response = await callOllamaJSON<{
    suggestedSelectors: string[]
    reasoning: string
  }>(userPrompt, {
    systemPrompt,
    temperature: 0.3, // Lower temperature for more consistent results
    // Note: callOllamaJSON doesn't support maxTokens or operation tracking
    // Usage tracking is handled at the worker level for workers repo
  })

  return {
    suggestedSelectors: response.suggestedSelectors || [],
    reasoning: response.reasoning || "",
  }
}

// =============================================================================
// SELECTOR VALIDATION
// =============================================================================

/**
 * Check if an element is inside a navigation or footer ancestor.
 *
 * Traverses up the DOM tree looking for nav/footer tags or ARIA roles.
 *
 * @param selector - CSS selector for the element to check
 * @param html - HTML content to parse
 * @returns True if element is inside nav/footer, false if it's content
 */
export function isNavigationOrFooter(selector: string, html: string): boolean {
  const dom = new JSDOM(html)
  const document = dom.window.document

  try {
    const element = document.querySelector(selector)
    if (!element) return false

    // Walk up the DOM tree
    let current: Element | null = element
    while (current) {
      const tagName = current.tagName.toLowerCase()
      const role = current.getAttribute("role")

      // Check tag name
      if (NAV_FOOTER_TAGS.has(tagName)) {
        return true
      }

      // Check ARIA role
      if (role && NAV_FOOTER_ROLES.has(role.toLowerCase())) {
        return true
      }

      current = current.parentElement
    }

    return false
  } catch {
    return false
  }
}

/**
 * Calculate precision (content nodes / total nodes) for a selector.
 *
 * Precision measures what percentage of matched elements are actual content
 * vs navigation/footer elements. A high precision means the selector is
 * accurately targeting content.
 *
 * @param selector - CSS selector to evaluate
 * @param html - HTML content to parse
 * @returns Precision value between 0 and 1
 */
export function calculatePrecision(selector: string, html: string): number {
  const dom = new JSDOM(html)
  const document = dom.window.document

  try {
    const elements = document.querySelectorAll(selector)
    if (elements.length === 0) return 0

    let contentNodes = 0

    for (const element of Array.from(elements)) {
      // Walk up tree to check if inside nav/footer
      let current: Element | null = element
      let isNavOrFooter = false

      while (current) {
        const tagName = current.tagName.toLowerCase()
        const role = current.getAttribute("role")

        if (NAV_FOOTER_TAGS.has(tagName)) {
          isNavOrFooter = true
          break
        }

        if (role && NAV_FOOTER_ROLES.has(role.toLowerCase())) {
          isNavOrFooter = true
          break
        }

        current = current.parentElement
      }

      if (!isNavOrFooter) {
        contentNodes++
      }
    }

    return contentNodes / elements.length
  } catch {
    return 0
  }
}

/**
 * Validate a CSS selector against sample HTML.
 *
 * Checks:
 * 1. Selector is valid CSS syntax
 * 2. Selector matches elements in the HTML
 * 3. Yield is within acceptable range
 * 4. Precision is above 90% (mostly content, not nav/footer)
 *
 * @param selector - CSS selector to validate
 * @param html - Sample HTML to test against
 * @param options - Optional yield range configuration
 * @returns Validation result with pass/fail and reason
 */
export function validateSelector(
  selector: string,
  html: string,
  options: ValidationOptions = {}
): SelectorValidation {
  const minYield = options.minYield ?? MIN_YIELD
  const maxYield = options.maxYield ?? MAX_YIELD

  const dom = new JSDOM(html)
  const document = dom.window.document

  // Test selector validity
  let elements: NodeListOf<Element>
  try {
    elements = document.querySelectorAll(selector)
  } catch (error) {
    return {
      selector,
      yield: 0,
      precision: 0,
      isValid: false,
      rejectionReason: `Invalid selector syntax: ${error instanceof Error ? error.message : "parse error"}`,
    }
  }

  const yieldCount = elements.length

  // Check if selector matches anything
  if (yieldCount === 0) {
    return {
      selector,
      yield: 0,
      precision: 0,
      isValid: false,
      rejectionReason: "Selector matches no elements in sample HTML",
    }
  }

  // Check minimum yield
  if (yieldCount < minYield) {
    return {
      selector,
      yield: yieldCount,
      precision: calculatePrecision(selector, html),
      isValid: false,
      rejectionReason: `Yield ${yieldCount} is below minimum yield of ${minYield}`,
    }
  }

  // Check maximum yield
  if (yieldCount > maxYield) {
    return {
      selector,
      yield: yieldCount,
      precision: calculatePrecision(selector, html),
      isValid: false,
      rejectionReason: `Yield ${yieldCount} exceeds maximum yield of ${maxYield}`,
    }
  }

  // Calculate precision
  const precision = calculatePrecision(selector, html)

  // Check precision threshold
  if (precision < MIN_PRECISION_THRESHOLD) {
    return {
      selector,
      yield: yieldCount,
      precision,
      isValid: false,
      rejectionReason:
        `Precision ${(precision * 100).toFixed(1)}% is below 90% threshold. ` +
        `Selector captures too many nav/footer elements.`,
    }
  }

  // All checks passed
  return {
    selector,
    yield: yieldCount,
    precision,
    isValid: true,
  }
}

// =============================================================================
// PR CREATION (HUMAN APPROVAL)
// =============================================================================

/**
 * Create a selector suggestion PR for human approval.
 *
 * This function creates a PR record that requires human review before
 * the selectors can be applied. Per Appendix A.8, selector changes
 * are NEVER auto-merged.
 *
 * @param endpointId - ID of the endpoint needing new selectors
 * @param suggestedSelectors - Selectors suggested by LLM
 * @param validationResults - Validation results for each selector
 * @returns PR record in pending_review status
 */
export async function createSelectorSuggestionPR(
  endpointId: string,
  suggestedSelectors: string[],
  validationResults: SelectorValidation[]
): Promise<SelectorSuggestionPR> {
  // Note: In production, this would:
  // 1. Create a GitHub PR with the selector changes
  // 2. Store the PR metadata in the database
  // 3. Notify reviewers via Slack/email
  //
  // For now, we return a mock PR record.

  return {
    endpointId,
    suggestedSelectors,
    validationResults,
    status: "pending_review", // NEVER auto-approve
    createdAt: new Date(),
  }
}

// =============================================================================
// ADAPTATION WORKFLOW
// =============================================================================

/**
 * Run the full selector adaptation workflow.
 *
 * This is called when:
 * 1. Fingerprint drift is detected (>30%)
 * 2. Current selectors yield 0 items
 *
 * @param input - Selector adaptation input
 * @returns PR for human review, or null if no valid selectors found
 */
export async function runSelectorAdaptation(
  input: SelectorAdaptationInput
): Promise<SelectorSuggestionPR | null> {
  // Step 1: Generate suggestions via LLM
  const suggestions = await generateSelectorSuggestions(input)

  if (suggestions.suggestedSelectors.length === 0) {
    console.log(`[selector-adapter] LLM returned no suggestions for ${input.endpointUrl}`)
    return null
  }

  // Step 2: Validate each suggested selector
  const validationResults: SelectorValidation[] = []
  for (const selector of suggestions.suggestedSelectors) {
    const result = validateSelector(selector, input.currentHtml)
    validationResults.push(result)
  }

  // Step 3: Check if we have any valid selectors
  const validSelectors = validationResults.filter((v) => v.isValid)
  if (validSelectors.length === 0) {
    console.log(
      `[selector-adapter] No valid selectors found for ${input.endpointUrl}. ` +
        `All suggestions failed validation.`
    )
    // Still create PR so humans can see what was tried
  }

  // Step 4: Create PR for human approval (even if no valid selectors)
  // This allows humans to manually fix or adjust the selectors
  const pr = await createSelectorSuggestionPR(
    input.endpointUrl,
    suggestions.suggestedSelectors,
    validationResults
  )

  console.log(
    `[selector-adapter] Created PR for ${input.endpointUrl}: ` +
      `${validSelectors.length}/${suggestions.suggestedSelectors.length} valid selectors`
  )

  return pr
}
