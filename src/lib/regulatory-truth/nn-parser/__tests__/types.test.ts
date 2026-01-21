import { describe, it, expect } from "vitest"
import type {
  ParseInput,
  ParseOutput,
  NodeOutput,
  Warning,
  UnparsedSegment,
  NNParserContract,
} from "../types"
import { ProvisionNodeType } from "@/generated/regulatory-client"

describe("Parser Types", () => {
  it("ParseInput has required fields", () => {
    const input: ParseInput = {
      evidenceId: "test-123",
      contentClass: "HTML",
      artifact: {
        id: "artifact-123",
        kind: "HTML_RAW",
        content: "<html>test</html>",
        contentHash: "abc123",
      },
    }
    expect(input.evidenceId).toBe("test-123")
  })

  it("NodeOutput enforces required fields", () => {
    const node: NodeOutput = {
      nodeType: ProvisionNodeType.CLANAK,
      nodePath: "/članak:1",
      orderIndex: 0,
      depth: 1,
      startOffset: 0,
      endOffset: 100,
      isContainer: false,
    }
    expect(node.nodePath).toBe("/članak:1")
  })

  it("Warning has proper structure", () => {
    const warning: Warning = {
      code: "MISSING_ARTICLE_NUMBER",
      message: "Article has no number",
    }
    expect(warning.code).toBe("MISSING_ARTICLE_NUMBER")
  })

  it("UnparsedSegment tracks skipped content", () => {
    const segment: UnparsedSegment = {
      startOffset: 100,
      endOffset: 200,
      rawText: "Some unparseable content...",
      reason: "NO_STRUCTURE_MARKERS",
    }
    expect(segment.reason).toBe("NO_STRUCTURE_MARKERS")
  })

  it("ParseOutput has all required sections", () => {
    const output: ParseOutput = {
      status: "SUCCESS",
      warnings: [],
      unparsedSegments: [],
      docMeta: { nnYear: 2024, nnIssue: 1, nnItem: 1 },
      cleanText: "Document content",
      cleanTextHash: "abc123",
      nodes: [],
      stats: {
        nodeCount: 0,
        maxDepth: 0,
        byType: {},
        coverageChars: 0,
        coveragePercent: 0,
      },
    }
    expect(output.status).toBe("SUCCESS")
  })
})
