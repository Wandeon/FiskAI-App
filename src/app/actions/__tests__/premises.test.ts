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
import {
  createPremises,
  createDevice,
  updatePremises,
  deletePremises,
  updateDevice,
  deleteDevice,
  getDefaultPremisesAndDevice,
} from "@/app/actions/premises"

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

  it("createDevice rejects when premises is not owned", async () => {
    vi.mocked(db.businessPremises.findFirst).mockResolvedValue(null as any)
    vi.mocked(db.paymentDevice.findUnique).mockResolvedValue(null as any)
    vi.mocked(db.paymentDevice.create).mockResolvedValue({ id: "dev-1" } as any)

    const result = await createDevice({
      companyId: "company-999",
      businessPremisesId: "prem-9",
      code: 1,
      name: "POS 1",
    })

    expect(result.success).toBe(false)
    expect(db.paymentDevice.create).not.toHaveBeenCalled()
  })

  it("updatePremises scopes lookup to auth company", async () => {
    vi.mocked(db.businessPremises.findFirst).mockResolvedValue({
      id: "prem-1",
      companyId: "company-1",
      code: 1,
    } as any)
    vi.mocked(db.businessPremises.update).mockResolvedValue({ id: "prem-1" } as any)

    await updatePremises("prem-1", { name: "Updated" })

    expect(db.businessPremises.findFirst).toHaveBeenCalledWith({
      where: { id: "prem-1", companyId: "company-1" },
    })
  })

  it("deletePremises scopes counts and delete by company", async () => {
    vi.mocked(db.paymentDevice.count).mockResolvedValue(0)
    vi.mocked(db.invoiceSequence.count).mockResolvedValue(0)
    vi.mocked(db.businessPremises.deleteMany).mockResolvedValue({ count: 0 } as any)

    const result = await deletePremises("prem-1")

    expect(db.paymentDevice.count).toHaveBeenCalledWith({
      where: { businessPremisesId: "prem-1", companyId: "company-1" },
    })
    expect(db.invoiceSequence.count).toHaveBeenCalledWith({
      where: { businessPremisesId: "prem-1", companyId: "company-1" },
    })
    expect(db.businessPremises.deleteMany).toHaveBeenCalledWith({
      where: { id: "prem-1", companyId: "company-1" },
    })
    expect(result.success).toBe(false)
  })

  it("updateDevice scopes lookup to auth company", async () => {
    vi.mocked(db.paymentDevice.findFirst).mockResolvedValue({
      id: "dev-1",
      companyId: "company-1",
      businessPremisesId: "prem-1",
      code: 1,
    } as any)
    vi.mocked(db.paymentDevice.update).mockResolvedValue({ id: "dev-1" } as any)

    await updateDevice("dev-1", { name: "POS" })

    expect(db.paymentDevice.findFirst).toHaveBeenCalledWith({
      where: { id: "dev-1", companyId: "company-1" },
    })
  })

  it("deleteDevice scopes deletion to auth company", async () => {
    vi.mocked(db.paymentDevice.deleteMany).mockResolvedValue({ count: 0 } as any)

    const result = await deleteDevice("dev-1")

    expect(db.paymentDevice.deleteMany).toHaveBeenCalledWith({
      where: { id: "dev-1", companyId: "company-1" },
    })
    expect(result.success).toBe(false)
  })

  it("getDefaultPremisesAndDevice uses auth company", async () => {
    vi.mocked(db.businessPremises.findFirst).mockResolvedValue(null as any)

    await getDefaultPremisesAndDevice("company-999")

    expect(db.businessPremises.findFirst).toHaveBeenCalledWith({
      where: { companyId: "company-1", isDefault: true, isActive: true },
      select: { id: true, code: true, name: true },
    })
  })
})
