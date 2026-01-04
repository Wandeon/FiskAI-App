// src/app/(app)/app-control-center/__tests__/page.test.tsx
/**
 * Client Control Center Tests
 *
 * Verifies the Control Center queue definitions.
 *
 * @since Control Center Shells
 */

import { describe, it, expect, vi } from "vitest"

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "test-user" } }),
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        companies: [{ companyId: "test-company" }],
      }),
    },
    eInvoice: { findMany: vi.fn().mockResolvedValue([]) },
    bankTransaction: { findMany: vi.fn().mockResolvedValue([]) },
    expense: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock("@/lib/capabilities/server", () => ({
  resolveCapabilitiesForUser: vi.fn().mockResolvedValue([]),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

describe("Client Control Center", () => {
  it("should define all required queues", async () => {
    const { CLIENT_QUEUES } = await import("../queues")

    expect(CLIENT_QUEUES).toHaveLength(5)
    expect(CLIENT_QUEUES.map((q) => q.id)).toEqual([
      "draft-invoices",
      "pending-fiscalization",
      "unmatched-transactions",
      "unpaid-invoices",
      "unpaid-expenses",
    ])
  })

  it("should have capability IDs for each queue", async () => {
    const { CLIENT_QUEUES } = await import("../queues")

    for (const queue of CLIENT_QUEUES) {
      expect(queue.capabilityIds.length).toBeGreaterThan(0)
      expect(queue.entityType).toBeTruthy()
    }
  })
})

describe("Accountant Control Center", () => {
  it("should define all required queues", async () => {
    const { ACCOUNTANT_QUEUES } = await import("../../../(staff)/staff-control-center/queues")

    expect(ACCOUNTANT_QUEUES).toHaveLength(3)
    expect(ACCOUNTANT_QUEUES.map((q) => q.id)).toEqual([
      "clients-pending-review",
      "period-lock-requests",
      "pending-invitations",
    ])
  })
})

describe("Admin Control Center", () => {
  it("should define all required queues", async () => {
    const { ADMIN_QUEUES } = await import("../../../(admin)/admin-control-center/queues")

    expect(ADMIN_QUEUES).toHaveLength(4)
    expect(ADMIN_QUEUES.map((q) => q.id)).toEqual([
      "system-alerts",
      "rtl-conflicts",
      "pending-news",
      "failed-jobs",
    ])
  })
})
