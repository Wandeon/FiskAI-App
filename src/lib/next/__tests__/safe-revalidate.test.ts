import { describe, it, expect } from "vitest"

import { safeRevalidatePath } from "@/lib/next/safe-revalidate"

describe("safeRevalidatePath", () => {
  it("does not throw outside Next static generation context", () => {
    expect(() => safeRevalidatePath("/shatter")).not.toThrow()
  })
})
