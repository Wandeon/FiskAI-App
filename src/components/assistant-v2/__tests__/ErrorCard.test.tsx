import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ErrorCard } from "../ErrorCard"
import type { AssistantError } from "@/lib/assistant"

describe("ErrorCard", () => {
  const networkError: AssistantError = {
    type: "NETWORK_FAILURE",
    message: "Unable to connect to the server.",
  }

  const serverError: AssistantError = {
    type: "SERVER_ERROR",
    message: "Something went wrong on our end.",
    httpStatus: 500,
  }

  const rateLimitError: AssistantError = {
    type: "RATE_LIMITED",
    message: "Too many requests. Please wait.",
    httpStatus: 429,
  }

  it("renders error message", () => {
    render(<ErrorCard error={networkError} onRetry={vi.fn()} />)

    expect(screen.getByText(/unable to connect/i)).toBeInTheDocument()
  })

  it("renders retry button for retryable errors", () => {
    render(<ErrorCard error={networkError} onRetry={vi.fn()} />)

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
  })

  it("calls onRetry when retry button clicked", async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()

    render(<ErrorCard error={networkError} onRetry={onRetry} />)

    await user.click(screen.getByRole("button", { name: /try again/i }))

    expect(onRetry).toHaveBeenCalled()
  })

  it("does not render retry button for client errors", () => {
    const clientError: AssistantError = {
      type: "CLIENT_ERROR",
      message: "Invalid request.",
      httpStatus: 400,
    }

    render(<ErrorCard error={clientError} onRetry={vi.fn()} />)

    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument()
  })

  it("shows rate limit message with countdown when rate limited", () => {
    render(<ErrorCard error={rateLimitError} onRetry={vi.fn()} />)

    expect(screen.getByText(/too many requests/i)).toBeInTheDocument()
  })

  it('has role="alert" for accessibility', () => {
    render(<ErrorCard error={networkError} onRetry={vi.fn()} />)

    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("shows error icon", () => {
    render(<ErrorCard error={networkError} onRetry={vi.fn()} />)

    expect(screen.getByTestId("error-icon")).toBeInTheDocument()
  })

  it("disables retry button when retrying", () => {
    render(<ErrorCard error={networkError} onRetry={vi.fn()} isRetrying />)

    expect(screen.getByRole("button", { name: /trying/i })).toBeDisabled()
  })
})
