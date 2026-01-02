import { describe, test, before, after } from "node:test"
import assert from "node:assert/strict"
import { StubPoreznaServer } from "./stubs/porezna-stub"
import { createTestContext } from "./helpers/test-context"

describe("Fiscalization Acceptance", () => {
  let stubServer: StubPoreznaServer

  before(async () => {
    // Start stub with ephemeral port
    stubServer = await StubPoreznaServer.start({
      responses: { submit: { jir: "acceptance-test-jir-001" } },
    })
  })

  after(async () => {
    await stubServer.stop()
  })

  test("stub server starts on ephemeral port", async () => {
    // Verify stub is using ephemeral port (not hardcoded)
    assert.ok(stubServer.baseUrl.startsWith("http://localhost:"), "Stub should be on localhost")

    const port = parseInt(stubServer.baseUrl.split(":")[2])
    assert.ok(port > 0, "Port should be assigned")
    assert.ok(port !== 9999, "Port should not be hardcoded 9999")
  })

  test("context receives injected baseUrl", async () => {
    const ctx = createTestContext({
      poreznaBaseUrl: stubServer.baseUrl,
    })

    // Verify context has the injected URL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = (ctx.prisma as any).__testConfig
    assert.strictEqual(
      config.poreznaBaseUrl,
      stubServer.baseUrl,
      "Context should have injected baseUrl"
    )

    await ctx.prisma.$disconnect()
  })

  test("stub tracks request count for verification", async () => {
    const initialCount = stubServer.requestCount

    // Make a request to the stub
    const response = await fetch(`${stubServer.baseUrl}/fiscalize`, {
      method: "POST",
      body: "<test/>",
    })

    assert.strictEqual(response.status, 200)
    assert.strictEqual(stubServer.requestCount, initialCount + 1, "Request count should increment")
  })
})
