import { describe, it } from "node:test"
import assert from "node:assert"
import { generateLoginToken, verifyLoginToken } from "../auth/login-token"

process.env.NEXTAUTH_SECRET = "test-secret"

describe("login-token", () => {
  it("generates and verifies a token", async () => {
    const token = await generateLoginToken({ userId: "u1", email: "a@b.com", type: "otp" })
    const payload = await verifyLoginToken(token)

    assert.strictEqual(payload?.userId, "u1")
    assert.strictEqual(payload?.email, "a@b.com")
    assert.strictEqual(payload?.type, "otp")
  })

  it("rejects tampered token", async () => {
    const token = await generateLoginToken({ userId: "u1", email: "a@b.com", type: "otp" })
    const bad = token.replace(/.$/, "x")
    const payload = await verifyLoginToken(bad)

    assert.strictEqual(payload, null)
  })
})
