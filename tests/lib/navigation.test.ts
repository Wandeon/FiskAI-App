import { describe, it, expect } from "vitest"
import { navigation } from "@/lib/navigation"

describe("Navigation", () => {
  it("has Control Center as first navigation item", () => {
    const firstSection = navigation[0]
    const firstItem = firstSection.items[0]
    expect(firstItem.href).toBe("/control-center")
    expect(firstItem.name).toBe("Kontrolni centar")
  })

  it("includes dashboard in navigation without legacy marker", () => {
    const dashboardItem = navigation.flatMap((s) => s.items).find((i) => i.href === "/dashboard")
    expect(dashboardItem).toBeDefined()
    expect(dashboardItem?.legacy).toBeUndefined()
  })
})
