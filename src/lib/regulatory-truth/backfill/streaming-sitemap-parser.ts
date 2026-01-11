/**
 * Streaming Sitemap Parser
 *
 * SAX-based streaming XML parser for sitemaps.
 * Yields URLs immediately as discovered, without materializing the full document.
 *
 * This module encapsulates all sax-js usage - no SAX leakage elsewhere in codebase.
 */

import sax from "sax"
import { canonicalizeUrl } from "./url-canonicalizer"

/**
 * Parser options with configurable limits
 */
export interface StreamingParserOptions {
  /** Maximum characters per URL (default: 2048) */
  maxLocLengthChars?: number
  /** Maximum URLs per sitemap file (default: 100,000) */
  maxLocsPerFile?: number
  /** Maximum bytes to read per file (default: 50MB) */
  maxBytesPerFile?: number
}

/**
 * Default limits - tested and enforced
 */
export const STREAMING_PARSER_DEFAULTS = {
  maxLocLengthChars: 2048,
  maxLocsPerFile: 100_000,
  maxBytesPerFile: 50 * 1024 * 1024, // 50MB
} as const

/**
 * Limit names for error reporting
 */
export type StreamingParserLimitName = "maxLocLengthChars" | "maxLocsPerFile" | "maxBytesPerFile"

/**
 * Error thrown when parser limits are exceeded
 */
export class StreamingParserLimitError extends Error {
  public readonly name = "StreamingParserLimitError"

  constructor(
    public readonly limitName: StreamingParserLimitName,
    public readonly value: number,
    public readonly limit: number,
    public readonly source: "sitemapindex" | "urlset"
  ) {
    super(`${source}: ${limitName} exceeded (${value} > ${limit})`)
  }
}

/**
 * Error thrown for malformed XML
 */
export class StreamingParserError extends Error {
  public readonly name = "StreamingParserError"

  constructor(
    message: string,
    public readonly source: "sitemapindex" | "urlset"
  ) {
    super(`${source}: ${message}`)
  }
}

/**
 * Internal parser state
 */
interface LocParserState {
  insideLoc: boolean
  currentLocText: string
  locsEmitted: number
  bytesRead: number
  limits: Required<StreamingParserOptions>
  source: "sitemapindex" | "urlset"
  error: Error | null
  pendingUrls: string[]
  resolve: ((result: IteratorResult<string>) => void) | null
  done: boolean
}

/**
 * Normalize and validate a URL for emission
 *
 * @param url - Raw URL text from XML
 * @returns Normalized URL or null if invalid
 */
function normalizeUrl(url: string): string | null {
  // Trim whitespace
  const trimmed = url.trim()

  // Reject empty
  if (!trimmed) return null

  // Validate URL format
  try {
    const parsed = new URL(trimmed)

    // Reject non-http(s)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }

    // Canonicalize
    return canonicalizeUrl(trimmed)
  } catch {
    return null
  }
}

/**
 * Create a streaming parser for sitemap XML
 *
 * @param source - Type of sitemap (sitemapindex or urlset)
 * @param options - Parser options
 * @returns Object with parser, state, and decoder
 */
function createParser(
  source: "sitemapindex" | "urlset",
  options?: StreamingParserOptions
): {
  parser: sax.SAXParser
  state: LocParserState
  decoder: TextDecoder
} {
  const limits: Required<StreamingParserOptions> = {
    maxLocLengthChars: options?.maxLocLengthChars ?? STREAMING_PARSER_DEFAULTS.maxLocLengthChars,
    maxLocsPerFile: options?.maxLocsPerFile ?? STREAMING_PARSER_DEFAULTS.maxLocsPerFile,
    maxBytesPerFile: options?.maxBytesPerFile ?? STREAMING_PARSER_DEFAULTS.maxBytesPerFile,
  }

  const state: LocParserState = {
    insideLoc: false,
    currentLocText: "",
    locsEmitted: 0,
    bytesRead: 0,
    limits,
    source,
    error: null,
    pendingUrls: [],
    resolve: null,
    done: false,
  }

  // Create strict SAX parser with namespace support
  const parser = sax.parser(true, {
    xmlns: true,
    position: false,
  })

  // Handle open tag
  parser.onopentag = (tag) => {
    // Normalize tag name (handle namespaced tags)
    const localName = ((tag as sax.QualifiedTag).local || tag.name).toLowerCase()

    if (localName === "loc") {
      // Check for nested <loc> (malformed XML)
      if (state.insideLoc) {
        state.error = new StreamingParserError("Malformed XML: nested <loc> tags", source)
        return
      }
      state.insideLoc = true
      state.currentLocText = ""
    }
  }

  // Handle text content (including CDATA)
  parser.ontext = (text) => {
    if (state.insideLoc) {
      state.currentLocText += text

      // Check length limit (fail early)
      if (state.currentLocText.length > limits.maxLocLengthChars) {
        state.error = new StreamingParserLimitError(
          "maxLocLengthChars",
          state.currentLocText.length,
          limits.maxLocLengthChars,
          source
        )
      }
    }
  }

  // Handle CDATA sections
  parser.oncdata = (cdata) => {
    if (state.insideLoc) {
      state.currentLocText += cdata

      // Check length limit
      if (state.currentLocText.length > limits.maxLocLengthChars) {
        state.error = new StreamingParserLimitError(
          "maxLocLengthChars",
          state.currentLocText.length,
          limits.maxLocLengthChars,
          source
        )
      }
    }
  }

  // Handle close tag
  parser.onclosetag = (tagName) => {
    // Normalize tag name
    const localName = tagName.split(":").pop()?.toLowerCase() || tagName.toLowerCase()

    if (localName === "loc" && state.insideLoc) {
      state.insideLoc = false

      // Normalize and validate URL
      const normalizedUrl = normalizeUrl(state.currentLocText)

      if (normalizedUrl) {
        // Only count valid URLs toward limit
        state.locsEmitted++

        // Check count limit
        if (state.locsEmitted > limits.maxLocsPerFile) {
          state.error = new StreamingParserLimitError(
            "maxLocsPerFile",
            state.locsEmitted,
            limits.maxLocsPerFile,
            source
          )
          return
        }

        // Queue URL for emission
        state.pendingUrls.push(normalizedUrl)

        // Resolve waiting consumer if any
        if (state.resolve && state.pendingUrls.length > 0) {
          const url = state.pendingUrls.shift()!
          const resolve = state.resolve
          state.resolve = null
          resolve({ value: url, done: false })
        }
      }
    }
  }

  // Handle XML errors
  parser.onerror = (err) => {
    state.error = new StreamingParserError(`XML parse error: ${err.message}`, source)
  }

  // Streaming text decoder (handles multi-byte chars across chunks)
  const decoder = new TextDecoder("utf-8", { fatal: false })

  return { parser, state, decoder }
}

/**
 * Stream parse a sitemap index, yield child sitemap URLs as discovered.
 *
 * @param readable - Async iterable of chunks (Buffer, Uint8Array)
 * @param options - Parser options
 * @yields Child sitemap URLs
 * @throws StreamingParserLimitError if limits exceeded
 * @throws StreamingParserError if XML is malformed
 */
export async function* parseSitemapIndexLocs(
  readable: AsyncIterable<Uint8Array>,
  options?: StreamingParserOptions
): AsyncGenerator<string> {
  const { parser, state, decoder } = createParser("sitemapindex", options)

  try {
    for await (const chunk of readable) {
      // Check byte limit
      state.bytesRead += chunk.length
      if (state.bytesRead > state.limits.maxBytesPerFile) {
        throw new StreamingParserLimitError(
          "maxBytesPerFile",
          state.bytesRead,
          state.limits.maxBytesPerFile,
          "sitemapindex"
        )
      }

      // Decode chunk (streaming mode handles multi-byte boundaries)
      const text = decoder.decode(chunk, { stream: true })
      parser.write(text)

      // Check for errors
      if (state.error) {
        throw state.error
      }

      // Yield any pending URLs immediately
      while (state.pendingUrls.length > 0) {
        yield state.pendingUrls.shift()!
      }
    }

    // Flush decoder and parser
    const remaining = decoder.decode(undefined, { stream: false })
    if (remaining) {
      parser.write(remaining)
    }
    parser.close()

    // Check for final errors
    if (state.error) {
      throw state.error
    }

    // Yield any remaining URLs
    while (state.pendingUrls.length > 0) {
      yield state.pendingUrls.shift()!
    }
  } finally {
    // Ensure parser is closed
    try {
      parser.close()
    } catch {
      // Ignore close errors
    }
  }
}

/**
 * Stream parse a urlset sitemap, yield content URLs as discovered.
 *
 * @param readable - Async iterable of chunks (Buffer, Uint8Array)
 * @param options - Parser options
 * @yields Content URLs
 * @throws StreamingParserLimitError if limits exceeded
 * @throws StreamingParserError if XML is malformed
 */
export async function* parseUrlsetLocs(
  readable: AsyncIterable<Uint8Array>,
  options?: StreamingParserOptions
): AsyncGenerator<string> {
  const { parser, state, decoder } = createParser("urlset", options)

  try {
    for await (const chunk of readable) {
      // Check byte limit
      state.bytesRead += chunk.length
      if (state.bytesRead > state.limits.maxBytesPerFile) {
        throw new StreamingParserLimitError(
          "maxBytesPerFile",
          state.bytesRead,
          state.limits.maxBytesPerFile,
          "urlset"
        )
      }

      // Decode chunk (streaming mode handles multi-byte boundaries)
      const text = decoder.decode(chunk, { stream: true })
      parser.write(text)

      // Check for errors
      if (state.error) {
        throw state.error
      }

      // Yield any pending URLs immediately
      while (state.pendingUrls.length > 0) {
        yield state.pendingUrls.shift()!
      }
    }

    // Flush decoder and parser
    const remaining = decoder.decode(undefined, { stream: false })
    if (remaining) {
      parser.write(remaining)
    }
    parser.close()

    // Check for final errors
    if (state.error) {
      throw state.error
    }

    // Yield any remaining URLs
    while (state.pendingUrls.length > 0) {
      yield state.pendingUrls.shift()!
    }
  } finally {
    // Ensure parser is closed
    try {
      parser.close()
    } catch {
      // Ignore close errors
    }
  }
}
