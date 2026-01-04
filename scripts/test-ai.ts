/**
 * Test script for AI/OCR features
 *
 * Usage:
 *   npm install tsx --save-dev
 *   npx tsx scripts/test-ai.ts
 *
 * Or set OPENAI_API_KEY environment variable first
 */

import { extractReceipt } from "../src/lib/ai/extract"
import { suggestCategory } from "../src/lib/ai/categorize"

const SAMPLE_RECEIPT_TEXT = `
KONZUM d.d.
OIB: 12345678901
Datum: 15.01.2024

MLIJEKO 2.5%        2x    5,99 EUR    11,98 EUR
KRUH BIJELI         1x    2,50 EUR     2,50 EUR
JAJA M              1x    3,20 EUR     3,20 EUR

Neto:                                 14,14 EUR
PDV 25%:                               3,54 EUR
--------------------------------
UKUPNO:                               17,68 EUR

Plaćeno karticom
Hvala na kupnji!
`

async function testExtraction() {
  console.log("🧪 Testing Receipt Extraction...\n")
  console.log("Sample receipt:")
  console.log(SAMPLE_RECEIPT_TEXT)
  console.log("\n" + "=".repeat(50) + "\n")

  const result = await extractReceipt(SAMPLE_RECEIPT_TEXT)

  if (result.success && result.data) {
    console.log("✅ Extraction successful!\n")
    console.log("Extracted data:")
    console.log(JSON.stringify(result.data, null, 2))
    console.log("\n" + "=".repeat(50) + "\n")
  } else {
    console.error("❌ Extraction failed:", result.error)
  }
}

async function testCategorization() {
  console.log("🧪 Testing Category Suggestions...\n")

  const testCases = [
    { description: "Toner za printer HP", vendor: "Tisak" },
    { description: "Gorivo diesel", vendor: "INA" },
    { description: "Internet pretplata", vendor: "A1" },
    { description: "Papir A4, olovke", vendor: "Konzum" },
  ]

  for (const testCase of testCases) {
    console.log(`Input: "${testCase.description}" from ${testCase.vendor}`)

    // Note: This would need a real company ID and database connection
    // For now, it will fail but shows how to use the function
    try {
      const suggestions = await suggestCategory(testCase.description, "test-company-id")

      console.log("Suggestions:")
      suggestions.forEach((s) => {
        console.log(`  - ${s.categoryName} (${(s.confidence * 100).toFixed(0)}%)`)
      })
    } catch (error) {
      console.log("  ⚠️  Skipping (requires database connection)")
    }
    console.log("")
  }
}

async function main() {
  console.log("FiskAI - AI/OCR Feature Tests")
  console.log("=".repeat(50))
  console.log("")

  if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠️  Warning: OPENAI_API_KEY not set")
    console.warn("   Extraction tests will fail without it")
    console.log("")
  }

  try {
    await testExtraction()
    await testCategorization()
    console.log("✅ All tests completed!")
  } catch (error) {
    console.error("❌ Test failed:", error)
    process.exit(1)
  }
}

main()
