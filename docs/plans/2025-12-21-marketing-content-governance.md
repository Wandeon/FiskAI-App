# Marketing Content Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a content governance system that audits all marketing pages in FiskAI and FiskAI-next and produces a single master audit file with evidence.

**Architecture:** Create a registry-driven audit pipeline with static validators, dynamic Playwright crawling on production, and tool validation based on fiscal-data. Merge results into one authoritative markdown audit file under `FiskAI/docs/`.

**Tech Stack:** Node.js, TypeScript, tsx, Playwright, axe-core, Markdown, YAML.

---

### Task 1: Add audit types and config

**Files:**

- Create: `src/lib/marketing-audit/types.ts`
- Create: `src/lib/marketing-audit/config.ts`
- Test: `src/lib/__tests__/marketing-audit-config.test.ts`

**Step 1: Write the failing test**

```ts
import { test, expect } from "node:test"
import { getAuditConfig } from "../marketing-audit/config"

test("audit config resolves repo roots", () => {
  const cfg = getAuditConfig()
  expect(cfg.repos.length).toBe(2)
  expect(cfg.repos.some((r) => r.endsWith("FiskAI"))).toBe(true)
  expect(cfg.repos.some((r) => r.endsWith("FiskAI-next"))).toBe(true)
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with missing module error.

**Step 3: Write minimal implementation**

```ts
export function getAuditConfig() {
  return {
    repos: [process.cwd(), `${process.cwd()}/../FiskAI-next`],
    marketingRoot: "src/app/(marketing)",
    auditOutput: "docs/MARKETING_CONTENT_AUDIT.md",
    targetBaseUrl: "https://fiskai.hr",
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/marketing-audit/config.ts src/lib/marketing-audit/types.ts src/lib/__tests__/marketing-audit-config.test.ts
git commit -m "feat(audit): add marketing audit config and types"
```

---

### Task 2: Route inventory builder

**Files:**

- Create: `src/lib/marketing-audit/route-inventory.ts`
- Create: `tests/fixtures/marketing-routes/src/app/(marketing)/about/page.tsx`
- Create: `tests/fixtures/marketing-routes/src/app/(marketing)/pricing/page.tsx`
- Test: `src/lib/__tests__/marketing-audit-routes.test.ts`

**Step 1: Write the failing test**

```ts
import { test, expect } from "node:test"
import { buildRouteInventory } from "../marketing-audit/route-inventory"

const fixtureRoot = "tests/fixtures/marketing-routes"

test("route inventory finds marketing routes", async () => {
  const routes = await buildRouteInventory(fixtureRoot, "src/app/(marketing)")
  expect(routes).toContainEqual({
    route: "/about",
    file: expect.stringContaining("about/page.tsx"),
  })
  expect(routes).toContainEqual({
    route: "/pricing",
    file: expect.stringContaining("pricing/page.tsx"),
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with missing module error.

**Step 3: Write minimal implementation**

```ts
import { promises as fs } from "node:fs"
import path from "node:path"

export async function buildRouteInventory(repoRoot: string, marketingRoot: string) {
  const base = path.join(repoRoot, marketingRoot)
  const routes: Array<{ route: string; file: string }> = []

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (/page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        const rel = path.relative(base, path.dirname(full))
        const route =
          "/" +
          rel
            .replace(/\\/g, "/")
            .replace(/\(.*?\)\//g, "")
            .replace(/index$/, "")
        routes.push({ route: route === "/" ? "/" : route, file: full })
      }
    }
  }

  await walk(base)
  return routes
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/marketing-audit/route-inventory.ts src/lib/__tests__/marketing-audit-routes.test.ts tests/fixtures/marketing-routes

git commit -m "feat(audit): add marketing route inventory"
```

---

### Task 3: Registry schema and seed generator

**Files:**

- Create: `docs/marketing-content-registry.yml`
- Create: `scripts/marketing-content-audit/seed-registry.ts`
- Test: `src/lib/__tests__/marketing-audit-registry.test.ts`

**Step 1: Write the failing test**

```ts
import { test, expect } from "node:test"
import { seedRegistry } from "../marketing-audit/registry"

test("registry seed includes routes", async () => {
  const registry = await seedRegistry([{ route: "/about", file: "/tmp/about/page.tsx" }])
  expect(registry.pages[0].route).toBe("/about")
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with missing module error.

**Step 3: Write minimal implementation**

```ts
export function seedRegistry(routes: Array<{ route: string; file: string }>) {
  return {
    pages: routes.map((r) => ({
      route: r.route,
      file: r.file,
      ctas: [],
      dataDependencies: [],
      toolChecks: [],
      notes: "",
    })),
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/marketing-content-audit/seed-registry.ts docs/marketing-content-registry.yml src/lib/__tests__/marketing-audit-registry.test.ts

git commit -m "feat(audit): add registry schema and seeder"
```

---

### Task 4: Fiscal-data canonical map

**Files:**

- Create: `src/lib/marketing-audit/fiscal-data-map.ts`
- Test: `src/lib/__tests__/marketing-audit-fiscal-data.test.ts`

**Step 1: Write the failing test**

```ts
import { test, expect } from "node:test"
import { loadFiscalDataMap } from "../marketing-audit/fiscal-data-map"

test("fiscal data map returns values", async () => {
  const map = await loadFiscalDataMap()
  expect(Object.keys(map).length).toBeGreaterThan(0)
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with missing module error.

**Step 3: Write minimal implementation**

```ts
export async function loadFiscalDataMap() {
  const modulePath = `${process.cwd()}/src/lib/fiscal-data/index.ts`
  const mod = await import(modulePath)
  return mod
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/marketing-audit/fiscal-data-map.ts src/lib/__tests__/marketing-audit-fiscal-data.test.ts

git commit -m "feat(audit): add fiscal-data map loader"
```

---

### Task 5: Static validators (hardcoded values, language, tokens)

**Files:**

- Create: `src/lib/marketing-audit/validators/hardcoded-values.ts`
- Create: `src/lib/marketing-audit/validators/language.ts`
- Create: `src/lib/marketing-audit/validators/design-tokens.ts`
- Test: `src/lib/__tests__/marketing-audit-validators.test.ts`

**Step 1: Write the failing test**

```ts
import { test, expect } from "node:test"
import { detectHardcodedValues } from "../marketing-audit/validators/hardcoded-values"

const sample = "Prag za PDV je 60000 EUR"

test("detects hardcoded fiscal values", () => {
  const hits = detectHardcodedValues(sample)
  expect(hits.length).toBe(1)
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with missing module error.

**Step 3: Write minimal implementation**

```ts
export function detectHardcodedValues(text: string) {
  const matches = text.match(/\b(60\.?000|75\.?000|25%|13%|5%)\b/g)
  return matches ?? []
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/marketing-audit/validators src/lib/__tests__/marketing-audit-validators.test.ts

git commit -m "feat(audit): add static validators"
```

---

### Task 6: Playwright dynamic crawler (links, 404, contrast)

**Files:**

- Modify: `package.json` (add @playwright/test, axe-core)
- Create: `tests/marketing-audit/playwright.config.ts`
- Create: `tests/marketing-audit/marketing-links.spec.ts`

**Step 1: Write the failing test**

```ts
import { test, expect } from "@playwright/test"

test("marketing home loads", async ({ page }) => {
  const res = await page.goto("https://fiskai.hr")
  expect(res?.status()).toBe(200)
})
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/marketing-audit/marketing-links.spec.ts`
Expected: FAIL (Playwright not installed).

**Step 3: Add dependencies and config**

Add to devDependencies:

```
"@playwright/test": "^1.49.0",
"axe-core": "^4.10.0"
```

Create config with low concurrency:

```ts
export default defineConfig({
  timeout: 60000,
  workers: 2,
  use: { baseURL: "https://fiskai.hr" },
})
```

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/marketing-audit/marketing-links.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json package-lock.json tests/marketing-audit

git commit -m "feat(audit): add Playwright marketing crawl"
```

---

### Task 7: Tool validation flows

**Files:**

- Create: `tests/marketing-audit/tools.spec.ts`
- Create: `scripts/marketing-content-audit/tool-vectors.ts`

**Step 1: Write the failing test**

```ts
import { test, expect } from "@playwright/test"

test("PDV calculator uses fiscal-data", async ({ page }) => {
  await page.goto("/alati/pdv-kalkulator")
  await page.getByLabel("Iznos").fill("100")
  await page.getByRole("button", { name: /izracunaj/i }).click()
  await expect(page.getByText(/PDV/)).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test tests/marketing-audit/tools.spec.ts`
Expected: FAIL until tool vectors and selectors are implemented.

**Step 3: Implement tool vectors + assertions**

Create vectors derived from fiscal-data and assert formatted results.

**Step 4: Run test to verify it passes**

Run: `npx playwright test tests/marketing-audit/tools.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/marketing-audit/tools.spec.ts scripts/marketing-content-audit/tool-vectors.ts

git commit -m "feat(audit): add tool validation flows"
```

---

### Task 8: Report generator (single master audit file)

**Files:**

- Create: `scripts/marketing-content-audit/generate-report.ts`
- Create: `docs/MARKETING_CONTENT_AUDIT.md`
- Modify: `package.json` (add audit scripts)

**Step 1: Write the failing test**

```ts
import { test, expect } from "node:test"
import { buildAuditReport } from "../marketing-audit/report"

test("report builder outputs markdown", () => {
  const md = buildAuditReport({ pages: [] })
  expect(md.startsWith("# Marketing Content Audit")).toBe(true)
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with missing module error.

**Step 3: Implement report builder and script**

Create a markdown builder that merges static and dynamic JSON into `docs/MARKETING_CONTENT_AUDIT.md`.

**Step 4: Run report generation**

Run: `node --import tsx scripts/marketing-content-audit/generate-report.ts`
Expected: File created with populated sections.

**Step 5: Commit**

```bash
git add scripts/marketing-content-audit/generate-report.ts docs/MARKETING_CONTENT_AUDIT.md package.json

git commit -m "feat(audit): add master audit report generation"
```

---

### Task 9: CI / local workflow

**Files:**

- Modify: `package.json` (add `audit:marketing` and `audit:marketing:static` scripts)
- Create: `docs/marketing-content-audit-runbook.md`

**Step 1: Write the failing test**

```ts
import { test, expect } from "node:test"
import { getAuditConfig } from "../marketing-audit/config"

test("audit script paths are valid", () => {
  const cfg = getAuditConfig()
  expect(cfg.targetBaseUrl).toBe("https://fiskai.hr")
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL until script wiring is added.

**Step 3: Implement scripts and runbook**

Add scripts:

- `audit:marketing:static`
- `audit:marketing:dynamic`
- `audit:marketing` (runs both and generates report)

**Step 4: Run audit scripts**

Run: `npm run audit:marketing:static`
Expected: JSON outputs for static checks

**Step 5: Commit**

```bash
git add package.json docs/marketing-content-audit-runbook.md

git commit -m "chore(audit): add audit runbook and scripts"
```

---

## Testing and validation

- `npm test` (unit tests for audit modules)
- `npx playwright test tests/marketing-audit/marketing-links.spec.ts`
- `npx playwright test tests/marketing-audit/tools.spec.ts`
- `node --import tsx scripts/marketing-content-audit/generate-report.ts`

## Risks and edge cases

- Production crawling can be rate-limited; keep Playwright workers low.
- Some CTAs are non-navigation (accordions); registry must whitelist them.
- Fiscal-data exports may change; tests must be resilient to key renames.
- Two repos may diverge; canonicalization rules must be explicit.

## Open questions

- Which repo is authoritative for production content if FiskAI and FiskAI-next differ?
- Should external links allow-list be strict (only gov/FINA) or permissive?
