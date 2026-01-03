import { describe, it, expect } from "vitest"
import { navigation, LEGACY_ROUTES } from "@/lib/navigation"

describe("Navigation", () => {
  it("has Control Center as first navigation item", () => {
    const firstSection = navigation[0]
    const firstItem = firstSection.items[0]
    expect(firstItem.href).toBe("/control-center")
    expect(firstItem.name).toBe("Kontrolni centar")
  })

  it("exports LEGACY_ROUTES constant", () => {
    expect(LEGACY_ROUTES).toBeDefined()
    expect(LEGACY_ROUTES).toContain("/dashboard")
  })

  it("marks dashboard as legacy in navigation", () => {
    const dashboardItem = navigation
      .flatMap((s) => s.items)
      .find((i) => i.href === "/dashboard")
    expect(dashboardItem?.legacy).toBe(true)
  })
})
