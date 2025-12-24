import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PersonalizationPanel } from "../PersonalizationPanel"

describe("PersonalizationPanel", () => {
  it("renders header", () => {
    render(<PersonalizationPanel onConnect={vi.fn()} onDismiss={vi.fn()} />)

    expect(screen.getByRole("heading", { name: /personalize/i })).toBeInTheDocument()
  })

  it("renders description of what connecting provides", () => {
    render(<PersonalizationPanel onConnect={vi.fn()} onDismiss={vi.fn()} />)

    expect(
      screen.getByText(/connect your data to get calculations specific to your business/i)
    ).toBeInTheDocument()
  })

  it("renders list of data sources that can be connected", () => {
    render(<PersonalizationPanel onConnect={vi.fn()} onDismiss={vi.fn()} />)

    expect(screen.getByText(/invoices/i)).toBeInTheDocument()
    expect(screen.getByText(/bank/i)).toBeInTheDocument()
  })

  it("renders connect button", () => {
    render(<PersonalizationPanel onConnect={vi.fn()} onDismiss={vi.fn()} />)

    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument()
  })

  it("calls onConnect when connect button clicked", async () => {
    const onConnect = vi.fn()
    const user = userEvent.setup()

    render(<PersonalizationPanel onConnect={onConnect} onDismiss={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: /connect/i }))

    expect(onConnect).toHaveBeenCalled()
  })

  it("renders dismiss link", () => {
    render(<PersonalizationPanel onConnect={vi.fn()} onDismiss={vi.fn()} />)

    expect(screen.getByRole("button", { name: /not now/i })).toBeInTheDocument()
  })

  it("calls onDismiss when dismiss clicked", async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()

    render(<PersonalizationPanel onConnect={vi.fn()} onDismiss={onDismiss} />)

    await user.click(screen.getByRole("button", { name: /not now/i }))

    expect(onDismiss).toHaveBeenCalled()
  })

  it("has matching visual weight with EvidencePanel", () => {
    const { container } = render(<PersonalizationPanel onConnect={vi.fn()} onDismiss={vi.fn()} />)

    const panel = container.firstChild as HTMLElement
    expect(panel.className).toContain("border")
    expect(panel.className).toContain("rounded-lg")
  })

  it("does not use emojis", () => {
    const { container } = render(<PersonalizationPanel onConnect={vi.fn()} onDismiss={vi.fn()} />)

    const text = container.textContent || ""
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]/u
    expect(emojiRegex.test(text)).toBe(false)
  })
})
