// src/lib/article-agent/extraction/chunker.ts

export interface TextChunk {
  content: string
  startIndex: number
  endIndex: number
}

export interface ChunkerOptions {
  chunkSize?: number // Target characters per chunk
  overlapSize?: number // Overlap between chunks
  minChunkSize?: number // Minimum chunk size to keep
}

const DEFAULT_OPTIONS: Required<ChunkerOptions> = {
  chunkSize: 1000,
  overlapSize: 200,
  minChunkSize: 100,
}

export function chunkText(text: string, options: ChunkerOptions = {}): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const chunks: TextChunk[] = []

  // Clean and normalize text
  const cleanText = text.replace(/\s+/g, " ").trim()

  if (cleanText.length <= opts.chunkSize) {
    return [{ content: cleanText, startIndex: 0, endIndex: cleanText.length }]
  }

  let startIndex = 0

  while (startIndex < cleanText.length) {
    let endIndex = Math.min(startIndex + opts.chunkSize, cleanText.length)

    // Try to break at sentence boundary
    if (endIndex < cleanText.length) {
      const lastPeriod = cleanText.lastIndexOf(".", endIndex)
      const lastQuestion = cleanText.lastIndexOf("?", endIndex)
      const lastExclaim = cleanText.lastIndexOf("!", endIndex)

      const sentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim)

      if (sentenceEnd > startIndex + opts.minChunkSize) {
        endIndex = sentenceEnd + 1
      }
    }

    const chunk = cleanText.slice(startIndex, endIndex).trim()

    if (chunk.length >= opts.minChunkSize) {
      chunks.push({
        content: chunk,
        startIndex,
        endIndex,
      })
    }

    // Move start with overlap
    startIndex = endIndex - opts.overlapSize
    if (startIndex >= cleanText.length - opts.minChunkSize) {
      break
    }
  }

  return chunks
}

export function chunkMultiple(
  sources: Array<{ url: string; content: string }>,
  options: ChunkerOptions = {}
): Array<{ url: string; chunks: TextChunk[] }> {
  return sources.map((source) => ({
    url: source.url,
    chunks: chunkText(source.content, options),
  }))
}
