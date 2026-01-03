// src/components/capability/__tests__/ActionButton.test.tsx
/**
 * ActionButton Component Tests
 *
 * Tests for capability action execution via ActionButton component.
 *
 * @module components/capability
 * @since PHASE 2 - Capability-Driven Actions
 */

import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ActionButton } from "../ActionButton"
import type { CapabilityAction } from "@/lib/capabilities"

// Mock the useCapabilityAction hook
const mockExecute = vi.fn()
const mockUseCapabilityAction = vi.fn()

vi.mock("@/lib/capabilities/actions/useCapabilityAction", () => ({
  useCapabilityAction: (options: unknown) => mockUseCapabilityAction(options),
}))

// Mock the toast
const mockToast = vi.fn()
vi.mock("@/lib/toast", () => ({
  toast: {
    success: (message: string, description?: string) =>
      mockToast({ type: "success", message, description }),
    error: (message: string, description?: string) =>
      mockToast({ type: "error", message, description }),
  },
}))

describe("ActionButton", () => {
  const enabledAction: CapabilityAction = {
    id: "fiscalize",
    label: "Fiscalize Invoice",
    enabled: true,
    primary: true,
  }

  const disabledAction: CapabilityAction = {
    id: "fiscalize",
    label: "Fiscalize Invoice",
    enabled: false,
    disabledReason: "Invoice must be issued first",
    primary: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCapabilityAction.mockReturnValue({
      execute: mockExecute,
      isLoading: false,
      error: null,
      data: null,
      reset: vi.fn(),
    })
    mockExecute.mockResolvedValue({ success: true })
  })

  describe("rendering", () => {
    it("renders button with action label", () => {
      render(<ActionButton action={enabledAction} capabilityId="INV-003" />)

      expect(screen.getByRole("button", { name: /fiscalize invoice/i })).toBeInTheDocument()
    })

    it("renders enabled button when action is enabled", () => {
      render(<ActionButton action={enabledAction} capabilityId="INV-003" />)

      expect(screen.getByRole("button")).not.toBeDisabled()
    })

    it("renders disabled button when action is disabled", () => {
      render(<ActionButton action={disabledAction} capabilityId="INV-003" />)

      expect(screen.getByRole("button")).toBeDisabled()
    })

    it("shows tooltip with reason when action is disabled", async () => {
      const user = userEvent.setup()
      render(<ActionButton action={disabledAction} capabilityId="INV-003" />)

      // Hover over button to trigger tooltip
      await user.hover(screen.getByRole("button"))

      await waitFor(() => {
        // Radix tooltip may render the text multiple times for accessibility
        const elements = screen.getAllByText("Invoice must be issued first")
        expect(elements.length).toBeGreaterThan(0)
      })
    })

    it("shows diagnostics when showDiagnostics is true", () => {
      render(<ActionButton action={enabledAction} capabilityId="INV-003" showDiagnostics />)

      expect(screen.getByText("INV-003")).toBeInTheDocument()
    })
  })

  describe("loading state", () => {
    it("shows loading spinner when isLoading is true", () => {
      mockUseCapabilityAction.mockReturnValue({
        execute: mockExecute,
        isLoading: true,
        error: null,
        data: null,
        reset: vi.fn(),
      })

      render(<ActionButton action={enabledAction} capabilityId="INV-003" />)

      // Check for spinner via class or test-id
      expect(screen.getByRole("button")).toContainHTML("animate-spin")
    })

    it("disables button when loading", () => {
      mockUseCapabilityAction.mockReturnValue({
        execute: mockExecute,
        isLoading: true,
        error: null,
        data: null,
        reset: vi.fn(),
      })

      render(<ActionButton action={enabledAction} capabilityId="INV-003" />)

      expect(screen.getByRole("button")).toBeDisabled()
    })
  })

  describe("action execution", () => {
    it("calls execute when clicked", async () => {
      const user = userEvent.setup()
      render(<ActionButton action={enabledAction} capabilityId="INV-003" entityId="inv-123" />)

      await user.click(screen.getByRole("button"))

      expect(mockExecute).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith({ id: "inv-123" })
    })

    it("passes params to execute", async () => {
      const user = userEvent.setup()
      const params = { fiscalNumber: "ABC123" }
      render(
        <ActionButton
          action={enabledAction}
          capabilityId="INV-003"
          entityId="inv-123"
          params={params}
        />
      )

      await user.click(screen.getByRole("button"))

      expect(mockExecute).toHaveBeenCalledWith({ id: "inv-123", fiscalNumber: "ABC123" })
    })

    it("does not call execute when action is disabled", async () => {
      const user = userEvent.setup()
      render(<ActionButton action={disabledAction} capabilityId="INV-003" entityId="inv-123" />)

      // Try to click disabled button
      await user.click(screen.getByRole("button"))

      expect(mockExecute).not.toHaveBeenCalled()
    })

    it("does not call execute when loading", async () => {
      mockUseCapabilityAction.mockReturnValue({
        execute: mockExecute,
        isLoading: true,
        error: null,
        data: null,
        reset: vi.fn(),
      })

      const user = userEvent.setup()
      render(<ActionButton action={enabledAction} capabilityId="INV-003" entityId="inv-123" />)

      await user.click(screen.getByRole("button"))

      expect(mockExecute).not.toHaveBeenCalled()
    })
  })

  describe("hook configuration", () => {
    it("passes correct options to useCapabilityAction", () => {
      render(
        <ActionButton
          action={enabledAction}
          capabilityId="INV-003"
          entityId="inv-123"
          entityType="Invoice"
        />
      )

      expect(mockUseCapabilityAction).toHaveBeenCalledWith(
        expect.objectContaining({
          capabilityId: "INV-003",
          actionId: "fiscalize",
          entityId: "inv-123",
          entityType: "Invoice",
        })
      )
    })

    it("configures success callback that calls onSuccess prop", async () => {
      const onSuccess = vi.fn()
      render(
        <ActionButton
          action={enabledAction}
          capabilityId="INV-003"
          entityId="inv-123"
          onSuccess={onSuccess}
        />
      )

      // Get the onSuccess callback passed to the hook
      const hookOptions = mockUseCapabilityAction.mock.calls[0][0]

      // Simulate successful action
      hookOptions.onSuccess({ success: true, data: {} })

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          message: "Uspjeh",
        })
      )
      expect(onSuccess).toHaveBeenCalled()
    })

    it("configures error callback that calls onError prop", async () => {
      const onError = vi.fn()
      render(
        <ActionButton
          action={enabledAction}
          capabilityId="INV-003"
          entityId="inv-123"
          onError={onError}
        />
      )

      // Get the onError callback passed to the hook
      const hookOptions = mockUseCapabilityAction.mock.calls[0][0]

      // Simulate failed action
      hookOptions.onError("Something went wrong")

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          message: "Error",
        })
      )
      expect(onError).toHaveBeenCalledWith("Something went wrong")
    })
  })

  describe("variants", () => {
    it("renders default variant for primary action", () => {
      render(<ActionButton action={enabledAction} capabilityId="INV-003" />)

      // Primary actions should have default variant styling
      const button = screen.getByRole("button")
      expect(button).toHaveClass("bg-interactive")
    })

    it("renders outline variant for non-primary action", () => {
      const secondaryAction: CapabilityAction = {
        ...enabledAction,
        primary: false,
      }
      render(<ActionButton action={secondaryAction} capabilityId="INV-003" />)

      const button = screen.getByRole("button")
      expect(button).toHaveClass("border")
    })
  })
})
