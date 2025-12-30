import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    businessPremises: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    paymentDevice: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    invoiceSequence: {
      count: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn(),
  requireCompanyWithContext: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { db } from "@/lib/db"
import { requireAuth, requireCompanyWithContext } from "@/lib/auth-utils"
import { createPremises } from "@/app/actions/premises"

const user = { id: "user-1" }
const company = { id: "company-1" }

describe("premises actions auth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(user as any)
    vi.mocked(requireCompanyWithContext).mockImplementation(async (_userId, fn) => {
      return fn(company as any, user as any)
    })
  })

  it("createPremises uses company from auth context", async () => {
    vi.mocked(db.businessPremises.findUnique).mockResolvedValue(null as any)
    vi.mocked(db.businessPremises.create).mockResolvedValue({ id: "prem-1" } as any)

    await createPremises({
      companyId: "company-999",
      code: 1,
      name: "Main",
      isDefault: false,
    })

    expect(db.businessPremises.findUnique).toHaveBeenCalledWith({
      where: {
        companyId_code: {
          companyId: "company-1",
          code: 1,
        },
      },
    })

    expect(db.businessPremises.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
      }),
    })
  })
})
