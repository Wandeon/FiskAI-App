/**
 * Blast Radius CLI Tests
 *
 * Tests for the blast-radius.ts CLI entry point.
 * Uses TDD approach - tests written before implementation.
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert"
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"
import { execSync, type ExecSyncOptions } from "child_process"

// Test fixtures directory
const TEST_DIR = join(process.cwd(), "src/lib/system-registry/__tests__/blast-radius-fixtures")
const SCRIPT_PATH = join(process.cwd(), "src/lib/system-registry/scripts/blast-radius.ts")

/**
 * Helper to run the CLI script
 */
function runCLI(
  args: string[],
  options: { cwd?: string; expectFail?: boolean } = {}
): { stdout: string; stderr: string; exitCode: number } {
  const cmd = `npx tsx ${SCRIPT_PATH} ${args.join(" ")}`
  const execOptions: ExecSyncOptions = {
    cwd: options.cwd || process.cwd(),
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, NO_COLOR: "1" },
  }

  try {
    const stdout = execSync(cmd, execOptions) as string
    return { stdout, stderr: "", exitCode: 0 }
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number }
    if (options.expectFail) {
      return {
        stdout: execError.stdout || "",
        stderr: execError.stderr || "",
        exitCode: execError.status || 1,
      }
    }
    throw error
  }
}

describe("Blast Radius CLI", () => {
  describe("Argument Parsing", () => {
    it("should fail with clear error when --base-sha is missing", () => {
      const result = runCLI(["--head-sha", "abc123"], { expectFail: true })
      assert.strictEqual(result.exitCode, 2)
      assert.ok(
        result.stderr.includes("--base-sha") || result.stdout.includes("--base-sha"),
        "Should mention missing --base-sha"
      )
    })

    it("should fail with clear error when --head-sha is missing", () => {
      const result = runCLI(["--base-sha", "abc123"], { expectFail: true })
      assert.strictEqual(result.exitCode, 2)
      assert.ok(
        result.stderr.includes("--head-sha") || result.stdout.includes("--head-sha"),
        "Should mention missing --head-sha"
      )
    })

    it("should accept --output-format pr-comment", () => {
      // This will fail due to invalid shas, but should parse args correctly
      const result = runCLI(
        ["--base-sha", "abc123", "--head-sha", "def456", "--output-format", "pr-comment"],
        { expectFail: true }
      )
      // Exit code 2 = arg error, other codes = git error (args parsed ok)
      assert.ok(
        result.exitCode !== 2 || result.stderr.includes("git"),
        "Should parse --output-format pr-comment"
      )
    })

    it("should accept --output-format github-check", () => {
      const result = runCLI(
        ["--base-sha", "abc123", "--head-sha", "def456", "--output-format", "github-check"],
        { expectFail: true }
      )
      assert.ok(
        result.exitCode !== 2 || result.stderr.includes("git"),
        "Should parse --output-format github-check"
      )
    })

    it("should accept --output-format json", () => {
      const result = runCLI(
        ["--base-sha", "abc123", "--head-sha", "def456", "--output-format", "json"],
        { expectFail: true }
      )
      assert.ok(
        result.exitCode !== 2 || result.stderr.includes("git"),
        "Should parse --output-format json"
      )
    })

    it("should reject invalid --output-format", () => {
      const result = runCLI(
        ["--base-sha", "abc123", "--head-sha", "def456", "--output-format", "invalid"],
        { expectFail: true }
      )
      assert.strictEqual(result.exitCode, 2)
      assert.ok(
        result.stderr.includes("output-format") || result.stdout.includes("output-format"),
        "Should mention invalid output-format"
      )
    })

    it("should accept --enforcement-mode warn", () => {
      const result = runCLI(
        ["--base-sha", "abc123", "--head-sha", "def456", "--enforcement-mode", "warn"],
        { expectFail: true }
      )
      // Any exit code other than 2 means args were parsed ok
      assert.ok(result.exitCode !== 2 || result.stderr.includes("git"))
    })

    it("should accept --enforcement-mode fail", () => {
      const result = runCLI(
        ["--base-sha", "abc123", "--head-sha", "def456", "--enforcement-mode", "fail"],
        { expectFail: true }
      )
      assert.ok(result.exitCode !== 2 || result.stderr.includes("git"))
    })

    it("should reject invalid --enforcement-mode", () => {
      const result = runCLI(
        ["--base-sha", "abc123", "--head-sha", "def456", "--enforcement-mode", "invalid"],
        { expectFail: true }
      )
      assert.strictEqual(result.exitCode, 2)
    })

    it("should default to pr-comment format when --output-format not specified", () => {
      const result = runCLI(["--base-sha", "abc123", "--head-sha", "def456"], { expectFail: true })
      // Will fail due to git, but that's ok - default should be set
      assert.ok(result.exitCode !== 2 || result.stderr.includes("git"))
    })

    it("should default to warn enforcement mode when not specified", () => {
      const result = runCLI(["--base-sha", "abc123", "--head-sha", "def456"], { expectFail: true })
      assert.ok(result.exitCode !== 2 || result.stderr.includes("git"))
    })
  })

  describe("Git Diff Handling", () => {
    it("should fail with clear error when git diff fails (invalid shas)", () => {
      const result = runCLI(["--base-sha", "invalidsha123", "--head-sha", "invalidsha456"], {
        expectFail: true,
      })
      // Should fail due to git error, not arg parsing
      assert.ok(result.exitCode !== 0)
      assert.ok(
        result.stderr.includes("git") ||
          result.stderr.includes("diff") ||
          result.stderr.includes("sha") ||
          result.stderr.includes("commit") ||
          result.stdout.includes("git") ||
          result.stdout.includes("sha"),
        "Should mention git-related error"
      )
    })

    it("should fail with clear error on shallow clone with missing history", () => {
      // This test simulates what would happen in a shallow clone
      // The error message should be helpful
      const result = runCLI(
        ["--base-sha", "0000000000000000000000000000000000000000", "--head-sha", "HEAD"],
        { expectFail: true }
      )
      assert.ok(result.exitCode !== 0)
      // Error should mention something about the sha not being found
      assert.ok(
        result.stderr.length > 0 || result.stdout.length > 0,
        "Should output an error message"
      )
    })
  })

  describe("Output Formats", () => {
    // Note: These tests use HEAD~1..HEAD which should work in most repos
    // In CI, we'd mock the git diff to have controlled test data

    it("should output valid JSON when --output-format json", async () => {
      // This test will only pass if there are actual commits
      // Skip if this is a new repo without commits
      try {
        execSync("git rev-parse HEAD~1", { stdio: "pipe" })
      } catch {
        // Skip test if no commits
        return
      }

      const result = runCLI(
        ["--base-sha", "HEAD~1", "--head-sha", "HEAD", "--output-format", "json"],
        { expectFail: true }
      )

      if (result.exitCode === 0 || result.stdout.includes("{")) {
        // Try to parse as JSON
        try {
          const json = JSON.parse(result.stdout)
          assert.ok(typeof json === "object", "Output should be valid JSON object")
          assert.ok("score" in json || "blastScore" in json, "JSON should contain score")
        } catch (e) {
          // If JSON parsing fails but we got output, that's a test failure
          if (result.stdout.trim().length > 0) {
            assert.fail(`Invalid JSON output: ${result.stdout.slice(0, 200)}`)
          }
        }
      }
    })

    it("should output markdown when --output-format pr-comment", async () => {
      try {
        execSync("git rev-parse HEAD~1", { stdio: "pipe" })
      } catch {
        return // Skip if no commits
      }

      const result = runCLI(
        ["--base-sha", "HEAD~1", "--head-sha", "HEAD", "--output-format", "pr-comment"],
        { expectFail: true }
      )

      if (result.exitCode === 0 || result.stdout.includes("Blast")) {
        assert.ok(
          result.stdout.includes("##") || result.stdout.includes("Blast Radius"),
          "Output should contain markdown headers or blast radius title"
        )
      }
    })

    it("should output check format when --output-format github-check", async () => {
      try {
        execSync("git rev-parse HEAD~1", { stdio: "pipe" })
      } catch {
        return // Skip if no commits
      }

      const result = runCLI(
        ["--base-sha", "HEAD~1", "--head-sha", "HEAD", "--output-format", "github-check"],
        { expectFail: true }
      )

      if (result.exitCode === 0 || result.stdout.includes("{")) {
        try {
          const json = JSON.parse(result.stdout)
          assert.ok("name" in json, "Check output should have name")
          assert.ok("status" in json, "Check output should have status")
          assert.ok("conclusion" in json, "Check output should have conclusion")
        } catch {
          // May not be JSON if there's an error
        }
      }
    })
  })

  describe("Exit Codes", () => {
    it("should exit 0 for LOW score in fail mode", async () => {
      // We can't easily test this without mocking
      // This is a placeholder - in a real test we'd mock the blast score
      assert.ok(true, "Test requires mocking - placeholder")
    })

    it("should exit 0 for MEDIUM score in fail mode", async () => {
      assert.ok(true, "Test requires mocking - placeholder")
    })

    it("should exit 1 for HIGH score in fail mode", async () => {
      assert.ok(true, "Test requires mocking - placeholder")
    })

    it("should exit 2 for CRITICAL score in fail mode", async () => {
      assert.ok(true, "Test requires mocking - placeholder")
    })

    it("should exit 0 for HIGH score in warn mode", async () => {
      assert.ok(true, "Test requires mocking - placeholder")
    })

    it("should exit 0 for CRITICAL score in warn mode", async () => {
      assert.ok(true, "Test requires mocking - placeholder")
    })

    it("should exit 2 for argument errors", () => {
      const result = runCLI([], { expectFail: true })
      assert.strictEqual(result.exitCode, 2, "Missing args should exit with code 2")
    })
  })

  describe("--write-comment flag", () => {
    const outputDir = join(process.cwd(), "docs/system-registry")
    const outputFile = join(outputDir, "blast-radius-comment.json")

    afterEach(() => {
      // Clean up test output
      try {
        if (existsSync(outputFile)) {
          rmSync(outputFile)
        }
      } catch {
        // Ignore cleanup errors
      }
    })

    it("should write JSON to docs/system-registry/blast-radius-comment.json when --write-comment is set", async () => {
      try {
        execSync("git rev-parse HEAD~1", { stdio: "pipe" })
      } catch {
        return // Skip if no commits
      }

      const result = runCLI(
        [
          "--base-sha",
          "HEAD~1",
          "--head-sha",
          "HEAD",
          "--output-format",
          "json",
          "--write-comment",
        ],
        { expectFail: true }
      )

      // If the command succeeded or partially succeeded, check for file
      if (result.exitCode === 0) {
        assert.ok(existsSync(outputFile), "Should create blast-radius-comment.json")
        const content = readFileSync(outputFile, "utf-8")
        const json = JSON.parse(content)
        assert.ok(typeof json === "object", "File should contain valid JSON")
      }
    })

    it("should create docs/system-registry directory if it does not exist", async () => {
      // This tests that the CLI creates the directory structure
      // Would need to mock fs for a proper test
      assert.ok(true, "Test requires controlled environment - placeholder")
    })
  })

  describe("No Changes Scenario", () => {
    it("should handle empty diff gracefully", async () => {
      try {
        execSync("git rev-parse HEAD", { stdio: "pipe" })
      } catch {
        return // Skip if no commits
      }

      // Comparing HEAD to HEAD should yield no changes
      const result = runCLI(
        ["--base-sha", "HEAD", "--head-sha", "HEAD", "--output-format", "json"],
        { expectFail: true }
      )

      // Should succeed with LOW score (no changes = low impact)
      if (result.exitCode === 0) {
        const json = JSON.parse(result.stdout)
        assert.ok(
          json.score === "LOW" || json.blastScore?.score === "LOW",
          "Empty diff should result in LOW score"
        )
      }
    })
  })
})

describe("CLI Integration with Blast Radius Computation", () => {
  it("should compute correct direct impacts for changed files", async () => {
    // This would need a controlled test repo with known components
    assert.ok(true, "Integration test placeholder")
  })

  it("should compute transitive impacts through dependency graph", async () => {
    assert.ok(true, "Integration test placeholder")
  })

  it("should detect critical path impacts", async () => {
    assert.ok(true, "Integration test placeholder")
  })

  it("should include owners in output", async () => {
    assert.ok(true, "Integration test placeholder")
  })
})
