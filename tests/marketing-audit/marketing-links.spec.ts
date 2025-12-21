import { test, expect } from "@playwright/test"
import { promises as fs } from "node:fs"
import path from "node:path"
import axe from "axe-core"
import { getAuditConfig } from "../../src/lib/marketing-audit/config"
import { buildRouteInventory } from "../../src/lib/marketing-audit/route-inventory"

const skipSchemes = ["mailto:", "tel:", "javascript:"]
const skipExtensions = [".pdf", ".zip", ".rar"]
const INTERNAL_HOSTS = new Set(["fiskai.hr", "www.fiskai.hr", "fisk.ai", "www.fisk.ai"])

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

const DYNAMIC_CONTENT_MAP = [
  { route: "/vodic/[slug]", dir: "content/vodici" },
  { route: "/usporedba/[slug]", dir: "content/usporedbe" },
  { route: "/rjecnik/[pojam]", dir: "content/rjecnik" },
  { route: "/kako-da/[slug]", dir: "content/kako-da" },
]

async function expandDynamicContent(repoRoot: string) {
  const expanded: string[] = []

  for (const mapping of DYNAMIC_CONTENT_MAP) {
    const dirPath = path.join(repoRoot, mapping.dir)

    try {
      const entries = await fs.readdir(dirPath)
      for (const file of entries) {
        if (!file.endsWith(".mdx")) continue
        const slug = file.replace(/\.mdx$/, "")
        const route = mapping.route.replace("[slug]", slug).replace("[pojam]", slug)
        expanded.push(route)
      }
    } catch {
      // ignore missing content folder
    }
  }

  return expanded
}

async function loadRoutes() {
  const config = getAuditConfig()
  const routes = [] as Array<{ route: string }>

  for (const repo of config.repos) {
    const repoRoutes = await buildRouteInventory(repo, config.marketingRoot)
    routes.push(...repoRoutes)

    const dynamicRoutes = await expandDynamicContent(repo)
    routes.push(...dynamicRoutes.map((route) => ({ route })))
  }

  const unique = new Map<string, string>()
  for (const route of routes) {
    if (!unique.has(route.route)) {
      unique.set(route.route, route.file)
    }
  }

  const filtered = Array.from(unique.keys()).filter(
    (route) => !AUTH_ROUTES.has(route) && !route.includes("["),
  )

  return {
    config,
    routes: filtered.sort(),
  }
}

function normalizeLink(baseUrl: string, href: string) {
  const trimmed = href.trim()
  if (!trimmed || trimmed.startsWith("#")) {
    return null
  }

  if (skipSchemes.some((scheme) => trimmed.startsWith(scheme))) {
    return null
  }

  if (skipExtensions.some((ext) => trimmed.toLowerCase().endsWith(ext))) {
    return null
  }

  try {
    return new URL(trimmed, baseUrl).toString()
  } catch {
    return null
  }
}

test("marketing routes and links respond", async ({ page, request }) => {
  const { config, routes } = await loadRoutes()
  const baseUrl = config.targetBaseUrl.endsWith("/")
    ? config.targetBaseUrl
    : `${config.targetBaseUrl}/`
  const baseHost = new URL(baseUrl).hostname
  const globalVisitedLinks = new Set<string>()

  for (const route of routes) {
    const url = new URL(route.replace(/^\/+/, ""), baseUrl).toString()
    const response = await page.goto(url, { waitUntil: "networkidle" })

    expect.soft(response?.status(), `Route ${url} should respond`).toBeLessThan(400)

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href]")).map((link) => ({
        href: link.getAttribute("href") ?? "",
        text: link.textContent?.trim() ?? "",
        ariaLabel: link.getAttribute("aria-label") ?? "",
      }))
    })

    const visitedLinks = new Set<string>()

    for (const link of links) {
      const normalized = normalizeLink(baseUrl, link.href)
      if (!normalized || visitedLinks.has(normalized) || globalVisitedLinks.has(normalized)) {
        continue
      }

      visitedLinks.add(normalized)
      globalVisitedLinks.add(normalized)
      const targetHost = new URL(normalized).hostname
      const isInternal = INTERNAL_HOSTS.has(targetHost) || targetHost === baseHost
      try {
        const linkResponse = await request.get(normalized, {
          failOnStatusCode: false,
          timeout: isInternal ? 10000 : 20000,
          headers: isInternal
            ? undefined
            : {
                "Accept-Encoding": "identity",
                "User-Agent": "FiskAI-Marketing-Audit/1.0",
              },
        })
        const status = linkResponse.status()

        expect.soft(
          status,
          `Link ${normalized} should respond (found on ${url}).`,
        ).toBeLessThan(400)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        expect.soft(false, `Link ${normalized} request failed on ${url}: ${message}`).toBe(true)
      }
    }

    await page.addScriptTag({ content: axe.source })
    const axeResults = await page.evaluate(async () => {
      return await (window as typeof window & { axe: typeof axe }).axe.run(document, {
        runOnly: {
          type: "rule",
          values: ["color-contrast"],
        },
      })
    })

    expect.soft(
      axeResults.violations.length,
      `Contrast issues on ${url}: ${axeResults.violations
        .map((violation) => violation.id)
        .join(", ")}`,
    ).toBe(0)
  }
})
