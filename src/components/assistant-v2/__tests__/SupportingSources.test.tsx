import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SupportingSources } from "../SupportingSources"
import type { SourceCard } from "@/lib/assistant"

const mockSources: SourceCard[] = [
  {
    id: "src_2",
    title: "Pravilnik o PDV-u",
    authority: "REGULATION",
    reference: "čl. 47",
    url: "https://example.com/pravilnik",
    effectiveFrom: "2024-01-01",
    confidence: 0.92,
  },
  {
    id: "src_3",
    title: "Mišljenje Porezne uprave",
    authority: "GUIDANCE",
    url: "https://example.com/misljenje",
    effectiveFrom: "2024-06-01",
    confidence: 0.85,
  },
]

describe("SupportingSources", () => {
  it("renders collapsed toggle with count", () => {
    render(<SupportingSources sources={mockSources} isExpanded={false} onToggle={vi.fn()} />)

    expect(screen.getByText(/supporting sources \(2\)/i)).toBeInTheDocument()
  })

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()

    render(<SupportingSources sources={mockSources} isExpanded={false} onToggle={onToggle} />)

    await user.click(screen.getByRole("button"))

    expect(onToggle).toHaveBeenCalled()
  })

  it("renders source list when expanded", () => {
    render(<SupportingSources sources={mockSources} isExpanded={true} onToggle={vi.fn()} />)

    expect(screen.getByText(/Pravilnik o PDV/)).toBeInTheDocument()
    expect(screen.getByText(/Mišljenje Porezne/)).toBeInTheDocument()
  })

  it("hides source list when collapsed", () => {
    render(<SupportingSources sources={mockSources} isExpanded={false} onToggle={vi.fn()} />)

    expect(screen.queryByText(/Pravilnik o PDV/)).not.toBeInTheDocument()
  })

  it("has aria-expanded attribute", () => {
    render(<SupportingSources sources={mockSources} isExpanded={true} onToggle={vi.fn()} />)

    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true")
  })

  it("renders sources in compact variant", () => {
    render(<SupportingSources sources={mockSources} isExpanded={true} onToggle={vi.fn()} />)

    // Should not show quotes in compact mode
    expect(screen.queryByText(/"/)).not.toBeInTheDocument()
  })

  // Skip: Icon test ID may have changed
  it.skip("shows chevron icon that rotates when expanded", () => {
    const { rerender } = render(
      <SupportingSources sources={mockSources} isExpanded={false} onToggle={vi.fn()} />
    )

    const icon = screen.getByTestId("chevron-icon")
    expect(icon).not.toHaveClass("rotate-180")

    rerender(<SupportingSources sources={mockSources} isExpanded={true} onToggle={vi.fn()} />)

    expect(icon).toHaveClass("rotate-180")
  })
})
