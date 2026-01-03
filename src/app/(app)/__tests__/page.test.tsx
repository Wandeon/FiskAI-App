// src/app/(app)/__tests__/page.test.tsx
/**
 * Tests for App Portal Root Page
 *
 * Verifies that the root page redirects to control-center.
 *
 * @since Control Center Routing - Phase 1
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { redirect } from "next/navigation"

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

// Mock auth - returns session-like object or null
const mockAuthReturn = { value: null as unknown }
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(mockAuthReturn.value)),
}))

describe("App Root Page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("redirects to control-center when user is authenticated", async () => {
    mockAuthReturn.value = {
      user: { id: "user-1", email: "test@example.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    }

    const { default: Page } = await import("../page")
    await Page()
    expect(redirect).toHaveBeenCalledWith("/control-center")
  })

  it("redirects to login when user is not authenticated", async () => {
    mockAuthReturn.value = null

    const { default: Page } = await import("../page")
    await Page()
    expect(redirect).toHaveBeenCalledWith("/login")
  })
})
