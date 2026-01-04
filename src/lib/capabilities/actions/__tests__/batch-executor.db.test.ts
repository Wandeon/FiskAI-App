/**
 * Batch Action Executor Tests
 *
 * Tests for the executeBatchAction server action that processes
 * multiple entities with the same capability action.
 *
 * @module capabilities/actions
 * @since PHASE 4 - Capability Batch Actions
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth and db
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock the executor module to avoid deep dependencies
vi.mock("../executor", () => ({
  executeCapabilityAction: vi.fn(),
}))

// Import after mocks
import { executeBatchAction } from "../batch-executor"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { executeCapabilityAction } from "../executor"

// Cast mocks for type safety
const mockAuth = auth as ReturnType<typeof vi.fn>
const mockExecuteCapabilityAction = executeCapabilityAction as ReturnType<typeof vi.fn>
const mockUserFindUnique = db.user.findUnique as ReturnType<typeof vi.fn>

describe("executeBatchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns unauthorized when no session", async () => {
    mockAuth.mockResolvedValue(null)

    const result = await executeBatchAction({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityIds: ["inv-1"],
      entityType: "Invoice",
    })

    expect(result.total).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.results[0].code).toBe("UNAUTHORIZED")
  })

  it("returns empty result for empty entityIds", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })

    const result = await executeBatchAction({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityIds: [],
      entityType: "Invoice",
    })

    expect(result.total).toBe(0)
    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.results).toEqual([])
  })

  it("processes multiple entities and aggregates results", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      systemRole: "USER",
      companies: [{ companyId: "comp-1", role: "ADMIN" }],
    })

    // Mock executeCapabilityAction to return success for each entity
    mockExecuteCapabilityAction
      .mockResolvedValueOnce({ success: true, data: { fiscalized: true } })
      .mockResolvedValueOnce({ success: true, data: { fiscalized: true } })

    const result = await executeBatchAction({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityIds: ["inv-1", "inv-2"],
      entityType: "Invoice",
    })

    expect(result.total).toBe(2)
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.succeeded + result.failed).toBe(2)
  })

  it("handles mixed success and failure results", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })

    mockExecuteCapabilityAction
      .mockResolvedValueOnce({ success: true, data: { fiscalized: true } })
      .mockResolvedValueOnce({ success: false, error: "Entity not found", code: "NOT_FOUND" })
      .mockResolvedValueOnce({ success: true, data: { fiscalized: true } })

    const result = await executeBatchAction({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityIds: ["inv-1", "inv-2", "inv-3"],
      entityType: "Invoice",
    })

    expect(result.total).toBe(3)
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.results[0].success).toBe(true)
    expect(result.results[1].success).toBe(false)
    expect(result.results[1].code).toBe("NOT_FOUND")
    expect(result.results[2].success).toBe(true)
  })

  it("stops processing on error when continueOnError is false", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })

    mockExecuteCapabilityAction
      .mockResolvedValueOnce({ success: true, data: { fiscalized: true } })
      .mockResolvedValueOnce({ success: false, error: "Entity not found", code: "NOT_FOUND" })
      .mockResolvedValueOnce({ success: true, data: { fiscalized: true } })

    const result = await executeBatchAction({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityIds: ["inv-1", "inv-2", "inv-3"],
      entityType: "Invoice",
      continueOnError: false,
    })

    // Should stop after the failure
    expect(result.total).toBe(2)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(mockExecuteCapabilityAction).toHaveBeenCalledTimes(2)
  })

  it("continues processing by default when errors occur", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })

    mockExecuteCapabilityAction
      .mockResolvedValueOnce({ success: false, error: "First error", code: "NOT_FOUND" })
      .mockResolvedValueOnce({ success: true, data: { done: true } })

    const result = await executeBatchAction({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityIds: ["inv-1", "inv-2"],
      entityType: "Invoice",
    })

    expect(result.total).toBe(2)
    expect(mockExecuteCapabilityAction).toHaveBeenCalledTimes(2)
  })

  it("passes params to each action call", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })
    mockExecuteCapabilityAction.mockResolvedValue({ success: true })

    await executeBatchAction({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityIds: ["inv-1", "inv-2"],
      entityType: "Invoice",
      params: { force: true },
    })

    expect(mockExecuteCapabilityAction).toHaveBeenCalledWith({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityId: "inv-1",
      entityType: "Invoice",
      params: { force: true },
    })

    expect(mockExecuteCapabilityAction).toHaveBeenCalledWith({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityId: "inv-2",
      entityType: "Invoice",
      params: { force: true },
    })
  })

  it("preserves entityId and data in individual results", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } })

    mockExecuteCapabilityAction
      .mockResolvedValueOnce({ success: true, data: { id: "result-1" } })
      .mockResolvedValueOnce({ success: true, data: { id: "result-2" } })

    const result = await executeBatchAction({
      capabilityId: "INV-003",
      actionId: "fiscalize",
      entityIds: ["inv-1", "inv-2"],
      entityType: "Invoice",
    })

    expect(result.results[0].entityId).toBe("inv-1")
    expect(result.results[0].data).toEqual({ id: "result-1" })
    expect(result.results[1].entityId).toBe("inv-2")
    expect(result.results[1].data).toEqual({ id: "result-2" })
  })
})
