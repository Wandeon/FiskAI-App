// src/components/capability/__tests__/BatchActionBar.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import { BatchActionBar } from "../BatchActionBar"
import { SelectionProvider } from "../selection-context"

// Mock useBatchAction
vi.mock("@/lib/capabilities/actions/useBatchAction", () => ({
  useBatchAction: () => ({
    execute: vi.fn().mockResolvedValue({ total: 2, succeeded: 2, failed: 0, results: [] }),
    isLoading: false,
    progress: null,
    result: null,
    reset: vi.fn(),
  }),
}))

describe("BatchActionBar", () => {
  const actions = [
    { id: "fiscalize", label: "Fiscalize", capabilityId: "INV-003" },
    { id: "send", label: "Send", capabilityId: "INV-004" },
  ]

  it("renders nothing when no selection", () => {
    const { container } = render(
      <SelectionProvider>
        <BatchActionBar entityType="Invoice" actions={actions} />
      </SelectionProvider>
    )
    expect(container.querySelector('[data-testid="batch-action-bar"]')).toBeNull()
  })

  it("renders with selection count", () => {
    const TestComponent = () => {
      const [selected, setSelected] = React.useState<string[]>(["inv-1", "inv-2"])
      return (
        <SelectionProvider>
          <BatchActionBar
            entityType="Invoice"
            actions={actions}
            selectedIds={selected}
            onClear={() => setSelected([])}
          />
        </SelectionProvider>
      )
    }

    render(<TestComponent />)
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument()
  })

  it("renders action buttons", () => {
    render(
      <SelectionProvider>
        <BatchActionBar
          entityType="Invoice"
          actions={actions}
          selectedIds={["inv-1"]}
          onClear={() => {}}
        />
      </SelectionProvider>
    )

    expect(screen.getByText("Fiscalize")).toBeInTheDocument()
    expect(screen.getByText("Send")).toBeInTheDocument()
  })

  it("has clear button", () => {
    const onClear = vi.fn()
    render(
      <SelectionProvider>
        <BatchActionBar
          entityType="Invoice"
          actions={actions}
          selectedIds={["inv-1"]}
          onClear={onClear}
        />
      </SelectionProvider>
    )

    fireEvent.click(screen.getByLabelText(/clear selection/i))
    expect(onClear).toHaveBeenCalled()
  })
})
