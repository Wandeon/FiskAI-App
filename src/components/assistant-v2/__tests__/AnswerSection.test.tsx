import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AnswerSection } from "../AnswerSection"
import type { AssistantControllerState, AssistantResponse } from "@/lib/assistant"
import { SCHEMA_VERSION } from "@/lib/assistant"

const mockResponse: AssistantResponse = {
  schemaVersion: SCHEMA_VERSION,
  requestId: "req_1",
  traceId: "trace_1",
  kind: "ANSWER",
  topic: "REGULATORY",
  surface: "MARKETING",
  createdAt: new Date().toISOString(),
  headline: "VAT rate is 25%",
  directAnswer: "Standard VAT rate in Croatia is 25%.",
}

const idleState: AssistantControllerState = {
  status: "IDLE",
  activeRequestId: null,
  activeQuery: null,
  activeAnswer: null,
  history: [],
  error: null,
  retryCount: 0,
  streamProgress: { headline: false, directAnswer: false, citations: false, clientContext: false },
}

describe("AnswerSection", () => {
  it("renders empty state when IDLE with no answer", () => {
    render(<AnswerSection state={idleState} surface="MARKETING" />)

    // Croatian: "Verificirani odgovor će se pojaviti ovdje"
    expect(screen.getByText(/verificirani odgovor/i)).toBeInTheDocument()
  })

  it("renders loading skeleton when LOADING", () => {
    const loadingState = { ...idleState, status: "LOADING" as const }

    render(<AnswerSection state={loadingState} surface="MARKETING" />)

    expect(screen.getByTestId("answer-skeleton")).toBeInTheDocument()
  })

  it("renders answer card when COMPLETE with answer", () => {
    const completeState: AssistantControllerState = {
      ...idleState,
      status: "COMPLETE",
      activeAnswer: mockResponse,
    }

    render(<AnswerSection state={completeState} surface="MARKETING" />)

    expect(screen.getByText("VAT rate is 25%")).toBeInTheDocument()
    expect(screen.getByText(/Standard VAT rate/)).toBeInTheDocument()
  })

  it("renders refusal card when answer kind is REFUSAL", () => {
    const refusalResponse: AssistantResponse = {
      ...mockResponse,
      kind: "REFUSAL",
      refusalReason: "OUT_OF_SCOPE",
      headline: "Izvan našeg opsega", // Set headline explicitly since component uses headline || config.title
      refusal: {
        message: "Ovo pitanje je izvan našeg opsega.",
      },
    }
    const refusalState: AssistantControllerState = {
      ...idleState,
      status: "COMPLETE",
      activeAnswer: refusalResponse,
    }

    render(<AnswerSection state={refusalState} surface="MARKETING" />)

    // Croatian: "Izvan našeg opsega" (from response.headline)
    expect(screen.getByRole("heading", { name: /izvan našeg opsega/i })).toBeInTheDocument()
    expect(screen.getByText("Ovo pitanje je izvan našeg opsega.")).toBeInTheDocument()
  })

  it("renders error card when status is ERROR", () => {
    const errorState: AssistantControllerState = {
      ...idleState,
      status: "ERROR",
      error: { type: "NETWORK_FAILURE", message: "Connection failed" },
    }

    render(<AnswerSection state={errorState} surface="MARKETING" />)

    expect(screen.getByText(/connection failed/i)).toBeInTheDocument()
  })

  it("headline has tabindex=-1 for focus management", () => {
    const completeState: AssistantControllerState = {
      ...idleState,
      status: "COMPLETE",
      activeAnswer: mockResponse,
    }

    render(<AnswerSection state={completeState} surface="MARKETING" />)

    const headline = screen.getByRole("heading", { level: 2 })
    expect(headline).toHaveAttribute("tabindex", "-1")
  })
})
