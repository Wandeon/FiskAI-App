import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { diffSnapshots } from "../system-status/diff"

const prev = {
  topItems: [],
  criticalCount: 0,
  highCount: 0,
  mediumCount: 0,
  lowCount: 0,
}

const next = {
  topItems: [
    {
      severity: "CRITICAL",
      componentId: "integration-fina-cis",
      title: "Declared but not observed",
      whyItMatters: "Paper system can hide real breakage",
      nextAction: "Fix codeRef or remove declaration",
      owner: "team:finance",
      link: "docs/system-registry/drift-report-ci.md",
    },
  ],
  criticalCount: 1,
  highCount: 0,
  mediumCount: 0,
  lowCount: 0,
}

describe("system-status diff", () => {
  it("emits NEW_CRITICAL when critical count rises", () => {
    const events = diffSnapshots(prev, next)
    assert.ok(events.some((e) => e.eventType === "NEW_CRITICAL"))
  })
})
