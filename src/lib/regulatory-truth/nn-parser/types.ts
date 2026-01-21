import { ProvisionNodeType } from "@/generated/regulatory-client"

/**
 * Parser contract as defined in nn-mirror-v1.md Section 4.1
 */
export interface NNParserContract {
  parserId: string
  parserVersion: string
  parseConfigHash: string
  supportedContentClasses: ContentClass[]
  parse(input: ParseInput): Promise<ParseOutput>
}

export type ContentClass = "HTML" | "PDF_TEXT" | "PDF_SCANNED"

export interface ParseInput {
  evidenceId: string
  contentClass: ContentClass
  artifact: {
    id: string
    kind: string
    content: string
    contentHash: string
  }
}

export interface ParseOutput {
  status: "SUCCESS" | "PARTIAL" | "FAILED"
  errorMessage?: string

  warnings: Warning[]
  unparsedSegments: UnparsedSegment[]

  docMeta: DocumentMetadata

  cleanText: string
  cleanTextHash: string

  nodes: NodeOutput[]

  stats: ParseStats
}

export interface Warning {
  code: string
  message: string
  nodePath?: string
  offsets?: { start: number; end: number }
}

export interface UnparsedSegment {
  startOffset: number
  endOffset: number
  rawText: string
  reason: string
}

export interface DocumentMetadata {
  eli?: string
  nnYear?: number
  nnIssue?: number
  nnItem?: number
  title?: string
  textType?: string
  publishedAt?: Date
  effectiveFrom?: Date
}

export interface NodeOutput {
  nodeType: ProvisionNodeType
  nodePath: string
  label?: string
  orderIndex: number
  depth: number
  parentPath?: string

  startOffset: number
  endOffset: number
  isContainer: boolean

  rawText?: string
  normalizedText?: string
  htmlSelector?: string
}

export interface ParseStats {
  nodeCount: number
  maxDepth: number
  byType: Partial<Record<ProvisionNodeType, number>>
  coverageChars: number
  coveragePercent: number
}

export interface InvariantCheckResult {
  passed: boolean
  violations: InvariantViolation[]
}

export interface InvariantViolation {
  invariantId: string
  message: string
  nodePath?: string
  details?: Record<string, unknown>
}
