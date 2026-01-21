import { describe, it, expect } from "vitest"
import { validateInvariants } from "../invariants"
import type { NodeOutput } from "../types"
import { ProvisionNodeType } from "@/generated/regulatory-client"

describe("Invariant Validator", () => {
  const makeNode = (overrides: Partial<NodeOutput>): NodeOutput => ({
    nodeType: ProvisionNodeType.CLANAK,
    nodePath: "/članak:1",
    orderIndex: 0,
    depth: 1,
    startOffset: 0,
    endOffset: 100,
    isContainer: false,
    ...overrides,
  })

  describe("PARSE-INV-001: unique nodePath", () => {
    it("passes with unique paths", () => {
      const nodes: NodeOutput[] = [
        makeNode({ nodePath: "/članak:1", orderIndex: 0, startOffset: 0, endOffset: 10 }),
        makeNode({ nodePath: "/članak:2", orderIndex: 1, startOffset: 10, endOffset: 20 }),
      ]
      const result = validateInvariants(nodes, "test content")
      expect(result.passed).toBe(true)
    })

    it("fails with duplicate paths", () => {
      const nodes: NodeOutput[] = [
        makeNode({ nodePath: "/članak:1" }),
        makeNode({ nodePath: "/članak:1" }), // Duplicate
      ]
      const result = validateInvariants(nodes, "test content")
      expect(result.passed).toBe(false)
      expect(result.violations.some((v) => v.invariantId === "PARSE-INV-001")).toBe(true)
    })
  })

  describe("PARSE-INV-003: offset validity", () => {
    it("passes with valid offsets", () => {
      const content = "Hello World"
      const nodes: NodeOutput[] = [makeNode({ startOffset: 0, endOffset: 5, rawText: "Hello" })]
      const result = validateInvariants(nodes, content)
      expect(result.passed).toBe(true)
    })

    it("fails when substring does not match rawText", () => {
      const content = "Hello World"
      const nodes: NodeOutput[] = [makeNode({ startOffset: 0, endOffset: 5, rawText: "Wrong" })]
      const result = validateInvariants(nodes, content)
      expect(result.passed).toBe(false)
      expect(result.violations.some((v) => v.invariantId === "PARSE-INV-003")).toBe(true)
    })
  })

  describe("PARSE-INV-007: no sibling overlap for content nodes", () => {
    it("passes with non-overlapping siblings", () => {
      const nodes: NodeOutput[] = [
        makeNode({
          nodePath: "/članak:1/stavak:1",
          startOffset: 0,
          endOffset: 10,
          isContainer: false,
          orderIndex: 0,
        }),
        makeNode({
          nodePath: "/članak:1/stavak:2",
          startOffset: 10,
          endOffset: 20,
          isContainer: false,
          orderIndex: 1,
        }),
      ]
      const result = validateInvariants(nodes, "test content here for validation")
      expect(result.passed).toBe(true)
    })

    it("fails with overlapping content siblings", () => {
      const nodes: NodeOutput[] = [
        makeNode({
          nodePath: "/članak:1/stavak:1",
          startOffset: 0,
          endOffset: 15,
          isContainer: false,
        }),
        makeNode({
          nodePath: "/članak:1/stavak:2",
          startOffset: 10,
          endOffset: 20,
          isContainer: false,
        }),
      ]
      const result = validateInvariants(nodes, "test content here for validation")
      expect(result.passed).toBe(false)
      expect(result.violations.some((v) => v.invariantId === "PARSE-INV-007")).toBe(true)
    })

    it("allows container node overlap", () => {
      const nodes: NodeOutput[] = [
        makeNode({
          nodePath: "/članak:1",
          startOffset: 0,
          endOffset: 100,
          isContainer: true,
          nodeType: ProvisionNodeType.CLANAK,
        }),
        makeNode({
          nodePath: "/članak:1/stavak:1",
          startOffset: 0,
          endOffset: 50,
          isContainer: false,
        }),
      ]
      const result = validateInvariants(nodes, "test ".repeat(20))
      expect(result.passed).toBe(true)
    })
  })
})
