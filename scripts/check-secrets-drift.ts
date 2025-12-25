#!/usr/bin/env npx tsx
// scripts/check-secrets-drift.ts
// Checks for hardcoded secrets and environment variable drift across config files
// Run with: npx tsx scripts/check-secrets-drift.ts

import { readFileSync, existsSync, readdirSync, statSync } from "fs"
import { join, relative } from "path"

interface SecretIssue {
  file: string
  line: number
  type: "HARDCODED_SECRET" | "ENV_VAR_MISSING" | "ENV_VAR_MISMATCH"
  description: string
  severity: "critical" | "warning" | "info"
}

// Patterns that indicate hardcoded secrets
const SECRET_PATTERNS = [
  // Database passwords in URLs
  { pattern: /postgresql:\/\/\w+:[^@${}]+@/g, name: "Hardcoded DB password" },
  { pattern: /DATABASE_URL=\S*:[^@${}]+@/g, name: "Hardcoded DB password in env" },

  // API keys
  { pattern: /['"](sk-[a-zA-Z0-9]{20,})['"]/g, name: "OpenAI API key" },
  { pattern: /['"]AIza[a-zA-Z0-9_-]{35}['"]/g, name: "Google API key" },
  { pattern: /xox[baprs]-[a-zA-Z0-9-]+/g, name: "Slack token" },

  // AWS credentials
  { pattern: /AKIA[0-9A-Z]{16}/g, name: "AWS Access Key ID" },
  { pattern: /['"]\w{40}['"]/g, name: "Potential AWS Secret (40 chars)" },

  // Generic patterns
  { pattern: /password\s*[:=]\s*['"][^${}'"]{8,}['"]/gi, name: "Password assignment" },
  { pattern: /secret\s*[:=]\s*['"][^${}'"]{8,}['"]/gi, name: "Secret assignment" },
  { pattern: /api[_-]?key\s*[:=]\s*['"][^${}'"]{16,}['"]/gi, name: "API key assignment" },
]

// Docker compose files that should use environment variable interpolation
// (not .env files which are expected to have actual values)
// Excludes docker-compose.dev.yml since it's for local development with intentional dev passwords
const CONFIG_FILES_TO_CHECK = [
  "docker-compose.yml",
  "docker-compose.workers.yml",
  "docker-compose.override.yml",
]

// Required environment variables for each deployment context
const _REQUIRED_ENV_VARS = {
  production: ["DATABASE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "REDIS_URL"],
  workers: ["DATABASE_URL", "REDIS_URL", "ANTHROPIC_API_KEY"],
}

// Files to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.next/,
  /dist/,
  /\.env\.example/,
  /\.env\.local/, // Local dev files are okay to have actual values
  /\.env\.development/, // Dev files are okay
  /\.env\.production/, // Production .env files are expected to have values
  /\.env$/, // Main .env file is expected to have values
  /\.test\./,
  /\.spec\./,
  /__tests__/,
  /fixtures/,
  /\.worktrees/, // Git worktrees are separate
  /docs\//, // Documentation may have example passwords
  /\.md$/, // Markdown files may have examples
  /\.sh$/, // Shell scripts may have defaults
  /ONBOARDING/, // Onboarding docs have examples
  /DEPLOYMENT/, // Deployment docs have examples
  /docker-compose\.dev\.yml$/, // Dev compose has intentional dev passwords
]

function shouldSkipFile(filePath: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(filePath))
}

function scanFileForSecrets(filePath: string, content: string): SecretIssue[] {
  const issues: SecretIssue[] = []
  const lines = content.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    const trimmedLine = line.trim()

    // Skip comment lines
    if (
      trimmedLine.startsWith("#") ||
      trimmedLine.startsWith("//") ||
      trimmedLine.startsWith("*")
    ) {
      continue
    }

    for (const { pattern, name } of SECRET_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0
      if (pattern.test(line)) {
        // Don't flag if it's using environment variable interpolation
        if (!line.includes("${") && !line.includes("$DATABASE_URL")) {
          issues.push({
            file: filePath,
            line: lineNum,
            type: "HARDCODED_SECRET",
            description: `${name} detected`,
            severity: "critical",
          })
        }
      }
    }
  }

  return issues
}

function scanDirectory(dir: string, relativeTo: string = dir): SecretIssue[] {
  const issues: SecretIssue[] = []

  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const relPath = relative(relativeTo, fullPath)

    if (shouldSkipFile(fullPath)) continue

    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      issues.push(...scanDirectory(fullPath, relativeTo))
    } else if (stat.isFile()) {
      // Only scan text files
      const ext = entry.split(".").pop()?.toLowerCase()
      const textExts = ["ts", "js", "json", "yml", "yaml", "env", "sh", "md"]

      if (textExts.includes(ext || "") || entry.startsWith(".env")) {
        try {
          const content = readFileSync(fullPath, "utf-8")
          issues.push(...scanFileForSecrets(relPath, content))
        } catch {
          // Skip files that can't be read
        }
      }
    }
  }

  return issues
}

function checkEnvVarConsistency(rootDir: string): SecretIssue[] {
  const issues: SecretIssue[] = []

  // Check .env.example exists
  const envExamplePath = join(rootDir, ".env.example")
  if (!existsSync(envExamplePath)) {
    issues.push({
      file: ".env.example",
      line: 0,
      type: "ENV_VAR_MISSING",
      description: ".env.example file is missing",
      severity: "warning",
    })
    return issues
  }

  const envExample = readFileSync(envExamplePath, "utf-8")
  const _exampleVars = new Set(
    envExample
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => line.split("=")[0].trim())
  )

  // Check docker-compose files use env var interpolation
  for (const configFile of CONFIG_FILES_TO_CHECK) {
    const configPath = join(rootDir, configFile)
    if (!existsSync(configPath)) continue

    const content = readFileSync(configPath, "utf-8")
    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check for hardcoded values in environment sections
      if (line.includes("DATABASE_URL=") && !line.includes("${")) {
        // Allow defaulting with ${VAR:-default} syntax
        if (!line.includes(":-")) {
          issues.push({
            file: configFile,
            line: i + 1,
            type: "HARDCODED_SECRET",
            description: "DATABASE_URL should use ${DATABASE_URL} interpolation",
            severity: "critical",
          })
        }
      }
    }
  }

  return issues
}

async function main() {
  console.log("🔐 Checking for secrets drift...\n")

  const rootDir = process.cwd()
  const allIssues: SecretIssue[] = []

  // Scan source files
  console.log("Scanning source files...")
  allIssues.push(...scanDirectory(rootDir, rootDir))

  // Check environment variable consistency
  console.log("Checking environment variable consistency...")
  allIssues.push(...checkEnvVarConsistency(rootDir))

  // Print results
  console.log("")
  console.log("=".repeat(60))
  console.log("SECRETS DRIFT CHECK RESULTS")
  console.log("=".repeat(60))

  const critical = allIssues.filter((i) => i.severity === "critical")
  const warnings = allIssues.filter((i) => i.severity === "warning")
  const info = allIssues.filter((i) => i.severity === "info")

  console.log(`🔴 Critical: ${critical.length}`)
  console.log(`🟡 Warnings: ${warnings.length}`)
  console.log(`🔵 Info: ${info.length}`)
  console.log("")

  if (critical.length > 0) {
    console.log("CRITICAL ISSUES:")
    for (const issue of critical) {
      console.log(`  ${issue.file}:${issue.line} - ${issue.description}`)
    }
    console.log("")
  }

  if (warnings.length > 0) {
    console.log("WARNINGS:")
    for (const issue of warnings) {
      console.log(`  ${issue.file}:${issue.line} - ${issue.description}`)
    }
    console.log("")
  }

  if (allIssues.length === 0) {
    console.log("✅ No secrets drift detected!")
  } else {
    console.log(`\n❌ Found ${allIssues.length} issue(s)`)
  }

  // Exit with error if critical issues found
  process.exit(critical.length > 0 ? 1 : 0)
}

main().catch(console.error)
