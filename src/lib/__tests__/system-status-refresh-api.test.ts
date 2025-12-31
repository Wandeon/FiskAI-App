/**
 * Tests for system-status refresh API routes
 *
 * These tests verify that the API routes exist and export the expected handlers.
 */

import { describe, it } from "node:test"
import assert from "node:assert"

describe("system-status refresh API", () => {
  describe("POST /api/admin/system-status/refresh", () => {
    it("should export POST handler", async () => {
      const routeModule = await import("@/app/api/admin/system-status/refresh/route")
      assert.ok(routeModule.POST, "POST handler should be defined")
      assert.strictEqual(typeof routeModule.POST, "function", "POST should be a function")
    })
  })

  describe("GET /api/admin/system-status/refresh/[id]", () => {
    it("should export GET handler", async () => {
      const routeModule = await import("@/app/api/admin/system-status/refresh/[id]/route")
      assert.ok(routeModule.GET, "GET handler should be defined")
      assert.strictEqual(typeof routeModule.GET, "function", "GET should be a function")
    })
  })

  describe("store helpers", () => {
    it("should export saveSnapshot", async () => {
      const storeModule = await import("@/lib/system-status/store")
      assert.ok(storeModule.saveSnapshot, "saveSnapshot should be defined")
      assert.strictEqual(
        typeof storeModule.saveSnapshot,
        "function",
        "saveSnapshot should be a function"
      )
    })

    it("should export saveEvents", async () => {
      const storeModule = await import("@/lib/system-status/store")
      assert.ok(storeModule.saveEvents, "saveEvents should be defined")
      assert.strictEqual(
        typeof storeModule.saveEvents,
        "function",
        "saveEvents should be a function"
      )
    })

    it("should export getRefreshJob", async () => {
      const storeModule = await import("@/lib/system-status/store")
      assert.ok(storeModule.getRefreshJob, "getRefreshJob should be defined")
      assert.strictEqual(
        typeof storeModule.getRefreshJob,
        "function",
        "getRefreshJob should be a function"
      )
    })

    it("should export createRefreshJob", async () => {
      const storeModule = await import("@/lib/system-status/store")
      assert.ok(storeModule.createRefreshJob, "createRefreshJob should be defined")
      assert.strictEqual(
        typeof storeModule.createRefreshJob,
        "function",
        "createRefreshJob should be a function"
      )
    })

    it("should export updateRefreshJob", async () => {
      const storeModule = await import("@/lib/system-status/store")
      assert.ok(storeModule.updateRefreshJob, "updateRefreshJob should be defined")
      assert.strictEqual(
        typeof storeModule.updateRefreshJob,
        "function",
        "updateRefreshJob should be a function"
      )
    })

    it("should export acquireRefreshLock", async () => {
      const storeModule = await import("@/lib/system-status/store")
      assert.ok(storeModule.acquireRefreshLock, "acquireRefreshLock should be defined")
      assert.strictEqual(
        typeof storeModule.acquireRefreshLock,
        "function",
        "acquireRefreshLock should be a function"
      )
    })

    it("should export releaseRefreshLock", async () => {
      const storeModule = await import("@/lib/system-status/store")
      assert.ok(storeModule.releaseRefreshLock, "releaseRefreshLock should be defined")
      assert.strictEqual(
        typeof storeModule.releaseRefreshLock,
        "function",
        "releaseRefreshLock should be a function"
      )
    })
  })
})
