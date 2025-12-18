// src/lib/guidance/__tests__/checklist.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import { URGENCY_LEVELS, ACTION_TYPES, CHECKLIST_ITEM_TYPES } from "../checklist"

describe("Checklist Service", () => {
  describe("constants", () => {
    it("has all urgency levels", () => {
      assert.strictEqual(URGENCY_LEVELS.CRITICAL, "critical")
      assert.strictEqual(URGENCY_LEVELS.SOON, "soon")
      assert.strictEqual(URGENCY_LEVELS.UPCOMING, "upcoming")
      assert.strictEqual(URGENCY_LEVELS.OPTIONAL, "optional")
    })

    it("has all action types", () => {
      assert.strictEqual(ACTION_TYPES.LINK, "link")
      assert.strictEqual(ACTION_TYPES.WIZARD, "wizard")
      assert.strictEqual(ACTION_TYPES.QUICK_ACTION, "quick_action")
    })

    it("has all checklist item types from schema", () => {
      assert.strictEqual(CHECKLIST_ITEM_TYPES.DEADLINE, "deadline")
      assert.strictEqual(CHECKLIST_ITEM_TYPES.PAYMENT, "payment")
      assert.strictEqual(CHECKLIST_ITEM_TYPES.ACTION, "action")
      assert.strictEqual(CHECKLIST_ITEM_TYPES.ONBOARDING, "onboarding")
      assert.strictEqual(CHECKLIST_ITEM_TYPES.SEASONAL, "seasonal")
      assert.strictEqual(CHECKLIST_ITEM_TYPES.SUGGESTION, "suggestion")
    })
  })
})
