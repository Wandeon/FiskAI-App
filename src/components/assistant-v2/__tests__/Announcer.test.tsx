import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Announcer } from "../Announcer"

describe("Announcer", () => {
  it('renders with role="status"', () => {
    render(<Announcer message="" />)

    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it('has aria-live="polite"', () => {
    render(<Announcer message="" />)

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite")
  })

  it('has aria-atomic="true"', () => {
    render(<Announcer message="" />)

    expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true")
  })

  it("is visually hidden but accessible", () => {
    render(<Announcer message="Loading answer..." />)

    const announcer = screen.getByRole("status")
    expect(announcer).toHaveClass("sr-only")
  })

  it("displays the message", () => {
    render(<Announcer message="Answer received: VAT rate is 25%" />)

    expect(screen.getByRole("status")).toHaveTextContent("Answer received: VAT rate is 25%")
  })

  it("updates message when prop changes", () => {
    const { rerender } = render(<Announcer message="Loading..." />)

    expect(screen.getByRole("status")).toHaveTextContent("Loading...")

    rerender(<Announcer message="Complete!" />)

    expect(screen.getByRole("status")).toHaveTextContent("Complete!")
  })
})
