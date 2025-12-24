import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EvidencePanel } from "../EvidencePanel"
import type { CitationBlock, SourceCard } from "@/lib/assistant"

const primarySource: SourceCard = {
  id: "src_1",
  title: "Zakon o porezu na dodanu vrijednost",
  authority: "LAW",
  reference: "čl. 38, st. 1",
  quote: "Standardna stopa poreza na dodanu vrijednost iznosi 25 posto.",
  url: "https://narodne-novine.nn.hr/clanci/sluzbeni/2024_01_1_1.html",
  effectiveFrom: "2024-01-01",
  confidence: 0.98,
  status: "ACTIVE",
}

const supportingSource: SourceCard = {
  id: "src_2",
  title: "Pravilnik o PDV-u",
  authority: "REGULATION",
  reference: "čl. 47",
  url: "https://narodne-novine.nn.hr/clanci/sluzbeni/2024_01_2_2.html",
  effectiveFrom: "2024-01-01",
  confidence: 0.92,
  status: "ACTIVE",
}

const mockCitations: CitationBlock = {
  primary: primarySource,
  supporting: [supportingSource],
}

describe("EvidencePanel", () => {
  it('renders header "Sources"', () => {
    render(<EvidencePanel citations={mockCitations} status="COMPLETE" />)

    expect(screen.getByRole("heading", { name: /sources/i })).toBeInTheDocument()
  })

  it("renders primary source card expanded", () => {
    render(<EvidencePanel citations={mockCitations} status="COMPLETE" />)

    expect(screen.getByText(/Zakon o porezu/)).toBeInTheDocument()
    expect(screen.getByText(/čl\. 38/)).toBeInTheDocument()
  })

  it("renders quote excerpt from primary source", () => {
    render(<EvidencePanel citations={mockCitations} status="COMPLETE" />)

    expect(screen.getByText(/Standardna stopa/)).toBeInTheDocument()
  })

  it("renders supporting sources collapsed", () => {
    render(<EvidencePanel citations={mockCitations} status="COMPLETE" />)

    expect(screen.getByText(/supporting sources \(1\)/i)).toBeInTheDocument()
  })

  it("expands supporting sources when clicked", async () => {
    const user = userEvent.setup()

    render(<EvidencePanel citations={mockCitations} status="COMPLETE" />)

    await user.click(screen.getByText(/supporting sources/i))

    expect(screen.getByText(/Pravilnik o PDV/)).toBeInTheDocument()
  })

  it("renders placeholder when no citations", () => {
    render(<EvidencePanel citations={undefined} status="IDLE" />)

    expect(screen.getByText(/sources will appear here/i)).toBeInTheDocument()
  })

  it("renders skeleton when LOADING", () => {
    render(<EvidencePanel citations={undefined} status="LOADING" />)

    expect(screen.getByTestId("evidence-skeleton")).toBeInTheDocument()
  })

  it('renders "View source" link with correct href', () => {
    render(<EvidencePanel citations={mockCitations} status="COMPLETE" />)

    const link = screen.getByRole("link", { name: /view source/i })
    expect(link).toHaveAttribute("href", primarySource.url)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it('has id="assistant-sources" for skip link target', () => {
    render(<EvidencePanel citations={mockCitations} status="COMPLETE" />)

    expect(document.getElementById("assistant-sources")).toBeInTheDocument()
  })
})
