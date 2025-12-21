import { promises as fs } from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import { getAuditConfig } from "../../src/lib/marketing-audit/config"
import { buildRouteInventory } from "../../src/lib/marketing-audit/route-inventory"
import { loadFiscalDataMap } from "../../src/lib/marketing-audit/fiscal-data-map"
import { detectHardcodedValues } from "../../src/lib/marketing-audit/validators/hardcoded-values"
import { detectEnglishLeakage } from "../../src/lib/marketing-audit/validators/language"
import { detectNonTokenColors } from "../../src/lib/marketing-audit/validators/design-tokens"
import { TOOL_VECTORS } from "./tool-vectors"

const AUTH_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/select-role",
  "/check-email",
  "/wizard",
])

const INTERNAL_HOSTS = new Set(["fiskai.hr", "www.fiskai.hr", "fisk.ai", "www.fisk.ai"])

const DYNAMIC_CONTENT_MAP = [
  { route: "/vodic/[slug]", dir: "content/vodici" },
  { route: "/usporedba/[slug]", dir: "content/usporedbe" },
  { route: "/rjecnik/[pojam]", dir: "content/rjecnik" },
  { route: "/kako-da/[slug]", dir: "content/kako-da" },
]

type RouteEntry = {
  route: string
  file: string
  repo: string
  sourceType: "tsx" | "mdx" | "db"
  originRoute?: string
}

type LinkEntry = {
  href: string
  kind: "internal" | "external" | "anchor" | "unknown"
  status:
    | "static-ok"
    | "static-missing"
    | "dynamic-db"
    | "dynamic-template"
    | "dynamic-api"
    | "auth-excluded"
    | "external"
}

type ButtonEntry = {
  label: string
}

type PageAudit = {
  route: string
  file: string
  repo: string
  sourceType: RouteEntry["sourceType"]
  links: LinkEntry[]
  buttons: ButtonEntry[]
  hardcoded: Array<{ match: string; line: number; reason: string }>
  language: Array<{ kind: string; matches: string[]; ratio?: number }>
  design: Array<{ match: string; line: number; reason: string }>
  dataDependencies: string[]
}

type PlaywrightSummary = {
  stats?: {
    total?: number
    expected?: number
    unexpected?: number
    flaky?: number
    skipped?: number
    startTime?: string
    duration?: number
  }
  failures: string[]
  parseError?: string
  sourcePath?: string
}

function normalizeRoute(input: string) {
  if (!input) return ""
  const trimmed = input.trim()
  if (!trimmed) return ""

  try {
    const url = new URL(trimmed)
    if (INTERNAL_HOSTS.has(url.hostname)) {
      return url.pathname.replace(/\/$/, "") || "/"
    }
  } catch {
    // ignore
  }

  const withoutQuery = trimmed.split("?")[0].split("#")[0]
  if (!withoutQuery.startsWith("/")) return ""
  return withoutQuery.replace(/\/$/, "") || "/"
}

function classifyLink(href: string, knownRoutes: Set<string>) {
  if (!href || href.trim() === "") {
    return { kind: "unknown", status: "external" } as const
  }

  const trimmed = href.trim()
  if (trimmed.includes("${")) {
    return { kind: "internal", status: "dynamic-template" } as const
  }
  if (trimmed.startsWith("#")) {
    return { kind: "anchor", status: "external" } as const
  }

  if (/^(mailto:|tel:|javascript:)/i.test(trimmed)) {
    return { kind: "external", status: "external" } as const
  }

  try {
    const url = new URL(trimmed)
    if (INTERNAL_HOSTS.has(url.hostname)) {
      const route = normalizeRoute(url.pathname)
      if (AUTH_ROUTES.has(route)) {
        return { kind: "internal", status: "auth-excluded" } as const
      }
      if (route.startsWith("/api/")) {
        return { kind: "internal", status: "dynamic-api" } as const
      }
      if (knownRoutes.has(route)) {
        return { kind: "internal", status: "static-ok" } as const
      }
      if (route.startsWith("/vijesti")) {
        return { kind: "internal", status: "dynamic-db" } as const
      }
      return { kind: "internal", status: "static-missing" } as const
    }

    return { kind: "external", status: "external" } as const
  } catch {
    const route = normalizeRoute(trimmed)
    if (route) {
      if (AUTH_ROUTES.has(route)) {
        return { kind: "internal", status: "auth-excluded" } as const
      }
      if (route.startsWith("/api/")) {
        return { kind: "internal", status: "dynamic-api" } as const
      }
      if (knownRoutes.has(route)) {
        return { kind: "internal", status: "static-ok" } as const
      }
      if (route.startsWith("/vijesti")) {
        return { kind: "internal", status: "dynamic-db" } as const
      }
      return { kind: "internal", status: "static-missing" } as const
    }
  }

  return { kind: "unknown", status: "external" } as const
}

function extractLinksFromTsx(source: string) {
  const links = [] as string[]
  const hrefPattern = /href\s*=\s*{?\s*["'`]([^"'`]+)["'`]\s*}?/g

  for (const match of source.matchAll(hrefPattern)) {
    links.push(match[1])
  }

  return Array.from(new Set(links))
}

function extractLinksFromMdx(source: string) {
  const links = [] as string[]
  const mdLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g

  for (const match of source.matchAll(mdLinkPattern)) {
    links.push(match[1])
  }

  return Array.from(new Set(links))
}

function extractButtonsFromTsx(source: string) {
  const buttons = [] as string[]
  const buttonPattern = /<button[^>]*>([^<]+)<\/button>/g

  for (const match of source.matchAll(buttonPattern)) {
    const label = match[1].replace(/\s+/g, " ").trim()
    if (label) {
      buttons.push(label)
    }
  }

  return Array.from(new Set(buttons))
}

function extractDataDependencies(source: string) {
  const dependencies = new Set<string>()
  const patterns = [
    { label: "fiscal-data", regex: /@\/lib\/fiscal-data/ },
    { label: "knowledge-hub/constants", regex: /knowledge-hub\/constants/ },
    { label: "FiscalValue", regex: /<FiscalValue|FiscalValue\b/ },
    { label: "formatFiscalValue", regex: /formatFiscalValue/ },
  ]

  for (const entry of patterns) {
    if (entry.regex.test(source)) {
      dependencies.add(entry.label)
    }
  }

  return Array.from(dependencies)
}

function getLineNumber(text: string, index: number) {
  return text.slice(0, index).split("\n").length
}

function flattenFrontmatter(data: Record<string, unknown>) {
  const values: string[] = []
  for (const value of Object.values(data)) {
    if (typeof value === "string") {
      values.push(value)
    } else if (Array.isArray(value)) {
      values.push(value.filter((item) => typeof item === "string").join(" "))
    }
  }

  return values.join("\n")
}

function collectNumericValues(input: unknown, set: Set<number>) {
  if (typeof input === "number" && Number.isFinite(input)) {
    if (input !== 0) {
      set.add(input)
    }
    if (input > 0 && input < 1) {
      const percentValue = Number((input * 100).toFixed(3))
      set.add(percentValue)
    }
    return
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      collectNumericValues(item, set)
    }
    return
  }

  if (input && typeof input === "object") {
    for (const value of Object.values(input)) {
      if (typeof value === "function") continue
      collectNumericValues(value, set)
    }
  }
}

async function expandDynamicContent(repoRoot: string) {
  const expanded: RouteEntry[] = []

  for (const mapping of DYNAMIC_CONTENT_MAP) {
    const dirPath = path.join(repoRoot, mapping.dir)

    try {
      const entries = await fs.readdir(dirPath)
      for (const file of entries) {
        if (!file.endsWith(".mdx")) continue
        const slug = file.replace(/\.mdx$/, "")
        const route = mapping.route.replace("[slug]", slug).replace("[pojam]", slug)
        expanded.push({
          route,
          file: path.join(dirPath, file),
          repo: path.basename(repoRoot),
          sourceType: "mdx",
          originRoute: mapping.route,
        })
      }
    } catch {
      // ignore missing content folder
    }
  }

  return expanded
}

async function collectRoutes() {
  const config = getAuditConfig()
  const routes: RouteEntry[] = []

  for (const repo of config.repos) {
    const repoRoutes = await buildRouteInventory(repo, config.marketingRoot)
    for (const route of repoRoutes) {
      routes.push({
        route: route.route,
        file: route.file,
        repo: path.basename(repo),
        sourceType: "tsx",
      })
    }

    const expanded = await expandDynamicContent(repo)
    routes.push(...expanded)
  }

  return { config, routes }
}

async function buildAuditPages(
  routes: RouteEntry[],
  canonicalNumbers: Set<number>,
  knownRoutes: Set<string>
) {
  const audits: PageAudit[] = []

  for (const routeEntry of routes) {
    if (AUTH_ROUTES.has(routeEntry.route)) {
      continue
    }

    if (routeEntry.route.includes("[")) {
      audits.push({
        route: routeEntry.route,
        file: routeEntry.file,
        repo: routeEntry.repo,
        sourceType: routeEntry.sourceType === "mdx" ? "mdx" : "db",
        links: [],
        buttons: [],
        hardcoded: [],
        language: [],
        design: [],
        dataDependencies: [],
      })
      continue
    }

    let source = ""
    let analysisText = ""

    try {
      source = await fs.readFile(routeEntry.file, "utf8")
    } catch {
      source = ""
    }

    if (routeEntry.sourceType === "mdx") {
      const parsed = matter(source)
      const frontmatter = flattenFrontmatter(parsed.data)
      analysisText = `${frontmatter}\n${parsed.content}`.trim()
    } else {
      analysisText = source
    }

    const linkTargets =
      routeEntry.sourceType === "mdx"
        ? extractLinksFromMdx(analysisText)
        : extractLinksFromTsx(analysisText)

    const links = linkTargets.map((href) => {
      const classification = classifyLink(href, knownRoutes)
      return {
        href,
        kind: classification.kind,
        status: classification.status,
      }
    })

    const buttons =
      routeEntry.sourceType === "tsx"
        ? extractButtonsFromTsx(analysisText).map((label) => ({ label }))
        : []

    const hardcodedHits = detectHardcodedValues(analysisText, {
      canonicalNumbers,
    }).map((hit) => ({
      match: hit.match,
      line: getLineNumber(analysisText, hit.index),
      reason: hit.reason,
    }))

    const languageIssues =
      routeEntry.sourceType === "mdx"
        ? detectEnglishLeakage(analysisText).map((issue) => ({
            kind: issue.kind,
            matches: issue.matches,
            ratio: issue.ratio,
          }))
        : []

    const designIssues = detectNonTokenColors(analysisText).map((issue) => ({
      match: issue.match,
      line: getLineNumber(analysisText, issue.index),
      reason: issue.reason,
    }))

    const dataDependencies =
      routeEntry.sourceType === "tsx" ? extractDataDependencies(analysisText) : []

    audits.push({
      route: routeEntry.route,
      file: routeEntry.file,
      repo: routeEntry.repo,
      sourceType: routeEntry.sourceType,
      links,
      buttons,
      hardcoded: hardcodedHits,
      language: languageIssues,
      design: designIssues,
      dataDependencies,
    })
  }

  return audits
}

function formatLinkStatus(status: LinkEntry["status"]) {
  switch (status) {
    case "static-ok":
      return "ok"
    case "static-missing":
      return "missing"
    case "dynamic-db":
      return "db"
    case "dynamic-template":
      return "dynamic"
    case "dynamic-api":
      return "api"
    case "auth-excluded":
      return "auth"
    default:
      return "external"
  }
}

function renderList(items: string[], emptyLabel = "None") {
  if (items.length === 0) return `- ${emptyLabel}`
  return items.map((item) => `- ${item}`).join("\n")
}

function collectPlaywrightFailures(report: unknown): string[] {
  const failures = new Set<string>()
  const stack: unknown[] = [report]

  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue

    if (Array.isArray(node)) {
      for (const value of node) {
        stack.push(value)
      }
      continue
    }

    if (typeof node === "object") {
      const record = node as Record<string, unknown>
      const errors = record.errors

      if (Array.isArray(errors)) {
        for (const error of errors) {
          if (error && typeof error === "object") {
            const message = (error as { message?: string }).message
            if (message) {
              failures.add(message.split("\n")[0])
            }
          }
        }
      }

      for (const value of Object.values(record)) {
        stack.push(value)
      }
    }
  }

  return Array.from(failures)
}

async function loadPlaywrightSummary(): Promise<PlaywrightSummary | null> {
  const resultsPath = process.env.MARKETING_AUDIT_PLAYWRIGHT_RESULTS
  if (!resultsPath) return null
  const cwd = process.cwd()
  const displayPath = resultsPath.startsWith(cwd)
    ? path.relative(cwd, resultsPath)
    : resultsPath

  try {
    const raw = await fs.readFile(resultsPath, "utf8")
    const report = JSON.parse(raw) as Record<string, unknown>
    const stats = report.stats as PlaywrightSummary["stats"] | undefined
    const failures = collectPlaywrightFailures(report)

    return {
      stats,
      failures,
      sourcePath: displayPath,
    }
  } catch (error) {
    return {
      failures: [],
      parseError: error instanceof Error ? error.message : String(error),
      sourcePath: displayPath,
    }
  }
}

async function generateReport() {
  const { config, routes } = await collectRoutes()
  const fiscalMap = await loadFiscalDataMap()
  const canonicalNumbers = new Set<number>()
  collectNumericValues(fiscalMap, canonicalNumbers)
  const playwrightSummary = await loadPlaywrightSummary()

  const allRoutes = new Set(
    routes.map((route) => {
      if (route.route.includes("[")) return route.route
      return normalizeRoute(route.route)
    })
  )

  const audits = await buildAuditPages(routes, canonicalNumbers, allRoutes)
  const sortedAudits = audits.sort((a, b) => a.route.localeCompare(b.route))

  const excluded = routes.filter((route) => AUTH_ROUTES.has(route.route))
  const totalRoutes = routes.length
  const auditedCount = sortedAudits.length

  const issueSummary = {
    hardcoded: 0,
    language: 0,
    design: 0,
    brokenLinks: 0,
  }

  for (const audit of sortedAudits) {
    issueSummary.hardcoded += audit.hardcoded.length
    issueSummary.language += audit.language.length
    issueSummary.design += audit.design.length
    issueSummary.brokenLinks += audit.links.filter((link) => link.status === "static-missing").length
  }

  const lines: string[] = []
  lines.push("# Marketing Content Audit")
  lines.push("")
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Target: ${config.targetBaseUrl}`)
  lines.push(`Repos: ${config.repos.join(", ")}`)
  lines.push("Scope: Marketing pages only. Auth routes excluded.")
  lines.push("")

  lines.push("## Summary")
  lines.push(`- Total marketing routes discovered: ${totalRoutes}`)
  lines.push(`- Audited routes: ${auditedCount}`)
  lines.push(`- Excluded auth routes: ${excluded.length}`)
  lines.push(`- Hardcoded value hits: ${issueSummary.hardcoded}`)
  lines.push(`- Language issues: ${issueSummary.language}`)
  lines.push(`- Design token issues: ${issueSummary.design}`)
  lines.push(`- Static broken internal links: ${issueSummary.brokenLinks}`)
  lines.push("")

  lines.push("## Excluded Auth Routes")
  lines.push(renderList(excluded.map((route) => `${route.route} (${route.repo})`)))
  lines.push("")

  lines.push("## Route Inventory")
  lines.push("| Route | Repo | Source | File |")
  lines.push("| --- | --- | --- | --- |")
  for (const route of routes.sort((a, b) => a.route.localeCompare(b.route))) {
    lines.push(
      `| ${route.route} | ${route.repo} | ${route.sourceType} | ${path.relative(
        config.repos.find((repo) => route.file.startsWith(repo)) ?? "",
        route.file
      )} |`
    )
  }
  lines.push("")

  lines.push("## Tool Coverage")
  lines.push("| Tool | Route | Notes |")
  lines.push("| --- | --- | --- |")
  for (const tool of TOOL_VECTORS) {
    lines.push(`| ${tool.id} | ${tool.route} | ${tool.notes ?? ""} |`)
  }
  lines.push("")

  lines.push("## Dynamic Validation (Playwright)")
  if (!playwrightSummary) {
    lines.push("Playwright validation not run for this report.")
    lines.push("Run `RUN_PLAYWRIGHT=true npm run audit:marketing` to capture results.")
  } else if (playwrightSummary.parseError) {
    lines.push(`Playwright results could not be parsed: ${playwrightSummary.parseError}`)
    lines.push(`Results file: ${playwrightSummary.sourcePath}`)
  } else {
    lines.push(`Results file: ${playwrightSummary.sourcePath}`)
    if (playwrightSummary.stats) {
      lines.push(
        `- Total tests: ${playwrightSummary.stats.total ?? "n/a"} | Passed: ${
          playwrightSummary.stats.expected ?? "n/a"
        } | Failed: ${playwrightSummary.stats.unexpected ?? "n/a"} | Skipped: ${
          playwrightSummary.stats.skipped ?? "n/a"
        } | Flaky: ${playwrightSummary.stats.flaky ?? "n/a"}`
      )
      if (playwrightSummary.stats.startTime) {
        lines.push(`- Start time: ${playwrightSummary.stats.startTime}`)
      }
      if (typeof playwrightSummary.stats.duration === "number") {
        lines.push(`- Duration: ${(playwrightSummary.stats.duration / 1000).toFixed(1)}s`)
      }
    }

    const failures = playwrightSummary.failures.slice(0, 50)
    if (failures.length === 0) {
      lines.push("- Failures: None")
    } else {
      lines.push("- Failures:")
      for (const failure of failures) {
        lines.push(`  - ${failure}`)
      }
      if (playwrightSummary.failures.length > failures.length) {
        lines.push(`  - ... ${playwrightSummary.failures.length - failures.length} more`)
      }
    }
  }
  lines.push("")

  lines.push("## Page-by-Page Audit")
  for (const audit of sortedAudits) {
    lines.push("")
    lines.push(`### ${audit.route}`)
    lines.push(`- Repo: ${audit.repo}`)
    lines.push(`- Source: ${audit.sourceType}`)
    lines.push(`- File: ${audit.file}`)

    const dataDeps = audit.dataDependencies.length > 0 ? audit.dataDependencies.join(", ") : "None"
    lines.push(`- Data dependencies: ${dataDeps}`)

    lines.push("- Links:")
    if (audit.links.length === 0) {
      lines.push("  - None")
    } else {
      for (const link of audit.links) {
        lines.push(`  - ${link.href} (${link.kind}, ${formatLinkStatus(link.status)})`)
      }
    }

    lines.push("- Buttons:")
    if (audit.buttons.length === 0) {
      lines.push("  - None")
    } else {
      for (const button of audit.buttons) {
        lines.push(`  - ${button.label}`)
      }
    }

    lines.push("- Hardcoded values:")
    if (audit.hardcoded.length === 0) {
      lines.push("  - None")
    } else {
      for (const hit of audit.hardcoded) {
        lines.push(`  - ${hit.match} (line ${hit.line}) - ${hit.reason}`)
      }
    }

    lines.push("- Language issues:")
    if (audit.language.length === 0) {
      lines.push("  - None")
    } else {
      for (const issue of audit.language) {
        const ratio = issue.ratio ? ` (ratio ${issue.ratio.toFixed(3)})` : ""
        lines.push(`  - ${issue.kind}: ${issue.matches.join(", ")}${ratio}`)
      }
    }

    lines.push("- Design token issues:")
    if (audit.design.length === 0) {
      lines.push("  - None")
    } else {
      for (const issue of audit.design) {
        lines.push(`  - ${issue.match} (line ${issue.line}) - ${issue.reason}`)
      }
    }
  }

  const outputPath = path.resolve(process.cwd(), config.auditOutput)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8")

  console.log(`Wrote audit report to ${outputPath}`)
}

generateReport().catch((error) => {
  console.error(error)
  process.exit(1)
})
