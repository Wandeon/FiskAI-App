// src/components/capability/__tests__/SelectableQueueItem.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import { SelectableQueueItem } from "../SelectableQueueItem"
import { SelectionProvider } from "../selection-context"
import type { QueueItem } from "../types"

// Mock the useCapabilityAction hook (used by ActionButton)
vi.mock("@/lib/capabilities/actions/useCapabilityAction", () => ({
  useCapabilityAction: () => ({
    execute: vi.fn(),
    isLoading: false,
    error: null,
    data: null,
    reset: vi.fn(),
  }),
}))

// Mock the toast
vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe("SelectableQueueItem", () => {
  const mockItem: QueueItem = {
    id: "inv-123",
    type: "Invoice",
    title: "Invoice #001",
    status: "DRAFT",
    timestamp: "2026-01-01T00:00:00Z",
    capabilities: [
      {
        capability: "INV-003",
        state: "READY",
        inputs: [],
        blockers: [],
        actions: [{ id: "fiscalize", label: "Fiscalize", enabled: true }],
        resolvedAt: "2026-01-01T00:00:00Z",
      },
    ],
  }

  it("renders checkbox for selection", () => {
    render(
      <SelectionProvider>
        <SelectableQueueItem item={mockItem} selectable />
      </SelectionProvider>
    )

    expect(screen.getByRole("checkbox")).toBeInTheDocument()
  })

  it("does not render checkbox when selectable is false", () => {
    render(
      <SelectionProvider>
        <SelectableQueueItem item={mockItem} selectable={false} />
      </SelectionProvider>
    )

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("toggles selection on checkbox click", () => {
    const onSelectionChange = vi.fn()
    render(
      <SelectionProvider>
        <SelectableQueueItem item={mockItem} selectable onSelectionChange={onSelectionChange} />
      </SelectionProvider>
    )

    const checkbox = screen.getByRole("checkbox")
    fireEvent.click(checkbox)
    expect(onSelectionChange).toHaveBeenCalledWith("inv-123", true)
  })

  it("shows selected state", () => {
    render(
      <SelectionProvider>
        <SelectableQueueItem item={mockItem} selectable isSelected />
      </SelectionProvider>
    )

    expect(screen.getByRole("checkbox")).toBeChecked()
  })
})
