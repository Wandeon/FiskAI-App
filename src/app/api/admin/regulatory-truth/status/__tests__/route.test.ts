import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock the entire regulatory-status module to avoid server-only import
vi.mock("@/lib/admin/regulatory-status", () => ({
  getRegulatoryPipelineStatus: vi.fn().mockResolvedValue({
    timestamp: new Date().toISOString(),
    health: { status: "healthy", score: 100 },
    sources: { total: 0, active: 0, inactive: 0, needingCheck: 0, byPriority: {} },
    rules: {
      total: 0,
      byStatus: {
        DRAFT: 0,
        PENDING_REVIEW: 0,
        APPROVED: 0,
        PUBLISHED: 0,
        DEPRECATED: 0,
        REJECTED: 0,
      },
    },
    evidence: { total: 0, lastCollected: null },
    sourcePointers: { total: 0 },
    conflicts: { active: 0 },
    agents: { runs24h: 0, byType: {} },
    latestRelease: null,
    recentActivity: [],
  }),
}))

// Mock auth-utils - will be configured per test
const mockGetCurrentUser = vi.fn()
vi.mock("@/lib/auth-utils", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}))

// Mock validation utils
vi.mock("@/lib/api/validation", () => ({
  isValidationError: vi.fn().mockReturnValue(false),
  formatValidationError: vi.fn(),
}))

// Import route after mocks
import { GET } from "../route"

describe("GET /api/admin/regulatory-truth/status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Authorization", () => {
    it("returns 401 for unauthenticated requests", async () => {
      // No user session
      mockGetCurrentUser.mockResolvedValue(null)

      const request = new NextRequest("http://localhost:3000/api/admin/regulatory-truth/status", {
        method: "GET",
      })

      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe("Unauthorized")
    })

    it("returns 403 for authenticated non-admin users (USER role)", async () => {
      // Regular USER role
      mockGetCurrentUser.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        systemRole: "USER",
      })

      const request = new NextRequest("http://localhost:3000/api/admin/regulatory-truth/status", {
        method: "GET",
      })

      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Forbidden")
    })

    it("returns 403 for authenticated STAFF users", async () => {
      // STAFF role
      mockGetCurrentUser.mockResolvedValue({
        id: "staff-1",
        email: "staff@example.com",
        systemRole: "STAFF",
      })

      const request = new NextRequest("http://localhost:3000/api/admin/regulatory-truth/status", {
        method: "GET",
      })

      const response = await GET(request)

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Forbidden")
    })
  })

  describe("Success path", () => {
    it("returns 200 with status data for authenticated ADMIN users", async () => {
      // ADMIN role
      mockGetCurrentUser.mockResolvedValue({
        id: "admin-1",
        email: "admin@example.com",
        systemRole: "ADMIN",
      })

      const request = new NextRequest("http://localhost:3000/api/admin/regulatory-truth/status", {
        method: "GET",
      })

      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      // Verify expected shape
      expect(data).toHaveProperty("timestamp")
      expect(data).toHaveProperty("health")
      expect(data.health).toHaveProperty("status")
      expect(data.health).toHaveProperty("score")
      expect(data).toHaveProperty("sources")
      expect(data).toHaveProperty("rules")
      expect(data).toHaveProperty("evidence")
      expect(data).toHaveProperty("conflicts")
      expect(data).toHaveProperty("agents")
      expect(data).toHaveProperty("recentActivity")
    })

    it("returns health status in expected format", async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: "admin-1",
        email: "admin@example.com",
        systemRole: "ADMIN",
      })

      const request = new NextRequest("http://localhost:3000/api/admin/regulatory-truth/status", {
        method: "GET",
      })

      const response = await GET(request)
      const data = await response.json()

      // Health status should be one of the expected values
      expect(["healthy", "warning", "critical"]).toContain(data.health.status)
      expect(typeof data.health.score).toBe("number")
      expect(data.health.score).toBeGreaterThanOrEqual(0)
      expect(data.health.score).toBeLessThanOrEqual(100)
    })
  })
})
