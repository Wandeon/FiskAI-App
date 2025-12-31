import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ConfidenceBadge } from "../ConfidenceBadge"

describe("ConfidenceBadge", () => {
  it("renders HIGH confidence with green styling", () => {
    render(<ConfidenceBadge level="HIGH" />)

    const badge = screen.getByText(/high confidence/i)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-success-bg", "text-success-text")
  })

  it("renders MEDIUM confidence with yellow styling", () => {
    render(<ConfidenceBadge level="MEDIUM" />)

    const badge = screen.getByText(/medium confidence/i)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-warning-bg", "text-warning-text")
  })

  it("renders LOW confidence with red styling", () => {
    render(<ConfidenceBadge level="LOW" />)

    const badge = screen.getByText(/low confidence/i)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-danger-bg", "text-danger-text")
  })

  it("shows score percentage when provided", () => {
    render(<ConfidenceBadge level="HIGH" score={0.95} />)

    expect(screen.getByText(/95%/)).toBeInTheDocument()
  })

  it("does not show score when not provided", () => {
    render(<ConfidenceBadge level="HIGH" />)

    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it("has accessible label", () => {
    render(<ConfidenceBadge level="HIGH" score={0.92} />)

    const badge = screen.getByRole("status")
    expect(badge).toHaveAttribute("aria-label", expect.stringContaining("High confidence"))
  })
})
