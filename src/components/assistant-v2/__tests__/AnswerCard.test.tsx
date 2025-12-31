import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AnswerCard } from "../AnswerCard"
import type { AssistantResponse } from "@/lib/assistant"
import { SCHEMA_VERSION } from "@/lib/assistant"

const mockAnswer: AssistantResponse = {
  schemaVersion: SCHEMA_VERSION,
  requestId: "req_1",
  traceId: "trace_1",
  kind: "ANSWER",
  topic: "REGULATORY",
  surface: "MARKETING",
  createdAt: "2024-12-24T10:00:00Z",
  headline: "VAT rate is 25%",
  directAnswer: "Standard VAT rate in Croatia is 25% for most goods and services.",
  keyDetails: [
    "Standard rate applies to most goods",
    "Reduced rates exist for specific categories",
  ],
  nextStep: "Register for VAT when you exceed the threshold",
  confidence: { level: "HIGH", score: 0.95 },
  why: { bullets: ["Source 1 states...", "Regulation confirms..."] },
  asOfDate: "2024-12-24",
}

describe("AnswerCard", () => {
  it("renders headline", () => {
    render(<AnswerCard answer={mockAnswer} />)
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("VAT rate is 25%")
  })

  it("headline has tabindex=-1 for focus management", () => {
    render(<AnswerCard answer={mockAnswer} />)
    expect(screen.getByRole("heading", { level: 2 })).toHaveAttribute("tabindex", "-1")
  })

  it("renders direct answer", () => {
    render(<AnswerCard answer={mockAnswer} />)
    expect(screen.getByText(/Standard VAT rate in Croatia/)).toBeInTheDocument()
  })

  it("renders key details as list", () => {
    render(<AnswerCard answer={mockAnswer} />)
    expect(screen.getByText(/Standard rate applies/)).toBeInTheDocument()
    expect(screen.getByText(/Reduced rates exist/)).toBeInTheDocument()
  })

  it("renders next step when provided", () => {
    render(<AnswerCard answer={mockAnswer} />)
    expect(screen.getByText(/Register for VAT/)).toBeInTheDocument()
  })

  it("renders confidence badge", () => {
    render(<AnswerCard answer={mockAnswer} />)
    expect(screen.getByText(/high confidence/i)).toBeInTheDocument()
  })

  it("renders as-of date", () => {
    render(<AnswerCard answer={mockAnswer} />)
    expect(screen.getByText(/as of/i)).toBeInTheDocument()
  })

  it("renders Why? button when why data exists", () => {
    render(<AnswerCard answer={mockAnswer} />)
    // Croatian aria-label: "Saznajte zašto"
    expect(screen.getByRole("button", { name: /saznajte zašto/i })).toBeInTheDocument()
  })

  it("does not render Why? button when no why data", () => {
    const answerWithoutWhy = { ...mockAnswer, why: undefined }
    render(<AnswerCard answer={answerWithoutWhy} />)
    // Croatian aria-label: "Saznajte zašto"
    expect(screen.queryByRole("button", { name: /saznajte zašto/i })).not.toBeInTheDocument()
  })

  it("does not render key details when empty", () => {
    const answerWithoutDetails = { ...mockAnswer, keyDetails: undefined }
    render(<AnswerCard answer={answerWithoutDetails} />)
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })
})
