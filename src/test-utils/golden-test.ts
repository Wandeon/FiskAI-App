// src/test-utils/golden-test.ts
import fs from "fs"
import path from "path"
import { expect } from "vitest"

/**
 * Normalize XML for golden test comparison.
 * Removes dynamic values that change between runs.
 */
export function normalizeXml(
  xml: string,
  options: {
    /** Replace UUID patterns with stable placeholder */
    normalizeIds?: boolean
    /** Replace timestamp patterns with stable placeholder */
    normalizeTimestamps?: boolean
    /** Replace ZKI with stable placeholder */
    normalizeZki?: boolean
    /** Custom replacements: [pattern, replacement][] */
    customReplacements?: [RegExp, string][]
  } = {}
): string {
  let normalized = xml

  if (options.normalizeIds !== false) {
    // Replace UUIDs (IdPoruke)
    normalized = normalized.replace(
      /<tns:IdPoruke>[^<]+<\/tns:IdPoruke>/g,
      "<tns:IdPoruke>STABLE-UUID</tns:IdPoruke>"
    )
    // Replace other UUID patterns
    normalized = normalized.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "STABLE-UUID"
    )
  }

  if (options.normalizeTimestamps !== false) {
    // Replace ISO timestamps (DatumVrijeme)
    normalized = normalized.replace(
      /<tns:DatumVrijeme>[^<]+<\/tns:DatumVrijeme>/g,
      "<tns:DatumVrijeme>STABLE-TIMESTAMP</tns:DatumVrijeme>"
    )
    // Replace dd.MM.yyyyTHH:mm:ss format
    normalized = normalized.replace(/\d{2}\.\d{2}\.\d{4}T\d{2}:\d{2}:\d{2}/g, "STABLE-TIMESTAMP")
  }

  if (options.normalizeZki !== false) {
    // Replace ZKI (ZastKod) - 32 char hex string
    normalized = normalized.replace(
      /<tns:ZastKod>[0-9a-fA-F]{32}<\/tns:ZastKod>/g,
      "<tns:ZastKod>STABLE-ZKI</tns:ZastKod>"
    )
  }

  if (options.customReplacements) {
    for (const [pattern, replacement] of options.customReplacements) {
      normalized = normalized.replace(pattern, replacement)
    }
  }

  return normalized.trim()
}

/**
 * Assert that actual output matches golden fixture.
 *
 * If fixture doesn't exist, creates it with the actual output.
 * This allows running tests to generate initial fixtures.
 *
 * @param actual - The actual output to compare
 * @param fixturePath - Path to the fixture file (relative to test file or absolute)
 * @param testFilePath - __dirname of the test file (for relative fixture paths)
 */
export function assertMatchesGolden(
  actual: string,
  fixturePath: string,
  testFilePath?: string
): void {
  const absolutePath = path.isAbsolute(fixturePath)
    ? fixturePath
    : testFilePath
      ? path.join(testFilePath, fixturePath)
      : fixturePath

  const normalized = actual.trim()

  if (!fs.existsSync(absolutePath)) {
    // Create fixture directory if needed
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    // Write the fixture
    fs.writeFileSync(absolutePath, normalized, "utf8")
    console.log(`📸 Created new golden fixture: ${absolutePath}`)
    // Don't fail - just created the fixture
    return
  }

  const expected = fs.readFileSync(absolutePath, "utf8").trim()

  if (normalized !== expected) {
    // Show helpful diff info
    console.log("\n=== Golden test mismatch ===")
    console.log(`Fixture: ${absolutePath}`)
    console.log("--- Expected (fixture) ---")
    console.log(expected.substring(0, 500) + (expected.length > 500 ? "..." : ""))
    console.log("--- Actual ---")
    console.log(normalized.substring(0, 500) + (normalized.length > 500 ? "..." : ""))
    console.log("=== End mismatch ===\n")
  }

  expect(normalized).toBe(expected)
}

/**
 * Update an existing golden fixture.
 * Use this when you intentionally want to update the expected output.
 */
export function updateGoldenFixture(fixturePath: string, newContent: string): void {
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true })
  fs.writeFileSync(fixturePath, newContent.trim(), "utf8")
  console.log(`📸 Updated golden fixture: ${fixturePath}`)
}
