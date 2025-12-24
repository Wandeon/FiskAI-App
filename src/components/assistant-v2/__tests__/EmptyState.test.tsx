import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { EmptyState } from "../EmptyState"

describe("EmptyState", () => {
  it("renders answer placeholder for MARKETING surface", () => {
    render(<EmptyState type="answer" surface="MARKETING" />)

    expect(screen.getByText(/verified answer will appear here/i)).toBeInTheDocument()
    expect(screen.getByText(/verified citations from official sources/i)).toBeInTheDocument()
  })

  it("renders answer placeholder for APP surface", () => {
    render(<EmptyState type="answer" surface="APP" />)

    expect(screen.getByText(/verified answer will appear here/i)).toBeInTheDocument()
    expect(screen.getByText(/calculations based on your connected data/i)).toBeInTheDocument()
  })

  it("renders evidence placeholder", () => {
    render(<EmptyState type="evidence" surface="MARKETING" />)

    expect(screen.getByText(/sources/i)).toBeInTheDocument()
    expect(screen.getByText(/official regulations, laws, and guidance/i)).toBeInTheDocument()
  })

  it("renders client data placeholder for APP surface", () => {
    render(<EmptyState type="clientData" surface="APP" />)

    expect(screen.getByText(/your data/i)).toBeInTheDocument()
    expect(screen.getByText(/connected sources will be used/i)).toBeInTheDocument()
  })
})
