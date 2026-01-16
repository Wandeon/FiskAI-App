// scripts/debug-normalized-match.ts
// Debug why normalized matching fails even when content seems similar

import "dotenv/config"
import { db, dbReg } from "../src/lib/db"
import { getExtractableContent } from "../src/lib/regulatory-truth/utils/content-provider"
import {
  findQuoteInEvidence,
  normalizeForMatch,
} from "../src/lib/regulatory-truth/utils/quote-in-evidence"

function showCharCodes(str: string, maxLen = 50): string {
  return str
    .slice(0, maxLen)
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0)
      if (code < 32 || code > 126) {
        return `[${code.toString(16).padStart(4, "0")}]`
      }
      return c
    })
    .join("")
}

async function debugMatch() {
  console.log("=== Debugging Normalized Match Failures ===\n")

  // Get a failing pointer with evidence that has content
  const failingPointer = await db.sourcePointer.findFirst({
    where: { matchType: "NOT_FOUND" },
    select: { id: true, evidenceId: true, exactQuote: true },
  })

  if (!failingPointer) {
    console.log("No failing pointers found")
    return
  }

  console.log(`Pointer: ${failingPointer.id.slice(0, 8)}...`)

  // Get evidence content
  let content: { text: string; source: string }
  try {
    content = await getExtractableContent(failingPointer.evidenceId)
  } catch (err) {
    console.log(`Error getting content: ${(err as Error).message}`)
    await db.$disconnect()
    return
  }

  console.log(`Content source: ${content.source}`)
  console.log(`Content length: ${content.text.length}`)

  const quote = failingPointer.exactQuote
  console.log(`\nQuote length: ${quote.length}`)
  console.log(`Quote (first 100): "${quote.slice(0, 100)}"`)

  // Normalize both
  const normQuote = normalizeForMatch(quote)
  const normContent = normalizeForMatch(content.text)

  console.log(`\nNormalized quote length: ${normQuote.length}`)
  console.log(`Normalized content length: ${normContent.length}`)

  // Try to find match
  const result = findQuoteInEvidence(content.text, quote)
  console.log(`\nMatch result: ${result.found ? "FOUND" : "NOT FOUND"}`)
  console.log(`Match type: ${result.matchType}`)

  // Check if normalized quote is in normalized content
  const normIndex = normContent.indexOf(normQuote)
  console.log(`\nNormalized index: ${normIndex}`)

  if (normIndex === -1) {
    // Try to find partial matches
    console.log("\n=== Investigating Why Normalized Match Fails ===")

    // Find first 20 chars
    const first20 = normQuote.slice(0, 20)
    const first20Index = normContent.indexOf(first20)
    console.log(`\nFirst 20 chars: "${first20}"`)
    console.log(`Found at index: ${first20Index}`)

    if (first20Index !== -1) {
      // Compare char by char from that point
      console.log("\n=== Character-by-character comparison ===")

      const contentSlice = normContent.slice(first20Index, first20Index + normQuote.length + 20)

      console.log(`\nQuote chars (first 60):`)
      console.log(showCharCodes(normQuote, 60))

      console.log(`\nContent chars (from match point):`)
      console.log(showCharCodes(contentSlice, 60))

      // Find where they diverge
      let divergeAt = -1
      for (let i = 0; i < Math.min(normQuote.length, contentSlice.length); i++) {
        if (normQuote[i] !== contentSlice[i]) {
          divergeAt = i
          break
        }
      }

      if (divergeAt !== -1) {
        console.log(`\n*** Divergence at position ${divergeAt} ***`)
        console.log(
          `Quote char: "${normQuote[divergeAt]}" (0x${normQuote.charCodeAt(divergeAt).toString(16)})`
        )
        console.log(
          `Content char: "${contentSlice[divergeAt]}" (0x${contentSlice.charCodeAt(divergeAt).toString(16)})`
        )

        console.log(`\nContext around divergence:`)
        const start = Math.max(0, divergeAt - 10)
        const end = Math.min(divergeAt + 30, normQuote.length)
        console.log(`Quote: "...${normQuote.slice(start, end)}..."`)
        console.log(`Content: "...${contentSlice.slice(start, end)}..."`)
      }
    }

    // Try shorter substrings
    console.log("\n=== Finding longest matching prefix ===")
    let longestMatch = 0
    for (let len = 10; len <= normQuote.length; len += 10) {
      const prefix = normQuote.slice(0, len)
      if (normContent.includes(prefix)) {
        longestMatch = len
      } else {
        break
      }
    }
    console.log(`Longest matching prefix: ${longestMatch} chars`)
  }

  await db.$disconnect()
}

debugMatch().catch(console.error)
