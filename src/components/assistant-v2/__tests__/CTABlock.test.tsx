import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CTABlock } from "../CTABlock"

describe("CTABlock", () => {
  describe("contextual variant", () => {
    it("renders contextual upsell headline", () => {
      render(
        <CTABlock variant="contextual" topic="REGULATORY" onAction={vi.fn()} onDismiss={vi.fn()} />
      )

      expect(screen.getByText(/calculate this for your business/i)).toBeInTheDocument()
    })

    it("renders primary action button", () => {
      render(
        <CTABlock variant="contextual" topic="REGULATORY" onAction={vi.fn()} onDismiss={vi.fn()} />
      )

      expect(screen.getByRole("button", { name: /start free/i })).toBeInTheDocument()
    })

    it("renders trust link", () => {
      render(
        <CTABlock variant="contextual" topic="REGULATORY" onAction={vi.fn()} onDismiss={vi.fn()} />
      )

      expect(screen.getByRole("link", { name: /how sources are verified/i })).toBeInTheDocument()
    })

    it("calls onAction when CTA button clicked", async () => {
      const onAction = vi.fn()
      const user = userEvent.setup()

      render(
        <CTABlock variant="contextual" topic="REGULATORY" onAction={onAction} onDismiss={vi.fn()} />
      )

      await user.click(screen.getByRole("button", { name: /start free/i }))

      expect(onAction).toHaveBeenCalled()
    })

    it("calls onDismiss when dismiss button clicked", async () => {
      const onDismiss = vi.fn()
      const user = userEvent.setup()

      render(
        <CTABlock
          variant="contextual"
          topic="REGULATORY"
          onAction={vi.fn()}
          onDismiss={onDismiss}
        />
      )

      await user.click(screen.getByRole("button", { name: /dismiss/i }))

      expect(onDismiss).toHaveBeenCalled()
    })
  })

  describe("personalization variant", () => {
    it("renders personalization headline", () => {
      render(
        <CTABlock
          variant="personalization"
          topic="REGULATORY"
          onAction={vi.fn()}
          onDismiss={vi.fn()}
        />
      )

      expect(screen.getByText(/personalize this answer/i)).toBeInTheDocument()
    })

    it("renders connect data CTA", () => {
      render(
        <CTABlock
          variant="personalization"
          topic="REGULATORY"
          onAction={vi.fn()}
          onDismiss={vi.fn()}
        />
      )

      expect(screen.getByRole("button", { name: /connect.*data/i })).toBeInTheDocument()
    })
  })

  it("does not render emojis", () => {
    const { container } = render(
      <CTABlock variant="contextual" topic="REGULATORY" onAction={vi.fn()} onDismiss={vi.fn()} />
    )

    // Check no emoji unicode ranges
    const text = container.textContent || ""
    const emojiRegex =
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]/u
    expect(emojiRegex.test(text)).toBe(false)
  })

  it("has subtle card styling (not loud)", () => {
    const { container } = render(
      <CTABlock variant="contextual" topic="REGULATORY" onAction={vi.fn()} onDismiss={vi.fn()} />
    )

    const card = container.firstChild as HTMLElement
    expect(card.className).toContain("bg-muted")
    expect(card.className).not.toContain("bg-primary")
  })
})
