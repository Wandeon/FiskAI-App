import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { DataPointList } from "../DataPointList"
import type { DataPoint } from "@/lib/assistant"

const mockDataPoints: DataPoint[] = [
  {
    label: "Revenue YTD",
    value: "€31,760",
    source: "Invoices",
    asOfDate: "2024-12-23",
  },
  {
    label: "VAT Threshold",
    value: "€40,000",
    source: "Regulatory rule",
    asOfDate: "2024-01-01",
  },
  {
    label: "Invoice Count",
    value: "47",
    source: "Invoices",
  },
]

describe("DataPointList", () => {
  it("renders all data points", () => {
    render(<DataPointList dataPoints={mockDataPoints} />)

    expect(screen.getByText("Revenue YTD")).toBeInTheDocument()
    expect(screen.getByText("VAT Threshold")).toBeInTheDocument()
    expect(screen.getByText("Invoice Count")).toBeInTheDocument()
  })

  it("renders labels and values", () => {
    render(<DataPointList dataPoints={mockDataPoints} />)

    expect(screen.getByText("€31,760")).toBeInTheDocument()
    expect(screen.getByText("€40,000")).toBeInTheDocument()
    expect(screen.getByText("47")).toBeInTheDocument()
  })

  it("renders source for each data point", () => {
    render(<DataPointList dataPoints={mockDataPoints} />)

    const invoiceSources = screen.getAllByText(/invoices/i)
    expect(invoiceSources.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/regulatory rule/i)).toBeInTheDocument()
  })

  it("renders as-of date when provided", () => {
    render(<DataPointList dataPoints={mockDataPoints} />)

    // Should show formatted dates
    expect(screen.getByText(/12\/23\/2024|23\.12\.2024|Dec 23/)).toBeInTheDocument()
  })

  it("renders nothing when dataPoints is empty", () => {
    const { container } = render(<DataPointList dataPoints={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it("uses definition list semantics", () => {
    render(<DataPointList dataPoints={mockDataPoints} />)

    expect(screen.getByRole("list")).toBeInTheDocument()
  })

  it('renders with header "Data used"', () => {
    render(<DataPointList dataPoints={mockDataPoints} />)

    expect(screen.getByText(/data used/i)).toBeInTheDocument()
  })
})
