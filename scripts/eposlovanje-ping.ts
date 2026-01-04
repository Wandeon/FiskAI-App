#!/usr/bin/env npx tsx
/**
 * ePoslovanje v2 API Ping Script
 *
 * Tests connectivity to ePoslovanje API v2 ping endpoint.
 * Designed to run from inside the app container.
 *
 * Usage:
 *   npx tsx scripts/eposlovanje-ping.ts
 *
 * Environment variables:
 *   EPOSLOVANJE_API_BASE - Base URL (e.g., https://test.eposlovanje.hr)
 *   EPOSLOVANJE_API_KEY - API key for Authorization header
 */

const apiBase =
  process.env.EPOSLOVANJE_API_BASE || process.env.EPOSLOVANJE_API_URL?.replace(/\/v1\/?$/, "") || ""
const apiKey = process.env.EPOSLOVANJE_API_KEY || ""

async function main() {
  console.log("=== ePoslovanje v2 Ping ===\n")

  // Print resolved base URL
  console.log(`Base URL: ${apiBase || "(NOT SET)"}`)
  console.log(`API Key: ${apiKey ? "[SET]" : "[NOT SET]"}`)

  if (!apiBase) {
    console.log("\nERROR: EPOSLOVANJE_API_BASE not set")
    process.exit(1)
  }

  const pingUrl = `${apiBase.replace(/\/$/, "")}/api/v2/ping`
  console.log(`Ping URL: ${pingUrl}\n`)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(pingUrl, {
      method: "GET",
      headers: {
        ...(apiKey ? { Authorization: apiKey } : {}),
        Accept: "application/json",
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    // Print HTTP code
    console.log(`HTTP Status: ${response.status}`)

    // Read response body
    const text = await response.text()

    // Print first 200 chars of response body
    const preview = text.length > 200 ? text.substring(0, 200) + "..." : text
    console.log(`Response Body: ${preview}`)

    // Summary
    console.log("\n=== Result ===")
    if (response.status === 200) {
      console.log("PING SUCCESS")
      process.exit(0)
    } else {
      console.log(`PING FAILED (HTTP ${response.status})`)
      process.exit(1)
    }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError"
    console.log(`HTTP Status: N/A (${isTimeout ? "TIMEOUT" : "NETWORK ERROR"})`)
    console.log(`Error: ${error instanceof Error ? error.message : "Unknown"}`)
    console.log("\n=== Result ===")
    console.log("PING FAILED (Connection Error)")
    process.exit(1)
  }
}

main()

// Make this a module to avoid duplicate function name conflicts
export {}
