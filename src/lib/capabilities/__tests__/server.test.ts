// src/lib/capabilities/__tests__/server.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolveCapabilitiesForUser } from "../server"

// Mock the resolver
vi.mock("../resolver", () => ({
  resolveCapabilities: vi.fn(),
}))

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

// Mock db
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

describe("resolveCapabilitiesForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return UNAUTHORIZED for unauthenticated users", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValue(null)

    const result = await resolveCapabilitiesForUser(["INV-001"])

    expect(result).toHaveLength(1)
    expect(result[0].state).toBe("UNAUTHORIZED")
  })

  it("should resolve capabilities for authenticated users", async () => {
    const { auth } = await import("@/lib/auth")
    const { db } = await import("@/lib/db")
    const { resolveCapabilities } = await import("../resolver")

    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any)

    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1",
      systemRole: "USER",
      companies: [{ companyId: "company-1", role: "OWNER", isDefault: true }],
    } as any)

    vi.mocked(resolveCapabilities).mockResolvedValue([
      {
        capability: "INV-001",
        state: "READY",
        inputs: [],
        blockers: [],
        actions: [],
        resolvedAt: new Date().toISOString(),
      },
    ])

    const result = await resolveCapabilitiesForUser(["INV-001"])

    expect(result).toHaveLength(1)
    expect(result[0].state).toBe("READY")
  })

  it("should return UNAUTHORIZED when user has no company membership", async () => {
    const { auth } = await import("@/lib/auth")
    const { db } = await import("@/lib/db")

    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any)

    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "user-1",
      systemRole: "USER",
      companies: [],
    } as any)

    const result = await resolveCapabilitiesForUser(["INV-001"])

    expect(result).toHaveLength(1)
    expect(result[0].state).toBe("UNAUTHORIZED")
  })

  it("should return UNAUTHORIZED when user not found in database", async () => {
    const { auth } = await import("@/lib/auth")
    const { db } = await import("@/lib/db")

    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any)

    vi.mocked(db.user.findUnique).mockResolvedValue(null)

    const result = await resolveCapabilitiesForUser(["INV-001"])

    expect(result).toHaveLength(1)
    expect(result[0].state).toBe("UNAUTHORIZED")
  })
})
