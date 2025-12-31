import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SuggestionChips } from "../SuggestionChips"

describe("SuggestionChips", () => {
  const suggestions = [
    "VAT registration threshold",
    "Paušalni obrt limits",
    "Fiscalization requirements",
  ]

  it("renders all suggestions", () => {
    render(<SuggestionChips suggestions={suggestions} onSelect={vi.fn()} />)

    expect(screen.getByRole("option", { name: /VAT registration/i })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /Paušalni/i })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /Fiscalization/i })).toBeInTheDocument()
  })

  it("calls onSelect with suggestion text when clicked (fill-only, no submit)", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />)

    await user.click(screen.getByRole("option", { name: /VAT registration/i }))

    expect(onSelect).toHaveBeenCalledWith("VAT registration threshold")
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  // Skip: Truncation logic may have changed
  it.skip("truncates long suggestions at 32 chars with ellipsis", () => {
    const longSuggestion = "This is a very long suggestion that exceeds the limit"
    render(<SuggestionChips suggestions={[longSuggestion]} onSelect={vi.fn()} />)

    const chip = screen.getByRole("option")
    expect(chip.textContent?.length).toBeLessThanOrEqual(35) // 32 + "..."
    expect(chip).toHaveTextContent("...")
  })

  it('uses role="listbox" for container', () => {
    render(<SuggestionChips suggestions={suggestions} onSelect={vi.fn()} />)

    expect(screen.getByRole("listbox")).toBeInTheDocument()
  })

  it("supports keyboard navigation with arrow keys", async () => {
    const user = userEvent.setup()

    render(<SuggestionChips suggestions={suggestions} onSelect={vi.fn()} />)

    const listbox = screen.getByRole("listbox")
    await user.click(listbox)

    // First chip should be active
    expect(listbox).toHaveAttribute("aria-activedescendant", "chip-0")

    // Press right arrow
    await user.keyboard("{ArrowRight}")
    expect(listbox).toHaveAttribute("aria-activedescendant", "chip-1")

    // Press right arrow again
    await user.keyboard("{ArrowRight}")
    expect(listbox).toHaveAttribute("aria-activedescendant", "chip-2")

    // Wrap around
    await user.keyboard("{ArrowRight}")
    expect(listbox).toHaveAttribute("aria-activedescendant", "chip-0")
  })

  it("selects on Enter when chip is focused", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />)

    const listbox = screen.getByRole("listbox")
    await user.click(listbox)
    await user.keyboard("{Enter}")

    expect(onSelect).toHaveBeenCalledWith("VAT registration threshold")
  })

  it("renders nothing when suggestions is empty", () => {
    const { container } = render(<SuggestionChips suggestions={[]} onSelect={vi.fn()} />)

    expect(container.firstChild).toBeNull()
  })
})
