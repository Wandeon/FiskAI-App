import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ActionButtons } from "../ActionButtons"

describe("ActionButtons", () => {
  it("renders Why? button when hasWhy is true", () => {
    render(<ActionButtons hasWhy onWhyClick={vi.fn()} />)

    // Button has Croatian aria-label "Saznajte zašto"
    expect(screen.getByRole("button", { name: /saznajte zašto/i })).toBeInTheDocument()
  })

  it("renders How to apply button when hasHowToApply is true", () => {
    render(<ActionButtons hasHowToApply onHowToApplyClick={vi.fn()} />)

    // Button has Croatian aria-label "Kako primijeniti ovu preporuku"
    expect(screen.getByRole("button", { name: /kako primijeniti/i })).toBeInTheDocument()
  })

  it("calls onWhyClick when Why? is clicked", async () => {
    const onWhyClick = vi.fn()
    const user = userEvent.setup()

    render(<ActionButtons hasWhy onWhyClick={onWhyClick} />)

    await user.click(screen.getByRole("button", { name: /saznajte zašto/i }))

    expect(onWhyClick).toHaveBeenCalledTimes(1)
  })

  it("calls onHowToApplyClick when How to apply is clicked", async () => {
    const onHowToApplyClick = vi.fn()
    const user = userEvent.setup()

    render(<ActionButtons hasHowToApply onHowToApplyClick={onHowToApplyClick} />)

    await user.click(screen.getByRole("button", { name: /kako primijeniti/i }))

    expect(onHowToApplyClick).toHaveBeenCalledTimes(1)
  })

  it("renders Save button when onSave is provided", () => {
    render(<ActionButtons onSave={vi.fn()} />)

    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument()
  })

  it("renders Share button when onShare is provided", () => {
    render(<ActionButtons onShare={vi.fn()} />)

    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument()
  })

  it("renders nothing when no actions provided", () => {
    const { container } = render(<ActionButtons />)

    expect(container.firstChild).toBeEmptyDOMElement()
  })

  it("shows expanded state for Why? when whyExpanded is true", () => {
    render(<ActionButtons hasWhy whyExpanded onWhyClick={vi.fn()} />)

    const button = screen.getByRole("button", { name: /saznajte zašto/i })
    expect(button).toHaveAttribute("aria-expanded", "true")
  })
})
