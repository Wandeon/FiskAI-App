// src/lib/regulatory-truth/scripts/verify-fiscal-data.ts

import { config } from "dotenv"
import { readFileSync } from "fs"
import { parse } from "dotenv"

// Load environment variables BEFORE importing any modules that use them
// .env.local has DATABASE_URL for local dev, .env has working OLLAMA keys
config({ path: ".env.local" })

// Load .env but only use OLLAMA vars (the API key in .env works)
try {
  const envContent = readFileSync(".env", "utf-8")
  const parsed = parse(envContent)
  // Override only OLLAMA vars from .env
  if (parsed.OLLAMA_API_KEY) process.env.OLLAMA_API_KEY = parsed.OLLAMA_API_KEY
  if (parsed.OLLAMA_ENDPOINT) process.env.OLLAMA_ENDPOINT = parsed.OLLAMA_ENDPOINT
  if (parsed.OLLAMA_MODEL) process.env.OLLAMA_MODEL = parsed.OLLAMA_MODEL
} catch {
  // .env may not exist
}

import { Pool } from "pg"
import { CONTRIBUTIONS } from "@/lib/fiscal-data/data/contributions"
import { TAX_RATES } from "@/lib/fiscal-data/data/tax-rates"
import { THRESHOLDS } from "@/lib/fiscal-data/data/thresholds"

// Create pool for direct SQL
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

interface VerificationResult {
  dataPoint: string
  currentValue: unknown
  sourcePointerValue: string | null
  status: "match" | "mismatch" | "no_data"
  sourcePointerIds: string[]
  domain: string
  confidence?: number
}

interface DataPointToVerify {
  path: string
  expectedValue: number
  domain: string
  label: string
}

/**
 * Compare existing fiscal-data values against extracted source pointers
 */
async function verifyFiscalData(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = []
  const client = await pool.connect()

  try {
    // Define key data points to verify
    const dataPoints: DataPointToVerify[] = [
      // Thresholds
      {
        path: "THRESHOLDS.pausalni.value",
        expectedValue: THRESHOLDS.pausalni.value,
        domain: "pausalni",
        label: "Paušalni revenue limit",
      },
      {
        path: "THRESHOLDS.pdv.value",
        expectedValue: THRESHOLDS.pdv.value,
        domain: "pdv",
        label: "VAT registration threshold",
      },
      {
        path: "THRESHOLDS.cashB2B.value",
        expectedValue: THRESHOLDS.cashB2B.value,
        domain: "pausalni",
        label: "Cash B2B transaction limit",
      },
      // Contribution Rates
      {
        path: "CONTRIBUTIONS.rates.MIO_I.rate",
        expectedValue: CONTRIBUTIONS.rates.MIO_I.rate,
        domain: "doprinosi",
        label: "MIO I pillar rate",
      },
      {
        path: "CONTRIBUTIONS.rates.MIO_II.rate",
        expectedValue: CONTRIBUTIONS.rates.MIO_II.rate,
        domain: "doprinosi",
        label: "MIO II pillar rate",
      },
      {
        path: "CONTRIBUTIONS.rates.HZZO.rate",
        expectedValue: CONTRIBUTIONS.rates.HZZO.rate,
        domain: "doprinosi",
        label: "Health insurance rate",
      },
      {
        path: "CONTRIBUTIONS.base.minimum",
        expectedValue: CONTRIBUTIONS.base.minimum,
        domain: "doprinosi",
        label: "Minimum contribution base",
      },
      {
        path: "CONTRIBUTIONS.base.maximum",
        expectedValue: CONTRIBUTIONS.base.maximum,
        domain: "doprinosi",
        label: "Maximum contribution base",
      },
      // Tax Rates
      {
        path: "TAX_RATES.pausal.rate",
        expectedValue: TAX_RATES.pausal.rate,
        domain: "pausalni",
        label: "Paušalni tax rate",
      },
      {
        path: "TAX_RATES.pausal.maxRevenue",
        expectedValue: TAX_RATES.pausal.maxRevenue,
        domain: "pausalni",
        label: "Paušalni max revenue",
      },
      {
        path: "TAX_RATES.vat.standard.rate",
        expectedValue: TAX_RATES.vat.standard.rate,
        domain: "pdv",
        label: "Standard VAT rate",
      },
      {
        path: "TAX_RATES.vat.reduced[0].rate",
        expectedValue: TAX_RATES.vat.reduced[0].rate,
        domain: "pdv",
        label: "Reduced VAT rate I",
      },
      {
        path: "TAX_RATES.vat.reduced[1].rate",
        expectedValue: TAX_RATES.vat.reduced[1].rate,
        domain: "pdv",
        label: "Reduced VAT rate II",
      },
      {
        path: "TAX_RATES.income.brackets[0].rate",
        expectedValue: TAX_RATES.income.brackets[0].rate,
        domain: "porez_dohodak",
        label: "Income tax lower bracket",
      },
      {
        path: "TAX_RATES.income.brackets[1].rate",
        expectedValue: TAX_RATES.income.brackets[1].rate,
        domain: "porez_dohodak",
        label: "Income tax upper bracket",
      },
      {
        path: "TAX_RATES.corporate.small.rate",
        expectedValue: TAX_RATES.corporate.small.rate,
        domain: "porez_dohodak",
        label: "Corporate tax small business",
      },
      {
        path: "TAX_RATES.corporate.large.rate",
        expectedValue: TAX_RATES.corporate.large.rate,
        domain: "porez_dohodak",
        label: "Corporate tax large business",
      },
    ]

    console.log(`\n[verify] Checking ${dataPoints.length} data points against source pointers...\n`)

    for (const dp of dataPoints) {
      // Find source pointers for this domain with high confidence
      const pointerResult = await client.query(
        `SELECT id, "extractedValue", "displayValue", domain, confidence, "exactQuote"
         FROM "SourcePointer"
         WHERE domain = $1 AND confidence >= 0.8
         ORDER BY confidence DESC, "createdAt" DESC
         LIMIT 20`,
        [dp.domain]
      )

      const pointers = pointerResult.rows

      const result: VerificationResult = {
        dataPoint: dp.path,
        currentValue: dp.expectedValue,
        sourcePointerValue: null,
        status: "no_data",
        sourcePointerIds: [],
        domain: dp.domain,
      }

      if (pointers.length > 0) {
        result.sourcePointerIds = pointers.map(
          (p: { id: string; extractedValue: string; confidence: number }) => p.id
        )

        // Try to find a matching value
        for (const pointer of pointers) {
          const extractedNum = parseFloat(pointer.extractedValue)
          const expectedNum =
            typeof dp.expectedValue === "number"
              ? dp.expectedValue
              : parseFloat(String(dp.expectedValue))

          if (!isNaN(extractedNum) && !isNaN(expectedNum)) {
            // Check if this is the closest match we've found
            if (result.sourcePointerValue === null) {
              result.sourcePointerValue = pointer.extractedValue
              result.confidence = pointer.confidence
            }

            // Check for exact or very close match (accounting for floating point)
            if (Math.abs(extractedNum - expectedNum) < 0.001) {
              result.status = "match"
              result.sourcePointerValue = pointer.extractedValue
              result.confidence = pointer.confidence
              break
            } else {
              result.status = "mismatch"
            }
          }
        }
      }

      results.push(result)

      // Pretty print status
      const statusIcon = result.status === "match" ? "✓" : result.status === "mismatch" ? "✗" : "○"
      const statusColor =
        result.status === "match"
          ? "\x1b[32m"
          : result.status === "mismatch"
            ? "\x1b[31m"
            : "\x1b[33m"
      const resetColor = "\x1b[0m"

      console.log(
        `${statusColor}${statusIcon}${resetColor} ${dp.label.padEnd(30)} | Expected: ${String(dp.expectedValue).padEnd(10)} | Found: ${result.sourcePointerValue || "N/A"} | Domain: ${dp.domain}`
      )
    }

    return results
  } finally {
    client.release()
  }
}

// CLI runner
if (require.main === module) {
  void verifyFiscalData()
    .then((results) => {
      console.log("\n" + "=".repeat(80))
      console.log("VERIFICATION SUMMARY")
      console.log("=".repeat(80))

      const matches = results.filter((r) => r.status === "match")
      const mismatches = results.filter((r) => r.status === "mismatch")
      const noData = results.filter((r) => r.status === "no_data")

      console.log(`\nTotal data points checked: ${results.length}`)
      console.log(`✓ Matches:                ${matches.length}`)
      console.log(`✗ Mismatches:             ${mismatches.length}`)
      console.log(`○ No source data:         ${noData.length}`)

      if (mismatches.length > 0) {
        console.log("\n" + "=".repeat(80))
        console.log("MISMATCHES DETECTED")
        console.log("=".repeat(80))
        mismatches.forEach((m) => {
          console.log(`\n${m.dataPoint}:`)
          console.log(`  Expected:     ${m.currentValue}`)
          console.log(`  Extracted:    ${m.sourcePointerValue}`)
          console.log(`  Domain:       ${m.domain}`)
          console.log(`  Confidence:   ${m.confidence}`)
          console.log(
            `  Pointer IDs:  ${m.sourcePointerIds.slice(0, 3).join(", ")}${m.sourcePointerIds.length > 3 ? "..." : ""}`
          )
        })
      }

      if (noData.length > 0) {
        console.log("\n" + "=".repeat(80))
        console.log("NO SOURCE DATA FOUND")
        console.log("=".repeat(80))
        noData.forEach((m) => {
          console.log(`  - ${m.dataPoint} (domain: ${m.domain})`)
        })
      }

      // Detailed comparison table
      console.log("\n" + "=".repeat(80))
      console.log("DETAILED COMPARISON")
      console.log("=".repeat(80))
      console.table(
        results.map((r) => ({
          "Data Point": r.dataPoint
            .replace("TAX_RATES.", "")
            .replace("THRESHOLDS.", "")
            .replace("CONTRIBUTIONS.", ""),
          Current: r.currentValue,
          Extracted: r.sourcePointerValue || "N/A",
          Status: r.status,
          Domain: r.domain,
          "Pointers Found": r.sourcePointerIds.length,
        }))
      )

      console.log("\n")

      void pool.end()
      process.exit(0)
    })
    .catch(async (error) => {
      console.error("\n[verify] Error:", error)
      await pool.end()
      process.exit(1)
    })
}

export { verifyFiscalData }
