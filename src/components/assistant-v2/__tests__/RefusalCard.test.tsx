import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { RefusalCard } from "../RefusalCard"
import type { RefusalReason, RefusalBlock } from "@/lib/assistant"

describe("RefusalCard", () => {
  it("renders NO_CITABLE_RULES refusal", () => {
    render(
      <RefusalCard
        reason="NO_CITABLE_RULES"
        refusal={{ message: "We do not have verified rules for this topic." }}
      />
    )

    expect(screen.getByText(/no verified rules/i)).toBeInTheDocument()
    expect(screen.getByText(/do not have verified rules/)).toBeInTheDocument()
  })

  it("renders OUT_OF_SCOPE refusal with redirect options", () => {
    const refusal: RefusalBlock = {
      message: "This is outside our regulatory coverage.",
      redirectOptions: [
        { label: "Contact support", href: "/support", type: "SUPPORT" },
        { label: "View documentation", href: "/docs", type: "DOCS" },
      ],
    }

    render(<RefusalCard reason="OUT_OF_SCOPE" refusal={refusal} />)

    expect(screen.getByText("Outside our coverage")).toBeInTheDocument()
    expect(screen.getByText("This is outside our regulatory coverage.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /contact support/i })).toHaveAttribute(
      "href",
      "/support"
    )
    expect(screen.getByRole("link", { name: /view documentation/i })).toHaveAttribute(
      "href",
      "/docs"
    )
  })

  it("renders MISSING_CLIENT_DATA refusal with connect CTA", () => {
    const refusal: RefusalBlock = {
      message: "We need more data to answer this question.",
      missingData: [{ label: "Revenue data", impact: "Required for threshold calculation" }],
    }

    render(<RefusalCard reason="MISSING_CLIENT_DATA" refusal={refusal} onConnectData={vi.fn()} />)

    expect(screen.getByText(/need more data/)).toBeInTheDocument()
    expect(screen.getByText(/revenue data/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument()
  })

  it("renders UNRESOLVED_CONFLICT refusal", () => {
    render(
      <RefusalCard
        reason="UNRESOLVED_CONFLICT"
        refusal={{ message: "There are conflicting rules on this topic." }}
      />
    )

    expect(screen.getByText(/conflicting rules/)).toBeInTheDocument()
  })

  it("calls onConnectData when connect button clicked", async () => {
    const onConnectData = vi.fn()
    const user = userEvent.setup()

    render(
      <RefusalCard
        reason="MISSING_CLIENT_DATA"
        refusal={{
          message: "Need data",
          missingData: [{ label: "Revenue data", impact: "Required" }],
        }}
        onConnectData={onConnectData}
      />
    )

    await user.click(screen.getByRole("button", { name: /connect/i }))

    expect(onConnectData).toHaveBeenCalled()
  })

  it("renders related topics when provided", () => {
    const refusal: RefusalBlock = {
      message: "Cannot answer this.",
      relatedTopics: ["VAT registration", "Tax deadlines"],
    }

    render(<RefusalCard reason="OUT_OF_SCOPE" refusal={refusal} onTopicClick={vi.fn()} />)

    expect(screen.getByText(/VAT registration/)).toBeInTheDocument()
    expect(screen.getByText(/Tax deadlines/)).toBeInTheDocument()
  })

  it("has appropriate icon for each refusal type", () => {
    const { rerender } = render(
      <RefusalCard reason="NO_CITABLE_RULES" refusal={{ message: "Test" }} />
    )
    expect(screen.getByTestId("refusal-icon")).toBeInTheDocument()

    rerender(<RefusalCard reason="OUT_OF_SCOPE" refusal={{ message: "Test" }} />)
    expect(screen.getByTestId("refusal-icon")).toBeInTheDocument()
  })
})
