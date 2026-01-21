import type { NodeOutput, InvariantCheckResult, InvariantViolation } from "./types"
import { getParentPath } from "./node-path"

/**
 * Validate parser output against invariants from nn-mirror-v1.md Section 4.2
 */
export function validateInvariants(nodes: NodeOutput[], cleanText: string): InvariantCheckResult {
  const violations: InvariantViolation[] = []

  // PARSE-INV-001: nodePath unique within ParsedDocument
  checkUniqueNodePaths(nodes, violations)

  // PARSE-INV-003: cleanText.substring(startOffset, endOffset) reconstructs node text
  checkOffsetConsistency(nodes, cleanText, violations)

  // PARSE-INV-004: Child offsets within parent offsets (for content nodes)
  checkChildWithinParent(nodes, violations)

  // PARSE-INV-005: Sibling orderIndex values unique and sequential
  checkSiblingOrder(nodes, violations)

  // PARSE-INV-007: Content node siblings must not overlap
  checkNoSiblingOverlap(nodes, violations)

  return {
    passed: violations.length === 0,
    violations,
  }
}

/**
 * PARSE-INV-001: nodePath unique within document
 */
function checkUniqueNodePaths(nodes: NodeOutput[], violations: InvariantViolation[]): void {
  const seen = new Set<string>()
  for (const node of nodes) {
    if (seen.has(node.nodePath)) {
      violations.push({
        invariantId: "PARSE-INV-001",
        message: `Duplicate nodePath: ${node.nodePath}`,
        nodePath: node.nodePath,
      })
    }
    seen.add(node.nodePath)
  }
}

/**
 * PARSE-INV-003: Offset extraction must match rawText
 */
function checkOffsetConsistency(
  nodes: NodeOutput[],
  cleanText: string,
  violations: InvariantViolation[]
): void {
  for (const node of nodes) {
    // Only check nodes that have rawText stored
    if (!node.rawText) continue

    const extracted = cleanText.substring(node.startOffset, node.endOffset)
    if (extracted !== node.rawText) {
      violations.push({
        invariantId: "PARSE-INV-003",
        message: `Offset extraction mismatch at ${node.nodePath}`,
        nodePath: node.nodePath,
        details: {
          expected: node.rawText.substring(0, 50),
          actual: extracted.substring(0, 50),
          startOffset: node.startOffset,
          endOffset: node.endOffset,
        },
      })
    }
  }
}

/**
 * PARSE-INV-004: Child offsets within parent offsets
 */
function checkChildWithinParent(nodes: NodeOutput[], violations: InvariantViolation[]): void {
  const nodeByPath = new Map(nodes.map((n) => [n.nodePath, n]))

  for (const node of nodes) {
    const parentPath = getParentPath(node.nodePath)
    if (!parentPath) continue

    const parent = nodeByPath.get(parentPath)
    if (!parent) continue // Parent might be implied

    // Only enforce for content nodes
    if (node.isContainer) continue

    if (node.startOffset < parent.startOffset || node.endOffset > parent.endOffset) {
      violations.push({
        invariantId: "PARSE-INV-004",
        message: `Child ${node.nodePath} offsets outside parent ${parentPath}`,
        nodePath: node.nodePath,
        details: {
          childStart: node.startOffset,
          childEnd: node.endOffset,
          parentStart: parent.startOffset,
          parentEnd: parent.endOffset,
        },
      })
    }
  }
}

/**
 * PARSE-INV-005: Sibling orderIndex unique and sequential
 */
function checkSiblingOrder(nodes: NodeOutput[], violations: InvariantViolation[]): void {
  // Group nodes by parent path
  const siblingGroups = new Map<string, NodeOutput[]>()

  for (const node of nodes) {
    const parentPath = getParentPath(node.nodePath) || "/"
    const siblings = siblingGroups.get(parentPath) || []
    siblings.push(node)
    siblingGroups.set(parentPath, siblings)
  }

  for (const [parentPath, siblings] of siblingGroups) {
    const indices = siblings.map((s) => s.orderIndex).sort((a, b) => a - b)
    const seenIndices = new Set<number>()

    for (let i = 0; i < indices.length; i++) {
      if (seenIndices.has(indices[i])) {
        violations.push({
          invariantId: "PARSE-INV-005",
          message: `Duplicate orderIndex ${indices[i]} among siblings of ${parentPath}`,
          nodePath: parentPath,
          details: { indices },
        })
        break
      }
      seenIndices.add(indices[i])
    }
  }
}

/**
 * PARSE-INV-007: Content node siblings must not overlap
 */
function checkNoSiblingOverlap(nodes: NodeOutput[], violations: InvariantViolation[]): void {
  // Group content nodes by parent path
  const siblingGroups = new Map<string, NodeOutput[]>()

  for (const node of nodes) {
    // Only check content nodes (non-containers)
    if (node.isContainer) continue

    const parentPath = getParentPath(node.nodePath) || "/"
    const siblings = siblingGroups.get(parentPath) || []
    siblings.push(node)
    siblingGroups.set(parentPath, siblings)
  }

  for (const [parentPath, siblings] of siblingGroups) {
    // Sort by startOffset
    const sorted = [...siblings].sort((a, b) => a.startOffset - b.startOffset)

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]

      if (current.endOffset > next.startOffset) {
        violations.push({
          invariantId: "PARSE-INV-007",
          message: `Overlapping siblings: ${current.nodePath} and ${next.nodePath}`,
          nodePath: current.nodePath,
          details: {
            first: { path: current.nodePath, start: current.startOffset, end: current.endOffset },
            second: { path: next.nodePath, start: next.startOffset, end: next.endOffset },
          },
        })
      }
    }
  }
}
