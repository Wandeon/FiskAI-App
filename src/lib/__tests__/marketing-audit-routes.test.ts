import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildRouteInventory } from "../marketing-audit/route-inventory"

const fixtureRoot = "tests/fixtures/marketing-routes"

describe("Marketing audit route inventory", () => {
  it("finds marketing routes", async () => {
    const routes = await buildRouteInventory(fixtureRoot, "src/app/(marketing)")

    assert.ok(
      routes.some(
        (route) => route.route === "/about" && route.file.endsWith("about/page.tsx")
      )
    )

    assert.ok(
      routes.some(
        (route) =>
          route.route === "/pricing" && route.file.endsWith("pricing/page.tsx")
      )
    )
  })
})
