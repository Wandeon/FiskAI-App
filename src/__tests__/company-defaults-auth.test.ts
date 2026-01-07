import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    companyUser: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

const redirectMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("redirect")
  })
)

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}))

import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { requireCompany } from "@/lib/auth-utils"

describe("company default enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("redirects to choose-company when no default exists", async () => {
    vi.mocked(db.companyUser.findFirst)
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce({ id: "company-user-1" } as any)

    await expect(requireCompany("user-1")).rejects.toThrow("redirect")

    expect(redirect).toHaveBeenCalledWith("/onboarding/choose-company")
  })
})
