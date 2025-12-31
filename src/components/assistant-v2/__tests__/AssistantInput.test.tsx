import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AssistantInput } from "../AssistantInput"

describe("AssistantInput", () => {
  it("renders textarea with placeholder", () => {
    render(<AssistantInput surface="MARKETING" onSubmit={vi.fn()} />)

    const textarea = screen.getByRole("textbox")
    expect(textarea).toBeInTheDocument()
    // Croatian placeholder: "Postavite pitanje o porezima, PDV-u, doprinosima..."
    expect(textarea).toHaveAttribute("placeholder", expect.stringContaining("porez"))
  })

  it("renders send button", () => {
    render(<AssistantInput surface="MARKETING" onSubmit={vi.fn()} />)

    // Croatian aria-label: "Pošalji"
    expect(screen.getByRole("button", { name: /pošalji/i })).toBeInTheDocument()
  })

  it("calls onSubmit when Enter is pressed", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(<AssistantInput surface="MARKETING" onSubmit={onSubmit} />)

    const textarea = screen.getByRole("textbox")
    await user.type(textarea, "What is VAT rate?")
    await user.keyboard("{Enter}")

    expect(onSubmit).toHaveBeenCalledWith("What is VAT rate?")
  })

  it("does NOT submit on Shift+Enter (allows newline)", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(<AssistantInput surface="MARKETING" onSubmit={onSubmit} />)

    const textarea = screen.getByRole("textbox")
    await user.type(textarea, "Line 1")
    await user.keyboard("{Shift>}{Enter}{/Shift}")
    await user.type(textarea, "Line 2")

    expect(onSubmit).not.toHaveBeenCalled()
    expect(textarea).toHaveValue("Line 1\nLine 2")
  })

  it("calls onSubmit when send button is clicked", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(<AssistantInput surface="MARKETING" onSubmit={onSubmit} />)

    const textarea = screen.getByRole("textbox")
    await user.type(textarea, "My question")

    const sendButton = screen.getByRole("button", { name: /pošalji/i })
    await user.click(sendButton)

    expect(onSubmit).toHaveBeenCalledWith("My question")
  })

  it("clears input after submit", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(<AssistantInput surface="MARKETING" onSubmit={onSubmit} />)

    const textarea = screen.getByRole("textbox")
    await user.type(textarea, "Test query")
    await user.keyboard("{Enter}")

    expect(textarea).toHaveValue("")
  })

  it("disables input and button when disabled prop is true", () => {
    render(<AssistantInput surface="MARKETING" onSubmit={vi.fn()} disabled />)

    expect(screen.getByRole("textbox")).toBeDisabled()
    expect(screen.getByRole("button", { name: /pošalji/i })).toBeDisabled()
  })

  it("does not submit empty query", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(<AssistantInput surface="MARKETING" onSubmit={onSubmit} />)

    await user.keyboard("{Enter}")

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("has aria-describedby for keyboard hint", () => {
    render(<AssistantInput surface="MARKETING" onSubmit={vi.fn()} />)

    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveAttribute("aria-describedby")

    const hintId = textarea.getAttribute("aria-describedby")
    // Croatian hint: "Pritisnite Enter za slanje, Shift+Enter za novi red"
    expect(document.getElementById(hintId!)).toHaveTextContent(/enter.*slanje/i)
  })
})
