import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    company: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    companyUser: {
      updateMany: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"
import { createCompany } from "@/app/actions/company"
import { switchCompany } from "@/lib/actions/company-switch"

describe("company default handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue({ id: "user-1" } as any)
    vi.mocked(db.$transaction).mockImplementation(async (operations) => Promise.all(operations))
  })

  it("creating a new company clears previous defaults", async () => {
    vi.mocked(db.company.findUnique).mockResolvedValue(null as any)
    vi.mocked(db.company.create).mockResolvedValue({ id: "company-2" } as any)
    vi.mocked(db.companyUser.updateMany).mockResolvedValue({ count: 1 } as any)

    await createCompany({
      name: "Nova tvrtka",
      oib: "12345678903",
      address: "Adresa 1",
      city: "Zagreb",
      postalCode: "10000",
      country: "HR",
      email: "test@example.com",
      phone: "",
      iban: "",
      isVatPayer: false,
      legalForm: "DOO",
      competence: "guided",
    })

    expect(db.companyUser.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { isDefault: false },
    })
    expect(db.company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          users: {
            create: expect.objectContaining({
              isDefault: true,
            }),
          },
        }),
      })
    )
  })

  it("switchCompany clears defaults before setting the new one", async () => {
    vi.mocked(db.companyUser.findFirst).mockResolvedValue({
      id: "company-user-1",
      company: { id: "company-1", name: "Alpha", oib: "12345678903" },
    } as any)
    vi.mocked(db.companyUser.updateMany).mockResolvedValue({ count: 2 } as any)
    vi.mocked(db.companyUser.update).mockResolvedValue({ id: "company-user-1" } as any)

    const result = await switchCompany("company-1")

    expect(db.companyUser.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { isDefault: false },
    })
    expect(db.companyUser.update).toHaveBeenCalledWith({
      where: { id: "company-user-1" },
      data: { isDefault: true },
    })
    expect(result).toEqual({
      success: true,
      company: { id: "company-1", name: "Alpha", oib: "12345678903" },
    })
  })
})
