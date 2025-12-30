# Premises Auth Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Require authentication and tenant scoping for premises/device actions and bulk actions to prevent cross-tenant access.

**Architecture:** Wrap actions with `requireAuth()` and `requireCompanyWithContext()` to establish tenant context, then explicitly scope `updateMany`, `count`, and `deleteMany` operations by `companyId` (these are not scoped by the Prisma tenant extension). Validate ownership of `businessPremisesId` before creating devices or bulk assignments.

**Tech Stack:** TypeScript, Next.js Server Actions, Prisma, Vitest.

---

### Task 1: Add failing test for createPremises uses context company ID

**Files:**
- Create: `src/app/actions/__tests__/premises.test.ts`

**Step 1: Write the failing test**

```ts
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: FAIL (calls use `companyId` from input instead of auth context).

**Step 3: Write minimal implementation**

Update `src/app/actions/premises.ts`:

```ts
import { requireAuth, requireCompanyWithContext } from "@/lib/auth-utils"

export async function createPremises(input: CreatePremisesInput): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      if (input.code < 1) {
        return { success: false, error: "Kod mora biti pozitivan broj" }
      }

      const existing = await db.businessPremises.findUnique({
        where: {
          companyId_code: {
            companyId: company.id,
            code: input.code,
          },
        },
      })

      if (existing) {
        return { success: false, error: `Poslovni prostor s kodom ${input.code} već postoji` }
      }

      if (input.isDefault) {
        await db.businessPremises.updateMany({
          where: { companyId: company.id, isDefault: true },
          data: { isDefault: false },
        })
      }

      const premises = await db.businessPremises.create({
        data: {
          companyId: company.id,
          code: input.code,
          name: input.name,
          address: input.address,
          isDefault: input.isDefault ?? false,
          isActive: true,
        },
      })

      revalidatePath("/settings/premises")
      return { success: true, data: premises }
    })
  } catch (error) {
    console.error("Failed to create premises:", error)
    return { success: false, error: "Greška pri stvaranju poslovnog prostora" }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/actions/premises.ts src/app/actions/__tests__/premises.test.ts
git commit -m "test: add createPremises auth scoping"
```

---

### Task 2: Add failing test for createDevice rejects non-owned premises

**Files:**
- Modify: `src/app/actions/__tests__/premises.test.ts`

**Step 1: Write the failing test**

```ts
import { createDevice } from "@/app/actions/premises"

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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: FAIL (currently creates device without ownership check).

**Step 3: Write minimal implementation**

Update `src/app/actions/premises.ts`:

```ts
export async function createDevice(input: CreateDeviceInput): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      if (input.code < 1) {
        return { success: false, error: "Kod mora biti pozitivan broj" }
      }

      const premises = await db.businessPremises.findFirst({
        where: { id: input.businessPremisesId, companyId: company.id },
      })

      if (!premises) {
        return { success: false, error: "Poslovni prostor nije pronađen" }
      }

      const existing = await db.paymentDevice.findUnique({
        where: {
          businessPremisesId_code: {
            businessPremisesId: input.businessPremisesId,
            code: input.code,
          },
        },
      })

      if (existing) {
        return {
          success: false,
          error: `Naplatni uređaj s kodom ${input.code} već postoji u ovom poslovnom prostoru`,
        }
      }

      if (input.isDefault) {
        await db.paymentDevice.updateMany({
          where: {
            businessPremisesId: input.businessPremisesId,
            companyId: company.id,
            isDefault: true,
          },
          data: { isDefault: false },
        })
      }

      const device = await db.paymentDevice.create({
        data: {
          companyId: company.id,
          businessPremisesId: input.businessPremisesId,
          code: input.code,
          name: input.name,
          isDefault: input.isDefault ?? false,
          isActive: true,
        },
      })

      revalidatePath("/settings/premises")
      return { success: true, data: device }
    })
  } catch (error) {
    console.error("Failed to create device:", error)
    return { success: false, error: "Greška pri stvaranju naplatnog uređaja" }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/actions/premises.ts src/app/actions/__tests__/premises.test.ts
git commit -m "test: enforce premises ownership for createDevice"
```

---

### Task 3: Add failing test for updatePremises uses company-scoped lookup

**Files:**
- Modify: `src/app/actions/__tests__/premises.test.ts`

**Step 1: Write the failing test**

```ts
import { updatePremises } from "@/app/actions/premises"

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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: FAIL (currently uses findUnique without companyId).

**Step 3: Write minimal implementation**

Update `src/app/actions/premises.ts`:

```ts
export async function updatePremises(
  id: string,
  input: Partial<Omit<CreatePremisesInput, "companyId">>
): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      const existing = await db.businessPremises.findFirst({
        where: { id, companyId: company.id },
      })
      if (!existing) {
        return { success: false, error: "Poslovni prostor nije pronađen" }
      }

      if (input.code && input.code !== existing.code) {
        const duplicate = await db.businessPremises.findUnique({
          where: {
            companyId_code: {
              companyId: company.id,
              code: input.code,
            },
          },
        })
        if (duplicate) {
          return { success: false, error: `Poslovni prostor s kodom ${input.code} već postoji` }
        }
      }

      if (input.isDefault) {
        await db.businessPremises.updateMany({
          where: { companyId: company.id, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        })
      }

      const premises = await db.businessPremises.update({
        where: { id },
        data: input,
      })

      revalidatePath("/settings/premises")
      return { success: true, data: premises }
    })
  } catch (error) {
    console.error("Failed to update premises:", error)
    return { success: false, error: "Greška pri ažuriranju poslovnog prostora" }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/actions/premises.ts src/app/actions/__tests__/premises.test.ts
git commit -m "test: scope updatePremises lookup to company"
```

---

### Task 4: Add failing test for deletePremises uses company-scoped counts and deleteMany

**Files:**
- Modify: `src/app/actions/__tests__/premises.test.ts`

**Step 1: Write the failing test**

```ts
import { deletePremises } from "@/app/actions/premises"

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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: FAIL (counts not scoped; delete uses delete, not deleteMany).

**Step 3: Write minimal implementation**

Update `src/app/actions/premises.ts`:

```ts
export async function deletePremises(id: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      const deviceCount = await db.paymentDevice.count({
        where: { businessPremisesId: id, companyId: company.id },
      })

      if (deviceCount > 0) {
        return {
          success: false,
          error: "Nije moguće obrisati poslovni prostor koji ima naplatne uređaje",
        }
      }

      const sequenceCount = await db.invoiceSequence.count({
        where: { businessPremisesId: id, companyId: company.id },
      })

      if (sequenceCount > 0) {
        return {
          success: false,
          error: "Nije moguće obrisati poslovni prostor koji ima povijesne račune",
        }
      }

      const deleted = await db.businessPremises.deleteMany({
        where: { id, companyId: company.id },
      })

      if (deleted.count === 0) {
        return { success: false, error: "Poslovni prostor nije pronađen" }
      }

      revalidatePath("/settings/premises")
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to delete premises:", error)
    return { success: false, error: "Greška pri brisanju poslovnog prostora" }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/actions/premises.ts src/app/actions/__tests__/premises.test.ts
git commit -m "test: scope deletePremises to company"
```

---

### Task 5: Add failing test for updateDevice uses company-scoped lookup

**Files:**
- Modify: `src/app/actions/__tests__/premises.test.ts`

**Step 1: Write the failing test**

```ts
import { updateDevice } from "@/app/actions/premises"

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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: FAIL (currently uses findUnique without companyId).

**Step 3: Write minimal implementation**

Update `src/app/actions/premises.ts`:

```ts
export async function updateDevice(
  id: string,
  input: Partial<Omit<CreateDeviceInput, "companyId" | "businessPremisesId">>
): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      const existing = await db.paymentDevice.findFirst({
        where: { id, companyId: company.id },
      })
      if (!existing) {
        return { success: false, error: "Naplatni uređaj nije pronađen" }
      }

      if (input.code && input.code !== existing.code) {
        const duplicate = await db.paymentDevice.findUnique({
          where: {
            businessPremisesId_code: {
              businessPremisesId: existing.businessPremisesId,
              code: input.code,
            },
          },
        })
        if (duplicate) {
          return { success: false, error: `Naplatni uređaj s kodom ${input.code} već postoji` }
        }
      }

      if (input.isDefault) {
        await db.paymentDevice.updateMany({
          where: {
            businessPremisesId: existing.businessPremisesId,
            companyId: company.id,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        })
      }

      const device = await db.paymentDevice.update({
        where: { id },
        data: input,
      })

      revalidatePath("/settings/premises")
      return { success: true, data: device }
    })
  } catch (error) {
    console.error("Failed to update device:", error)
    return { success: false, error: "Greška pri ažuriranju naplatnog uređaja" }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/actions/premises.ts src/app/actions/__tests__/premises.test.ts
git commit -m "test: scope updateDevice lookup to company"
```

---

### Task 6: Add failing test for deleteDevice uses deleteMany with company scope

**Files:**
- Modify: `src/app/actions/__tests__/premises.test.ts`

**Step 1: Write the failing test**

```ts
import { deleteDevice } from "@/app/actions/premises"

it("deleteDevice scopes deletion to auth company", async () => {
  vi.mocked(db.paymentDevice.deleteMany).mockResolvedValue({ count: 0 } as any)

  const result = await deleteDevice("dev-1")

  expect(db.paymentDevice.deleteMany).toHaveBeenCalledWith({
    where: { id: "dev-1", companyId: "company-1" },
  })
  expect(result.success).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: FAIL (currently uses delete).

**Step 3: Write minimal implementation**

Update `src/app/actions/premises.ts`:

```ts
export async function deleteDevice(id: string): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      const deleted = await db.paymentDevice.deleteMany({
        where: { id, companyId: company.id },
      })

      if (deleted.count === 0) {
        return { success: false, error: "Naplatni uređaj nije pronađen" }
      }

      revalidatePath("/settings/premises")
      return { success: true }
    })
  } catch (error) {
    console.error("Failed to delete device:", error)
    return { success: false, error: "Greška pri brisanju naplatnog uređaja" }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/actions/premises.ts src/app/actions/__tests__/premises.test.ts
git commit -m "test: scope deleteDevice to company"
```

---

### Task 7: Add failing test for getDefaultPremisesAndDevice uses auth company

**Files:**
- Modify: `src/app/actions/__tests__/premises.test.ts`

**Step 1: Write the failing test**

```ts
import { getDefaultPremisesAndDevice } from "@/app/actions/premises"

it("getDefaultPremisesAndDevice uses auth company", async () => {
  vi.mocked(db.businessPremises.findFirst).mockResolvedValue(null as any)

  await getDefaultPremisesAndDevice("company-999")

  expect(db.businessPremises.findFirst).toHaveBeenCalledWith({
    where: { companyId: "company-1", isDefault: true, isActive: true },
    select: { id: true, code: true, name: true },
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: FAIL (currently uses companyId parameter).

**Step 3: Write minimal implementation**

Update `src/app/actions/premises.ts`:

```ts
export async function getDefaultPremisesAndDevice(_companyId: string): Promise<{
  premises: { id: string; code: number; name: string } | null
  device: { id: string; code: number; name: string } | null
}> {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async (company) => {
    const premises = await db.businessPremises.findFirst({
      where: { companyId: company.id, isDefault: true, isActive: true },
      select: { id: true, code: true, name: true },
    })

    if (!premises) {
      return { premises: null, device: null }
    }

    const device = await db.paymentDevice.findFirst({
      where: { businessPremisesId: premises.id, isDefault: true, isActive: true },
      select: { id: true, code: true, name: true },
    })

    return { premises, device }
  })
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/actions/__tests__/premises.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/actions/premises.ts src/app/actions/__tests__/premises.test.ts
git commit -m "test: scope getDefaultPremisesAndDevice to company"
```

---

### Task 8: Add failing test for bulkTogglePremisesStatus scopes by company

**Files:**
- Create: `src/lib/premises/__tests__/bulk-actions.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    businessPremises: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    paymentDevice: {
      findMany: vi.fn(),
      create: vi.fn(),
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
import { bulkTogglePremisesStatus } from "@/lib/premises/bulk-actions"

const user = { id: "user-1" }
const company = { id: "company-1" }

describe("premises bulk actions auth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(user as any)
    vi.mocked(requireCompanyWithContext).mockImplementation(async (_userId, fn) => {
      return fn(company as any, user as any)
    })
  })

  it("bulkTogglePremisesStatus scopes updateMany by company", async () => {
    vi.mocked(db.businessPremises.updateMany).mockResolvedValue({ count: 1 } as any)

    await bulkTogglePremisesStatus(["prem-1"], true)

    expect(db.businessPremises.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["prem-1"] }, companyId: "company-1" },
      data: { isActive: true },
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/premises/__tests__/bulk-actions.test.ts`
Expected: FAIL (currently no auth and no company scoping).

**Step 3: Write minimal implementation**

Update `src/lib/premises/bulk-actions.ts`:

```ts
import { requireAuth, requireCompanyWithContext } from "@/lib/auth-utils"

export async function bulkTogglePremisesStatus(
  premisesIds: string[],
  isActive: boolean
): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      const result = await db.businessPremises.updateMany({
        where: { id: { in: premisesIds }, companyId: company.id },
        data: { isActive },
      })

      revalidatePath("/settings/premises")
      return {
        success: true,
        data: { updated: result.count },
      }
    })
  } catch (error) {
    console.error("Failed to bulk toggle premises status:", error)
    return { success: false, error: "Greska pri azuriranju statusa poslovnih prostora" }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/premises/__tests__/bulk-actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/premises/bulk-actions.ts src/lib/premises/__tests__/bulk-actions.test.ts
git commit -m "test: scope bulkTogglePremisesStatus to company"
```

---

### Task 9: Add failing test for bulkImportPremises uses company context

**Files:**
- Modify: `src/lib/premises/__tests__/bulk-actions.test.ts`

**Step 1: Write the failing test**

```ts
import { bulkImportPremises } from "@/lib/premises/bulk-actions"

it("bulkImportPremises scopes default reset to company", async () => {
  vi.mocked(db.businessPremises.findMany).mockResolvedValue([] as any)
  vi.mocked(db.businessPremises.updateMany).mockResolvedValue({ count: 1 } as any)
  vi.mocked(db.businessPremises.create).mockResolvedValue({ id: "prem-1" } as any)

  await bulkImportPremises("company-999", [
    { code: 1, name: "Main", isDefault: true },
  ])

  expect(db.businessPremises.updateMany).toHaveBeenCalledWith({
    where: { companyId: "company-1", isDefault: true },
    data: { isDefault: false },
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/premises/__tests__/bulk-actions.test.ts`
Expected: FAIL (uses input companyId).

**Step 3: Write minimal implementation**

Update `src/lib/premises/bulk-actions.ts`:

```ts
export async function bulkImportPremises(
  _companyId: string,
  rows: BulkImportRow[]
): Promise<BulkImportResult> {
  let created = 0
  let skipped = 0
  const errors: string[] = []

  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async (company) => {
    const existing = await db.businessPremises.findMany({
      where: { companyId: company.id },
      select: { code: true },
    })
    const existingCodes = new Set(existing.map((p) => p.code))

    const hasNewDefault = rows.some((r) => r.isDefault)

    if (hasNewDefault) {
      await db.businessPremises.updateMany({
        where: { companyId: company.id, isDefault: true },
        data: { isDefault: false },
      })
    }

    let defaultSet = false

    for (const row of rows) {
      if (existingCodes.has(row.code)) {
        skipped++
        errors.push(`Kod ${row.code} vec postoji - preskoceno`)
        continue
      }

      try {
        const isDefault = row.isDefault && !defaultSet

        await db.businessPremises.create({
          data: {
            companyId: company.id,
            code: row.code,
            name: row.name,
            address: row.address,
            isDefault,
            isActive: true,
          },
        })
        created++
        existingCodes.add(row.code)

        if (isDefault) {
          defaultSet = true
        }
      } catch (error) {
        console.error(`Failed to create premises ${row.code}:`, error)
        errors.push(`Greska pri stvaranju poslovnog prostora ${row.code}`)
      }
    }

    revalidatePath("/settings/premises")
    return { success: errors.length === 0, created, skipped, errors }
  })
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/premises/__tests__/bulk-actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/premises/bulk-actions.ts src/lib/premises/__tests__/bulk-actions.test.ts
git commit -m "test: scope bulkImportPremises to company"
```

---

### Task 10: Add failing test for clonePremises rejects non-owned premises

**Files:**
- Modify: `src/lib/premises/__tests__/bulk-actions.test.ts`

**Step 1: Write the failing test**

```ts
import { clonePremises } from "@/lib/premises/bulk-actions"

it("clonePremises rejects non-owned premises", async () => {
  vi.mocked(db.businessPremises.findFirst).mockResolvedValue(null as any)

  const result = await clonePremises("prem-9", 2, "Clone")

  expect(result.success).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/premises/__tests__/bulk-actions.test.ts`
Expected: FAIL (currently uses findUnique without auth).

**Step 3: Write minimal implementation**

Update `src/lib/premises/bulk-actions.ts`:

```ts
export async function clonePremises(
  premisesId: string,
  newCode: number,
  newName: string
): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      const source = await db.businessPremises.findFirst({
        where: { id: premisesId, companyId: company.id },
        include: { devices: true },
      })

      if (!source) {
        return { success: false, error: "Izvorni poslovni prostor nije pronaden" }
      }

      const existing = await db.businessPremises.findUnique({
        where: {
          companyId_code: {
            companyId: company.id,
            code: newCode,
          },
        },
      })

      if (existing) {
        return { success: false, error: `Poslovni prostor s kodom ${newCode} vec postoji` }
      }

      const newPremises = await db.businessPremises.create({
        data: {
          companyId: company.id,
          code: newCode,
          name: newName,
          address: source.address,
          isDefault: false,
          isActive: true,
        },
      })

      for (const device of source.devices) {
        await db.paymentDevice.create({
          data: {
            companyId: company.id,
            businessPremisesId: newPremises.id,
            code: device.code,
            name: device.name,
            isDefault: device.isDefault,
            isActive: true,
          },
        })
      }

      revalidatePath("/settings/premises")
      return {
        success: true,
        data: {
          premises: newPremises,
          devicesCloned: source.devices.length,
        },
      }
    })
  } catch (error) {
    console.error("Failed to clone premises:", error)
    return { success: false, error: "Greska pri kloniranju poslovnog prostora" }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/premises/__tests__/bulk-actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/premises/bulk-actions.ts src/lib/premises/__tests__/bulk-actions.test.ts
git commit -m "test: scope clonePremises to company"
```

---

### Task 11: Add failing test for bulkAssignDevices rejects non-owned premises

**Files:**
- Modify: `src/lib/premises/__tests__/bulk-actions.test.ts`

**Step 1: Write the failing test**

```ts
import { bulkAssignDevices } from "@/lib/premises/bulk-actions"

it("bulkAssignDevices rejects non-owned premises", async () => {
  vi.mocked(db.businessPremises.findFirst).mockResolvedValue(null as any)

  const result = await bulkAssignDevices("company-999", "prem-9", 2, "POS")

  expect(result.success).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/premises/__tests__/bulk-actions.test.ts`
Expected: FAIL (no ownership check).

**Step 3: Write minimal implementation**

Update `src/lib/premises/bulk-actions.ts`:

```ts
export async function bulkAssignDevices(
  _companyId: string,
  premisesId: string,
  count: number,
  namePrefix: string,
  startCode: number = 1
): Promise<ActionResult> {
  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      const premises = await db.businessPremises.findFirst({
        where: { id: premisesId, companyId: company.id },
      })

      if (!premises) {
        return { success: false, error: "Poslovni prostor nije pronađen" }
      }

      const existingDevices = await db.paymentDevice.findMany({
        where: { businessPremisesId: premisesId },
        select: { code: true },
      })
      const existingCodes = new Set(existingDevices.map((d) => d.code))

      const created: number[] = []
      let currentCode = startCode

      for (let i = 0; i < count; i++) {
        while (existingCodes.has(currentCode)) {
          currentCode++
        }

        await db.paymentDevice.create({
          data: {
            companyId: company.id,
            businessPremisesId: premisesId,
            code: currentCode,
            name: `${namePrefix} ${currentCode}`,
            isDefault: existingDevices.length === 0 && i === 0,
            isActive: true,
          },
        })

        created.push(currentCode)
        existingCodes.add(currentCode)
        currentCode++
      }

      revalidatePath("/settings/premises")
      return {
        success: true,
        data: { created: created.length, codes: created },
      }
    })
  } catch (error) {
    console.error("Failed to bulk assign devices:", error)
    return { success: false, error: "Greska pri stvaranju naplatnih uredaja" }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/premises/__tests__/bulk-actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/premises/bulk-actions.ts src/lib/premises/__tests__/bulk-actions.test.ts
git commit -m "test: scope bulkAssignDevices to company"
```
