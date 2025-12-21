import path from "node:path"
import { promises as fs } from "node:fs"
import { spawn } from "node:child_process"

function runCommand(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
    })

    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`))
    })
  })
}

function runCommandCapture(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  return new Promise<{ output: string; code: number }>((resolve) => {
    const child = spawn(command, args, {
      stdio: ["inherit", "pipe", "inherit"],
      env: { ...process.env, ...env },
    })

    let output = ""
    child.stdout?.on("data", (data) => {
      output += data.toString()
    })

    child.on("close", (code) => {
      resolve({ output, code: code ?? 1 })
    })
  })
}

async function main() {
  const root = process.cwd()
  const tsxBin = path.join(root, "node_modules", ".bin", "tsx")
  const playwrightBin = path.join(root, "node_modules", ".bin", "playwright")
  const playwrightResultsPath = path.join(root, "audit", "marketing-playwright-results.json")

  await runCommand(tsxBin, ["scripts/marketing-content-audit/seed-registry.ts"])

  if (process.env.RUN_PLAYWRIGHT === "true") {
    const { output, code } = await runCommandCapture(playwrightBin, [
      "test",
      "-c",
      "tests/marketing-audit/playwright.config.ts",
      "--reporter=json",
    ])

    await fs.mkdir(path.dirname(playwrightResultsPath), { recursive: true })
    await fs.writeFile(playwrightResultsPath, output, "utf8")

    if (code !== 0) {
      console.warn("Playwright reported failures; continuing to generate report.")
    }
  }

  const reportEnv: NodeJS.ProcessEnv = {}
  if (process.env.RUN_PLAYWRIGHT === "true") {
    reportEnv.MARKETING_AUDIT_PLAYWRIGHT_RESULTS = playwrightResultsPath
  }

  await runCommand(tsxBin, ["scripts/marketing-content-audit/generate-report.ts"], reportEnv)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
