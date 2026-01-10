import { GET } from "../route"

describe("/api/health", () => {
  it("returns 200 with status ok", async () => {
    const response = await GET()

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.status).toBe("ok")
    expect(data.timestamp).toBeDefined()
    expect(data.version).toBeDefined()
    expect(data.uptime).toBeGreaterThanOrEqual(0)
    expect(data.memory).toBeDefined()
    expect(data.memory.heapUsedMB).toBeGreaterThan(0)
    expect(data.memory.heapTotalMB).toBeGreaterThan(0)
    expect(data.memory.heapPercent).toBeGreaterThanOrEqual(0)
    expect(data.memory.heapPercent).toBeLessThanOrEqual(100)
  })

  it("has no external dependencies and responds fast", async () => {
    // This test verifies the endpoint doesn't import DB/Redis
    // by checking that it completes fast without any setup
    const start = Date.now()
    await GET()
    const duration = Date.now() - start

    // Should complete in under 50ms since it has no I/O
    expect(duration).toBeLessThan(50)
  })
})
