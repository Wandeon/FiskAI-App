import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HistoryBar } from "../HistoryBar"
import type { HistoryItem } from "@/lib/assistant"

const mockHistory: HistoryItem[] = [
  {
    id: "h1",
    query: "What is VAT rate?",
    answer: {} as any,
    timestamp: "2024-12-24T10:00:00Z",
  },
  {
    id: "h2",
    query: "Paušalni obrt limits",
    answer: {} as any,
    timestamp: "2024-12-24T10:05:00Z",
  },
]

describe("HistoryBar", () => {
  it("renders collapsed toggle with count", () => {
    render(<HistoryBar history={mockHistory} onRestore={vi.fn()} onClear={vi.fn()} />)

    expect(screen.getByRole("button", { name: /previous questions \(2\)/i })).toBeInTheDocument()
  })

  it("expands to show history items when clicked", async () => {
    const user = userEvent.setup()

    render(<HistoryBar history={mockHistory} onRestore={vi.fn()} onClear={vi.fn()} />)

    const toggle = screen.getByRole("button", { name: /previous questions/i })
    await user.click(toggle)

    expect(screen.getByText("What is VAT rate?")).toBeInTheDocument()
    expect(screen.getByText("Paušalni obrt limits")).toBeInTheDocument()
  })

  it("calls onRestore with index when item clicked", async () => {
    const onRestore = vi.fn()
    const user = userEvent.setup()

    render(<HistoryBar history={mockHistory} onRestore={onRestore} onClear={vi.fn()} />)

    // Expand
    await user.click(screen.getByRole("button", { name: /previous questions/i }))

    // Click first item
    await user.click(screen.getByText("What is VAT rate?"))

    expect(onRestore).toHaveBeenCalledWith(0)
  })

  it("shows clear all button when expanded", async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()

    render(<HistoryBar history={mockHistory} onRestore={vi.fn()} onClear={onClear} />)

    await user.click(screen.getByRole("button", { name: /previous questions/i }))

    const clearButton = screen.getByRole("button", { name: /clear all/i })
    expect(clearButton).toBeInTheDocument()

    await user.click(clearButton)
    expect(onClear).toHaveBeenCalled()
  })

  it("does not render when history is empty", () => {
    const { container } = render(<HistoryBar history={[]} onRestore={vi.fn()} onClear={vi.fn()} />)

    expect(container.firstChild).toBeNull()
  })

  it("truncates long queries", () => {
    const longHistory: HistoryItem[] = [
      {
        id: "h1",
        query: "This is a very long query that should be truncated to fit in the UI",
        answer: {} as any,
        timestamp: "2024-12-24T10:00:00Z",
      },
    ]

    render(<HistoryBar history={longHistory} onRestore={vi.fn()} onClear={vi.fn()} />)

    // Toggle open
    const toggle = screen.getByRole("button", { name: /previous questions/i })
    fireEvent.click(toggle)

    const item = screen.getByText(/This is a very long query/)
    expect(item.textContent?.length).toBeLessThanOrEqual(53) // 50 + "..."
  })
})
