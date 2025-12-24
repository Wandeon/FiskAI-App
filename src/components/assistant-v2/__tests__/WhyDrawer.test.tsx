import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WhyDrawer } from "../WhyDrawer"

describe("WhyDrawer", () => {
  const bullets = [
    "Article 38 of the VAT Law establishes the standard rate.",
    "This applies to taxable supplies in Croatia.",
    "No exemptions apply to this category.",
  ]

  it("renders nothing when not expanded", () => {
    const { container } = render(
      <WhyDrawer bullets={bullets} isExpanded={false} onClose={vi.fn()} />
    )

    expect(container.querySelector('[role="region"]')).not.toBeInTheDocument()
  })

  it("renders bullets when expanded", () => {
    render(<WhyDrawer bullets={bullets} isExpanded onClose={vi.fn()} />)

    expect(screen.getByText(/Article 38/)).toBeInTheDocument()
    expect(screen.getByText(/taxable supplies/)).toBeInTheDocument()
    expect(screen.getByText(/No exemptions/)).toBeInTheDocument()
  })

  it('has role="region" with accessible label', () => {
    render(<WhyDrawer bullets={bullets} isExpanded onClose={vi.fn()} />)

    const region = screen.getByRole("region")
    expect(region).toHaveAttribute("aria-label", expect.stringContaining("Why"))
  })

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<WhyDrawer bullets={bullets} isExpanded onClose={onClose} />)

    await user.keyboard("{Escape}")

    expect(onClose).toHaveBeenCalled()
  })

  it("renders header with close button", () => {
    render(<WhyDrawer bullets={bullets} isExpanded onClose={vi.fn()} />)

    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument()
  })

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<WhyDrawer bullets={bullets} isExpanded onClose={onClose} />)

    await user.click(screen.getByRole("button", { name: /close/i }))

    expect(onClose).toHaveBeenCalled()
  })

  it("renders bullets as list items", () => {
    render(<WhyDrawer bullets={bullets} isExpanded onClose={vi.fn()} />)

    const listItems = screen.getAllByRole("listitem")
    expect(listItems).toHaveLength(3)
  })
})
