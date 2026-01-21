#!/usr/bin/env npx tsx
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { dbReg } = await import("../src/lib/db")
  const { parseProvisionTree, stripHtml } =
    await import("../src/lib/regulatory-truth/extraction/chunk-planner")

  const evidence = await dbReg.evidence.findUnique({
    where: { id: "cmkivgiit001801rtfn33iza3" },
    select: { rawContent: true },
  })

  const text = stripHtml(evidence?.rawContent || "")

  // Parse into articles
  const tree = parseProvisionTree(text)

  // Search for mentions of članak 57.* in each article
  console.log("Searching for članak 57.* references in articles:")
  for (const article of tree) {
    if (article.text.match(/članak\s*57\./i) || article.text.match(/članaka?\s*57\./i)) {
      console.log(`\nArticle ${article.number} contains 57.* reference:`)
      console.log(`  First 300 chars: "${article.text.slice(0, 300)}..."`)
      console.log(`  Full text length: ${article.text.length}`)
      console.log(`  First 57 mention at position: ${article.text.search(/57\./)}`)
    }
  }

  // Also check for the pattern in the full article text
  console.log("\n\nFull search for 'dodaju se' patterns:")
  for (const article of tree) {
    if (article.text.includes("57.")) {
      const match = article.text.match(/(dodaju se.{0,100}57\.[a-z]+)/i)
      if (match) {
        console.log(`Article ${article.number}: "${match[1]}"`)
      }
    }
  }

  await dbReg.$disconnect()
}

main().catch(console.error)
