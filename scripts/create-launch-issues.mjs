#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const REPO_ROOT = path.resolve(process.cwd(), "FiskAI")
const DOC_PATH = path.join(REPO_ROOT, "docs", "LAUNCH_GAPS.md")

function sh(args, options = {}) {
  return execFileSync(args[0], args.slice(1), {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim()
}

function trySh(args, options = {}) {
  try {
    return sh(args, options)
  } catch (error) {
    return ""
  }
}

function ensureInGitRepo() {
  const inside = trySh(["git", "rev-parse", "--is-inside-work-tree"])
  if (inside !== "true") {
    throw new Error("Not inside a git repository; run from the workspace root.")
  }
}

function ensureGhAuth() {
  // `gh auth status` writes to stderr; use exit code only.
  try {
    execFileSync("gh", ["auth", "status"], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "ignore", "ignore"],
    })
  } catch {
    throw new Error("GitHub CLI is not authenticated; run `gh auth login` first.")
  }
}

function ensureLabel({ name, description, color }) {
  const args = ["gh", "label", "create", name, "--description", description, "--color", color]
  const out = trySh(args)
  if (!out) {
    // likely already exists; that's fine
  }
}

function getExistingIssueTitles() {
  const json = trySh(["gh", "issue", "list", "--state", "all", "--limit", "500", "--json", "title"])
  if (!json) return new Set()
  const parsed = JSON.parse(json)
  return new Set(parsed.map((x) => x.title))
}

function createIssue({ title, body, labels }) {
  const tmp = path.join("/tmp", `fiskai_issue_${Date.now()}_${Math.random().toString(16).slice(2)}.md`)
  fs.writeFileSync(tmp, body)
  const args = ["gh", "issue", "create", "--title", title, "--body-file", tmp]
  for (const label of labels) args.push("--label", label)
  const output = sh(args)
  fs.unlinkSync(tmp)
  return output
}

function extractSection(md, headingRegex) {
  const flags = headingRegex.flags.includes("g") ? headingRegex.flags : `${headingRegex.flags}g`
  const globalRegex = new RegExp(headingRegex.source, flags)
  const matches = [...md.matchAll(globalRegex)]
  if (matches.length === 0) return null
  const start = matches[0].index
  if (start == null) return null

  const afterStart = md.slice(start)
  // End at next heading of same or higher level (# or ## or ###).
  const endMatch = afterStart.slice(1).match(/\n##?\s+|\n###\s+/)
  const end = endMatch ? start + 1 + endMatch.index : md.length
  return md.slice(start, end).trim()
}

function extractTripleHashSections(md) {
  const headerMatches = [...md.matchAll(/^###\s+(.*)$/gm)]
  const sections = []
  for (let i = 0; i < headerMatches.length; i++) {
    const match = headerMatches[i]
    const title = match[1].trim()
    const start = match.index
    const end = i + 1 < headerMatches.length ? headerMatches[i + 1].index : md.length
    const body = md.slice(start, end).trim()
    sections.push({ title, body })
  }
  return sections
}

function parsePriorityFromTitle(title) {
  // Example: "(P0–P1)" or "(P1–P2)" or "(P0)"
  const m = title.match(/\(P([0-3])(?:\s*[–-]\s*P([0-3]))?\)/)
  if (!m) return null
  const a = Number(m[1])
  const b = m[2] ? Number(m[2]) : a
  const min = Math.min(a, b)
  return `priority:P${min}`
}

function areaLabelFromNumberedTitle(title) {
  const m = title.match(/^(\d+)\)\s+/)
  if (!m) return null
  const n = Number(m[1])
  const map = new Map([
    [1, "area:acquisition"],
    [2, "area:onboarding"],
    [3, "area:billing"],
    [4, "area:invoicing"],
    [5, "area:expenses"],
    [6, "area:e-invoicing"],
    [7, "area:pausalni-obrt"],
    [8, "area:security"],
    [9, "area:ops"],
    [10, "area:support"],
    [11, "area:integrations"],
    [12, "area:ux"],
    [13, "area:tenancy"],
    [14, "area:ai"],
  ])
  return map.get(n) || null
}

function normalizeHeadingForIssueTitle(title) {
  // Strip the leading number "1) " etc for cleaner issue titles.
  return title.replace(/^\d+\)\s+/, "").trim()
}

function main() {
  ensureInGitRepo()
  ensureGhAuth()

  if (!fs.existsSync(DOC_PATH)) {
    throw new Error(`Missing doc: ${DOC_PATH}`)
  }

  const md = fs.readFileSync(DOC_PATH, "utf8")
  const existingTitles = getExistingIssueTitles()

  // Labels (minimal but useful).
  ensureLabel({
    name: "launch-gap",
    description: "Gap blocking launch readiness / first customers",
    color: "B60205",
  })
  for (const p of ["P0", "P1", "P2", "P3"]) {
    ensureLabel({
      name: `priority:${p}`,
      description: `Launch readiness priority ${p}`,
      color: p === "P0" ? "B60205" : p === "P1" ? "D93F0B" : p === "P2" ? "FBCA04" : "0E8A16",
    })
  }
  const areas = [
    "acquisition",
    "onboarding",
    "billing",
    "invoicing",
    "expenses",
    "e-invoicing",
    "pausalni-obrt",
    "security",
    "ops",
    "support",
    "integrations",
    "ux",
    "tenancy",
    "ai",
  ]
  for (const area of areas) {
    ensureLabel({
      name: `area:${area}`,
      description: `Launch gaps area: ${area}`,
      color: "1D76DB",
    })
  }

  const created = []

  // Executive + DoD + Roadmap issues.
  const executive = extractSection(md, /^##\s+Biggest “Land First Customers” Gaps \(Executive List\)$/m)
  if (executive) {
    const title = "Launch gaps: Executive blockers"
    if (!existingTitles.has(title)) {
      const body = `Source: \`docs/LAUNCH_GAPS.md\`\n\n${executive}\n`
      created.push(createIssue({ title, body, labels: ["launch-gap", "priority:P0", "area:acquisition"] }))
      existingTitles.add(title)
    }
  }

  const dod = extractSection(md, /^##\s+First Customers \(Paušalni Obrt\)\s+—\s+Definition of Done$/m)
  if (dod) {
    const title = "Launch gaps: Paušalni obrt definition of done"
    if (!existingTitles.has(title)) {
      const body = `Source: \`docs/LAUNCH_GAPS.md\`\n\n${dod}\n`
      created.push(createIssue({ title, body, labels: ["launch-gap", "priority:P0", "area:pausalni-obrt"] }))
      existingTitles.add(title)
    }
  }

  const roadmap = extractSection(md, /^##\s+30\/60\/90 Day Recommended Roadmap \(Suggested\)$/m)
  if (roadmap) {
    const title = "Launch gaps: 30/60/90 roadmap"
    if (!existingTitles.has(title)) {
      const body = `Source: \`docs/LAUNCH_GAPS.md\`\n\n${roadmap}\n`
      created.push(createIssue({ title, body, labels: ["launch-gap", "priority:P1", "area:ops"] }))
      existingTitles.add(title)
    }
  }

  // Area epics from each "###" section.
  const sections = extractTripleHashSections(md)
  for (const section of sections) {
    const clean = normalizeHeadingForIssueTitle(section.title)
    const title = `Launch gaps: ${clean}`
    if (existingTitles.has(title)) continue

    const priority = parsePriorityFromTitle(section.title) || "priority:P2"
    const area = areaLabelFromNumberedTitle(section.title) || "area:ops"
    const body = `Source: \`docs/LAUNCH_GAPS.md\`\n\n${section.body}\n`
    created.push(createIssue({ title, body, labels: ["launch-gap", priority, area] }))
    existingTitles.add(title)
  }

  // Master index issue (created last so it can link to the doc).
  const masterTitle = "Launch readiness: master index (from docs/LAUNCH_GAPS.md)"
  if (!existingTitles.has(masterTitle)) {
    const body =
      `This issue tracks the launch-readiness gap backlog.\n\n` +
      `Source document: \`docs/LAUNCH_GAPS.md\`\n\n` +
      `Next step: triage \`launch-gap\` issues and break P0/P1 into smaller deliverables.\n`
    created.push(createIssue({ title: masterTitle, body, labels: ["launch-gap", "priority:P0", "area:ops"] }))
    existingTitles.add(masterTitle)
  }

  if (created.length === 0) {
    console.log("No new issues created (already up to date).")
    return
  }

  console.log(`Created ${created.length} issues:`)
  for (const url of created) console.log(url)
}

main()
