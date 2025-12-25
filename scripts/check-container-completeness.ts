#!/usr/bin/env npx tsx
// scripts/check-container-completeness.ts
// Verifies that Docker worker containers include all required files and dependencies
// Run with: npx tsx scripts/check-container-completeness.ts

import { readFileSync, existsSync } from "fs"
import { join } from "path"

interface ContainerCheck {
  name: string
  status: "pass" | "fail" | "warn"
  message: string
}

const ROOT = process.cwd()

function readFile(path: string): string {
  const fullPath = join(ROOT, path)
  if (!existsSync(fullPath)) return ""
  return readFileSync(fullPath, "utf-8")
}

function checkDockerfile(): ContainerCheck[] {
  const checks: ContainerCheck[] = []
  const dockerfile = readFile("Dockerfile.worker")

  if (!dockerfile) {
    checks.push({
      name: "Dockerfile.worker exists",
      status: "fail",
      message: "Dockerfile.worker not found",
    })
    return checks
  }

  checks.push({
    name: "Dockerfile.worker exists",
    status: "pass",
    message: "Found Dockerfile.worker",
  })

  // Check for required packages
  const requiredPackages = [
    { name: "tesseract-ocr", pattern: /tesseract-ocr/i, purpose: "OCR for scanned PDFs" },
    {
      name: "tesseract-lang-hrv",
      pattern: /tesseract.*hrv|hrv.*tesseract/i,
      purpose: "Croatian language pack",
    },
    {
      name: "poppler-utils",
      pattern: /poppler-utils/i,
      purpose: "PDF processing (pdftoppm, pdfinfo)",
    },
  ]

  for (const pkg of requiredPackages) {
    const found = pkg.pattern.test(dockerfile)
    checks.push({
      name: `${pkg.name} installed`,
      status: found ? "pass" : "warn",
      message: found
        ? `✓ ${pkg.name} (${pkg.purpose})`
        : `⚠ ${pkg.name} not found (${pkg.purpose})`,
    })
  }

  // Check source code copying
  const copiesSrc = dockerfile.includes("COPY src/") || dockerfile.includes("COPY . ")
  checks.push({
    name: "Source code copied",
    status: copiesSrc ? "pass" : "fail",
    message: copiesSrc
      ? "COPY directive includes src/"
      : "Source code may not be copied to container",
  })

  // Check node_modules handling
  const hasNpmInstall = dockerfile.includes("npm install") || dockerfile.includes("pnpm install")
  const hasNodeModules = dockerfile.includes("node_modules")
  checks.push({
    name: "Dependencies installed",
    status: hasNpmInstall || hasNodeModules ? "pass" : "fail",
    message:
      hasNpmInstall || hasNodeModules
        ? "Dependencies will be installed"
        : "No npm/pnpm install found in Dockerfile",
  })

  // Check for required directories
  const requiredDirs = [
    { dir: "src/lib/regulatory-truth", pattern: /src\/lib\/regulatory-truth|src\// },
    { dir: "prisma", pattern: /prisma/ },
  ]

  for (const { dir, pattern } of requiredDirs) {
    const found = pattern.test(dockerfile)
    checks.push({
      name: `${dir} directory copied`,
      status: found ? "pass" : "warn",
      message: found ? `✓ ${dir} referenced` : `⚠ ${dir} may not be copied`,
    })
  }

  return checks
}

function checkDockerCompose(): ContainerCheck[] {
  const checks: ContainerCheck[] = []
  const compose = readFile("docker-compose.workers.yml")

  if (!compose) {
    checks.push({
      name: "docker-compose.workers.yml exists",
      status: "fail",
      message: "docker-compose.workers.yml not found",
    })
    return checks
  }

  checks.push({
    name: "docker-compose.workers.yml exists",
    status: "pass",
    message: "Found docker-compose.workers.yml",
  })

  // Check for required workers
  const requiredWorkers = [
    "worker-ocr",
    "worker-extractor",
    "worker-reviewer",
    "worker-continuous-drainer",
    "scheduler",
    "orchestrator",
  ]

  for (const worker of requiredWorkers) {
    const found = compose.includes(worker)
    checks.push({
      name: `${worker} service defined`,
      status: found ? "pass" : "warn",
      message: found ? `✓ ${worker}` : `⚠ ${worker} not found`,
    })
  }

  // Check for required environment variables
  const requiredEnvVars = ["DATABASE_URL", "REDIS_URL", "NODE_ENV"]

  for (const envVar of requiredEnvVars) {
    const found = compose.includes(envVar)
    checks.push({
      name: `${envVar} environment variable`,
      status: found ? "pass" : "warn",
      message: found ? `✓ ${envVar} configured` : `⚠ ${envVar} not found in compose`,
    })
  }

  // Check for hardcoded secrets (should use interpolation)
  const hasHardcodedSecrets =
    compose.includes("fiskai_secret") || compose.includes("fiskai_dev_password")

  // Check if using interpolation
  const usesInterpolation = compose.includes("${DATABASE_URL")

  checks.push({
    name: "Secrets use interpolation",
    status:
      usesInterpolation && !hasHardcodedSecrets ? "pass" : hasHardcodedSecrets ? "fail" : "warn",
    message: usesInterpolation
      ? "DATABASE_URL uses environment variable interpolation"
      : hasHardcodedSecrets
        ? "Hardcoded secrets detected - use ${VAR} interpolation"
        : "Check that sensitive values use environment variables",
  })

  // Check for healthchecks
  const hasHealthcheck = compose.includes("healthcheck")
  checks.push({
    name: "Service healthchecks",
    status: hasHealthcheck ? "pass" : "warn",
    message: hasHealthcheck
      ? "Healthchecks configured"
      : "⚠ No healthchecks found - consider adding for reliability",
  })

  return checks
}

function checkPackageJson(): ContainerCheck[] {
  const checks: ContainerCheck[] = []
  const packageJson = readFile("package.json")

  if (!packageJson) {
    checks.push({
      name: "package.json exists",
      status: "fail",
      message: "package.json not found",
    })
    return checks
  }

  const pkg = JSON.parse(packageJson)

  // Check for required dependencies
  const requiredDeps = [
    { name: "@prisma/client", purpose: "Database ORM" },
    { name: "bullmq", purpose: "Job queue" },
    { name: "pdf-parse", purpose: "PDF text extraction" },
    { name: "mammoth", purpose: "DOCX parsing" },
    { name: "xlsx", purpose: "Excel parsing" },
    { name: "word-extractor", purpose: "DOC parsing" },
    { name: "tesseract.js", purpose: "OCR fallback" },
  ]

  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  for (const dep of requiredDeps) {
    const found = dep.name in deps
    checks.push({
      name: `${dep.name} dependency`,
      status: found ? "pass" : "warn",
      message: found
        ? `✓ ${dep.name} (${dep.purpose})`
        : `⚠ ${dep.name} not found (${dep.purpose})`,
    })
  }

  return checks
}

async function main() {
  console.log("📦 Checking container completeness...\n")

  const allChecks: ContainerCheck[] = []

  // Check Dockerfile
  console.log("Checking Dockerfile.worker...")
  allChecks.push(...checkDockerfile())

  // Check docker-compose
  console.log("Checking docker-compose.workers.yml...")
  allChecks.push(...checkDockerCompose())

  // Check package.json
  console.log("Checking package.json...")
  allChecks.push(...checkPackageJson())

  // Print results
  console.log("")
  console.log("=".repeat(60))
  console.log("CONTAINER COMPLETENESS CHECK RESULTS")
  console.log("=".repeat(60))

  const passed = allChecks.filter((c) => c.status === "pass").length
  const warnings = allChecks.filter((c) => c.status === "warn").length
  const failed = allChecks.filter((c) => c.status === "fail").length

  console.log(`✅ Passed: ${passed}`)
  console.log(`⚠️  Warnings: ${warnings}`)
  console.log(`❌ Failed: ${failed}`)
  console.log("")

  // Print failed items
  const failedChecks = allChecks.filter((c) => c.status === "fail")
  if (failedChecks.length > 0) {
    console.log("FAILED CHECKS:")
    for (const check of failedChecks) {
      console.log(`  ❌ ${check.name}: ${check.message}`)
    }
    console.log("")
  }

  // Print warnings
  const warningChecks = allChecks.filter((c) => c.status === "warn")
  if (warningChecks.length > 0) {
    console.log("WARNINGS:")
    for (const check of warningChecks) {
      console.log(`  ⚠️  ${check.name}: ${check.message}`)
    }
    console.log("")
  }

  // Summary
  if (failed === 0) {
    console.log("✅ Container configuration is complete!")
  } else {
    console.log(`❌ ${failed} critical issue(s) found - container may not build correctly`)
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(console.error)
