// src/lib/regulatory-truth/watchdog/content-chunker.ts

const MAX_TOKENS = 4000
const OVERLAP_TOKENS = 500
const AVG_CHARS_PER_TOKEN = 4 // rough estimate for mixed content

export interface ContentChunk {
  content: string
  index: number
  totalChunks: number
  startOffset: number
  endOffset: number
}

/**
 * Estimate token count from character count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN)
}

/**
 * Split content into chunks at paragraph boundaries
 */
export function chunkContent(content: string): ContentChunk[] {
  const tokens = estimateTokens(content)

  // If content is small enough, return as single chunk
  if (tokens <= MAX_TOKENS) {
    return [
      {
        content,
        index: 0,
        totalChunks: 1,
        startOffset: 0,
        endOffset: content.length,
      },
    ]
  }

  const maxChars = MAX_TOKENS * AVG_CHARS_PER_TOKEN
  const overlapChars = OVERLAP_TOKENS * AVG_CHARS_PER_TOKEN
  const chunks: ContentChunk[] = []

  let startOffset = 0

  while (startOffset < content.length) {
    let endOffset = Math.min(startOffset + maxChars, content.length)

    // Try to break at paragraph boundary (double newline)
    if (endOffset < content.length) {
      const searchStart = Math.max(startOffset + maxChars - 500, startOffset)
      const searchEnd = Math.min(startOffset + maxChars + 500, content.length)
      const searchRegion = content.slice(searchStart, searchEnd)

      // Look for paragraph break
      const paragraphBreak = searchRegion.lastIndexOf("\n\n")
      if (paragraphBreak !== -1) {
        endOffset = searchStart + paragraphBreak + 2
      } else {
        // Fall back to sentence break
        const sentenceBreak = searchRegion.lastIndexOf(". ")
        if (sentenceBreak !== -1) {
          endOffset = searchStart + sentenceBreak + 2
        }
      }
    }

    chunks.push({
      content: content.slice(startOffset, endOffset),
      index: chunks.length,
      totalChunks: 0, // will be updated after
      startOffset,
      endOffset,
    })

    // Move start with overlap
    startOffset = endOffset - overlapChars
    if (startOffset >= content.length - overlapChars) {
      break // avoid tiny final chunk
    }
  }

  // Update totalChunks
  for (const chunk of chunks) {
    chunk.totalChunks = chunks.length
  }

  return chunks
}

/**
 * Check if content needs chunking
 */
export function needsChunking(content: string): boolean {
  return estimateTokens(content) > MAX_TOKENS
}
