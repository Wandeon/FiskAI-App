/**
 * Smoke test for dual Prisma client setup
 * Verifies that both core and regulatory clients can instantiate
 */
import { describe, it, expect, beforeAll } from "vitest"

// Skip tests if DATABASE_URL is not set (e.g., in CI without DB)
const skipIfNoDb = process.env.DATABASE_URL ? describe : describe.skip

skipIfNoDb("Dual Prisma Client Smoke Test", () => {
  it("should import core client (db) without errors", async () => {
    // Dynamic import to test the module resolution
    const { db } = await import("@/lib/db")
    expect(db).toBeDefined()
    expect(typeof db.$connect).toBe("function")
    expect(typeof db.$disconnect).toBe("function")
  })

  it("should import prisma alias for backwards compatibility", async () => {
    const { prisma } = await import("@/lib/db")
    expect(prisma).toBeDefined()
    expect(typeof prisma.$connect).toBe("function")
  })

  it("should import regulatory client (dbReg) without errors", async () => {
    const { dbReg } = await import("@/lib/db")
    expect(dbReg).toBeDefined()
    expect(typeof dbReg.$connect).toBe("function")
    expect(typeof dbReg.$disconnect).toBe("function")
  })

  it("should have separate client instances", async () => {
    const { db, dbReg } = await import("@/lib/db")
    // The two clients should be different instances
    expect(db).not.toBe(dbReg)
  })

  it("should export tenant context utilities from core", async () => {
    const { setTenantContext, getTenantContext, runWithTenant } = await import("@/lib/db")
    expect(typeof setTenantContext).toBe("function")
    expect(typeof getTenantContext).toBe("function")
    expect(typeof runWithTenant).toBe("function")
  })

  it("should export type definitions", async () => {
    // This is a compile-time check - if types are wrong, TypeScript will fail
    const dbModule = await import("@/lib/db")

    // Type assertions (these are compile-time checks)
    type _ExtendedClient = typeof dbModule.db
    type _RegClient = typeof dbModule.dbReg

    expect(true).toBe(true)
  })
})
