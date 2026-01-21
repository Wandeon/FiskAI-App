import { createHash } from "crypto"
import type { NNParserContract, ParseInput, ParseOutput, ContentClass } from "./types"
import { parseHtml } from "./html-parser"

// Re-export types
export * from "./types"
export { parseHtml } from "./html-parser"
export { validateInvariants } from "./invariants"
export { buildNodePath, parseArticleNumber, parseStavakNumber } from "./node-path"
export { cleanHtml, extractText } from "./html-cleaner"

/**
 * Current parser version - update when parser logic changes
 */
const PARSER_VERSION = "0.1.0"

/**
 * Default parser configuration
 */
const DEFAULT_CONFIG = {
  offsetUnit: "UTF16",
  strictMode: false,
  extractRawText: true,
  maxDepth: 10,
}

/**
 * Get the parser version (semver or git SHA)
 */
export function getParserVersion(): string {
  // In production, this could read from git SHA or package.json
  return process.env.NN_PARSER_VERSION || PARSER_VERSION
}

/**
 * Compute config hash for parser configuration
 */
export function getParserConfigHash(config: Record<string, unknown> = DEFAULT_CONFIG): string {
  const sorted = JSON.stringify(config, Object.keys(config).sort())
  return createHash("sha256").update(sorted).digest("hex")
}

/**
 * NN Parser implementation
 *
 * Implements NNParserContract from nn-mirror-v1.md Section 4.1
 */
export const NNParser: NNParserContract = {
  parserId: "nn-parser",
  parserVersion: getParserVersion(),
  parseConfigHash: getParserConfigHash(DEFAULT_CONFIG),

  supportedContentClasses: ["HTML"] as ContentClass[],

  async parse(input: ParseInput): Promise<ParseOutput> {
    const { contentClass, artifact } = input

    if (contentClass !== "HTML") {
      return {
        status: "FAILED",
        errorMessage: `Unsupported content class: ${contentClass}. Only HTML is supported in v0.1.`,
        warnings: [],
        unparsedSegments: [],
        docMeta: {},
        cleanText: "",
        cleanTextHash: "",
        nodes: [],
        stats: {
          nodeCount: 0,
          maxDepth: 0,
          byType: {},
          coverageChars: 0,
          coveragePercent: 0,
        },
      }
    }

    return parseHtml(artifact.content)
  },
}

/**
 * Create a parser instance with custom config
 */
export function createParser(config: Partial<typeof DEFAULT_CONFIG> = {}): NNParserContract {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  return {
    ...NNParser,
    parseConfigHash: getParserConfigHash(mergedConfig),
  }
}
