// src/app/(app)/__tests__/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { redirect } from "next/navigation"

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { auth } from "@/lib/auth"

describe("App Root Page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects to control-center when user is authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", email: "test@example.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })

    const { default: Page } = await import("../page")
    await Page()
    expect(redirect).toHaveBeenCalledWith("/control-center")
  })

  it("redirects to login when user is not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null)

    // Need to re-import to get fresh module
    vi.resetModules()
    vi.mock("next/navigation", () => ({
      redirect: vi.fn(),
    }))
    vi.mock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(null),
    }))

    const { default: Page } = await import("../page")
    await Page()
    expect(redirect).toHaveBeenCalledWith("/login")
  })
})
