import { test, expect, type Page } from "@playwright/test"
import { TOOL_VECTORS } from "../../scripts/marketing-content-audit/tool-vectors"
import { getAuditConfig } from "../../src/lib/marketing-audit/config"

async function runActions(page: Page, actions?: typeof TOOL_VECTORS[number]["actions"]) {
  if (!actions) return

  for (const action of actions) {
    if (action.type === "fill") {
      await page.fill(action.selector, action.value)
    } else if (action.type === "click") {
      await page.click(action.selector)
    } else if (action.type === "select") {
      await page.selectOption(action.selector, action.value)
    }
  }
}

test("marketing tools use fiscal-data derived values", async ({ page }) => {
  const config = getAuditConfig()
  const baseUrl = config.targetBaseUrl.endsWith("/")
    ? config.targetBaseUrl
    : `${config.targetBaseUrl}/`

  for (const tool of TOOL_VECTORS) {
    const url = new URL(tool.route.replace(/^\/+/, ""), baseUrl).toString()
    await page.goto(url, { waitUntil: "networkidle" })
    await page.waitForTimeout(800)

    for (const text of tool.expectedTexts) {
      await expect.soft(page.locator("body"), `${tool.id} should show ${text}`).toContainText(text)
    }

    await runActions(page, tool.actions)
    await page.waitForTimeout(500)

    if (tool.expectedAfter) {
      for (const text of tool.expectedAfter) {
        await expect
          .soft(page.locator("body"), `${tool.id} should show ${text} after actions`)
          .toContainText(text)
      }
    }
  }
})
