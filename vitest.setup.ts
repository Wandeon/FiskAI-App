import "@testing-library/jest-dom"
import { vi } from "vitest"

// Fail-fast DB mocks for unit tests
// These throw IMMEDIATELY on import, not on property access.
// This enforces a hard boundary: unit tests cannot import DB code at all.
//
// If you see this error, either:
//   1. Rename your test to *.db.test.ts (if it needs a real DB)
//   2. Refactor to remove the transitive DB dependency (preferred)

vi.mock("@/lib/db", () => {
  throw new Error(
    "[UNIT TEST BOUNDARY VIOLATION] Cannot import @/lib/db in unit tests.\n" +
      "Unit tests must be hermetic (no database). Either:\n" +
      "  1. Rename this test to *.db.test.ts if it needs a real database\n" +
      "  2. Refactor the code to remove the transitive DB import"
  )
})

vi.mock("@/lib/db/regulatory", () => {
  throw new Error(
    "[UNIT TEST BOUNDARY VIOLATION] Cannot import @/lib/db/regulatory in unit tests.\n" +
      "Unit tests must be hermetic (no database). Either:\n" +
      "  1. Rename this test to *.db.test.ts if it needs a real database\n" +
      "  2. Refactor the code to remove the transitive DB import"
  )
})

vi.mock("@/lib/prisma", () => {
  throw new Error(
    "[UNIT TEST BOUNDARY VIOLATION] Cannot import @/lib/prisma in unit tests.\n" +
      "Unit tests must be hermetic (no database). Either:\n" +
      "  1. Rename this test to *.db.test.ts if it needs a real database\n" +
      "  2. Refactor the code to remove the transitive DB import"
  )
})
