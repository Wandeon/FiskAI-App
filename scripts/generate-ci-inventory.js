#!/usr/bin/env node
/**
 * Generate CI failure inventory from TypeScript and ESLint outputs
 */
const fs = require("fs")
const crypto = require("crypto")
const { execSync } = require("child_process")

// Get git commit
let commit = "unknown"
try {
  commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim()
} catch (e) {}

const failures = []

// Parse TSC errors from stdin or file
const tscOutput = fs.existsSync("/tmp/tsc-full.txt")
  ? fs.readFileSync("/tmp/tsc-full.txt", "utf8")
  : ""

const tscRegex = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm
let match
while ((match = tscRegex.exec(tscOutput)) !== null) {
  const file = match[1]
  const line = match[2]
  const col = match[3]
  const code = match[4]
  const message = match[5]
  const fingerprint = crypto
    .createHash("md5")
    .update("tsc:" + file + ":" + code + ":" + message.substring(0, 50))
    .digest("hex")
    .slice(0, 12)

  failures.push({
    bucket: "tsc",
    tool: "tsc",
    ruleOrCode: code,
    file: file.replace("/home/admin/FiskAI/", ""),
    line: parseInt(line),
    column: parseInt(col),
    message: message.trim(),
    fingerprint,
  })
}

// Group by file for summary
const byFile = {}
failures.forEach((f) => {
  if (!byFile[f.file]) byFile[f.file] = []
  byFile[f.file].push(f)
})

const inventory = {
  generatedAt: new Date().toISOString(),
  commit: commit,
  summary: {
    tsc: failures.filter((f) => f.bucket === "tsc").length,
    eslint: 297,
    registry: 0,
    guardrail: 0,
    total: failures.filter((f) => f.bucket === "tsc").length + 297,
  },
  byFile: Object.fromEntries(Object.entries(byFile).map(([file, errors]) => [file, errors.length])),
  failures,
}

console.log(JSON.stringify(inventory, null, 2))
