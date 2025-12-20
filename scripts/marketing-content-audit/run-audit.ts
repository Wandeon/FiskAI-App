import path from "node:path"
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

async function main() {
  const root = process.cwd()
  const tsxBin = path.join(root, "node_modules", ".bin", "tsx")
  const playwrightBin = path.join(root, "node_modules", ".bin", "playwright")

  await runCommand(tsxBin, ["scripts/marketing-content-audit/seed-registry.ts"])
  await runCommand(tsxBin, ["scripts/marketing-content-audit/generate-report.ts"])

  if (process.env.RUN_PLAYWRIGHT === "true") {
    await runCommand(playwrightBin, [
      "test",
      "-c",
      "tests/marketing-audit/playwright.config.ts",
    ])
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
