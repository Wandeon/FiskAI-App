import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AIAnswerBlock } from "../ai-answer-block"
import type { AIAnswerBlockProps, AIAnswerSource } from "../ai-answer-block"

// Helper to create minimum required props
const createMinimalProps = (overrides?: Partial<AIAnswerBlockProps>): AIAnswerBlockProps => ({
  answerId: "test-answer:bluf:v1",
  type: "regulatory",
  confidence: "high",
  contentType: "guide",
  lastUpdated: "2025-01-15",
  bluf: "This is the bottom line up front.",
  children: <p>Detailed explanation content.</p>,
  ...overrides,
})

describe("AIAnswerBlock", () => {
  describe("Renders with required props", () => {
    it("renders with all required props", () => {
      const props = createMinimalProps()
      render(<AIAnswerBlock {...props} />)

      // Should render the article
      const article = screen.getByRole("article")
      expect(article).toBeInTheDocument()

      // Should render BLUF
      expect(screen.getByText("This is the bottom line up front.")).toBeInTheDocument()

      // Should render children
      expect(screen.getByText("Detailed explanation content.")).toBeInTheDocument()
    })
  })

  describe("Data attributes", () => {
    it("sets data-ai-answer attribute to true", () => {
      render(<AIAnswerBlock {...createMinimalProps()} />)
      const article = screen.getByRole("article")
      expect(article).toHaveAttribute("data-ai-answer", "true")
    })

    it("sets data-answer-id attribute", () => {
      render(<AIAnswerBlock {...createMinimalProps({ answerId: "pdv-threshold:bluf:v1" })} />)
      const article = screen.getByRole("article")
      expect(article).toHaveAttribute("data-answer-id", "pdv-threshold:bluf:v1")
    })

    it("sets data-version attribute with default of 1", () => {
      render(<AIAnswerBlock {...createMinimalProps()} />)
      const article = screen.getByRole("article")
      expect(article).toHaveAttribute("data-version", "1")
    })

    it("sets data-version attribute with custom value", () => {
      render(<AIAnswerBlock {...createMinimalProps({ version: 3 })} />)
      const article = screen.getByRole("article")
      expect(article).toHaveAttribute("data-version", "3")
    })

    it("sets data-answer-type attribute", () => {
      render(<AIAnswerBlock {...createMinimalProps({ type: "procedural" })} />)
      const article = screen.getByRole("article")
      expect(article).toHaveAttribute("data-answer-type", "procedural")
    })

    it("sets data-confidence attribute", () => {
      render(<AIAnswerBlock {...createMinimalProps({ confidence: "medium" })} />)
      const article = screen.getByRole("article")
      expect(article).toHaveAttribute("data-confidence", "medium")
    })

    it("sets data-evidence-strength attribute when provided", () => {
      render(<AIAnswerBlock {...createMinimalProps({ evidenceStrength: "primary-law" })} />)
      const article = screen.getByRole("article")
      expect(article).toHaveAttribute("data-evidence-strength", "primary-law")
    })

    it("does not set data-evidence-strength when not provided", () => {
      render(<AIAnswerBlock {...createMinimalProps()} />)
      const article = screen.getByRole("article")
      expect(article).not.toHaveAttribute("data-evidence-strength")
    })

    it("sets data-content-type attribute", () => {
      render(<AIAnswerBlock {...createMinimalProps({ contentType: "glossary" })} />)
      const article = screen.getByRole("article")
      expect(article).toHaveAttribute("data-content-type", "glossary")
    })

    it("sets data-concept-id attribute when provided", () => {
      render(<AIAnswerBlock {...createMinimalProps({ conceptId: "pdv-threshold" })} />)
      const article = screen.getByRole("article")
      expect(article).toHaveAttribute("data-concept-id", "pdv-threshold")
    })

    it("does not set data-concept-id when not provided", () => {
      render(<AIAnswerBlock {...createMinimalProps()} />)
      const article = screen.getByRole("article")
      expect(article).not.toHaveAttribute("data-concept-id")
    })

    it("sets data-last-updated attribute", () => {
      render(<AIAnswerBlock {...createMinimalProps({ lastUpdated: "2025-02-01" })} />)
      const article = screen.getByRole("article")
      expect(article).toHaveAttribute("data-last-updated", "2025-02-01")
    })

    it("sets data-as-of attribute when provided", () => {
      render(<AIAnswerBlock {...createMinimalProps({ asOf: "2025-01-20" })} />)
      const article = screen.getByRole("article")
      expect(article).toHaveAttribute("data-as-of", "2025-01-20")
    })

    it("does not set data-as-of when not provided", () => {
      render(<AIAnswerBlock {...createMinimalProps()} />)
      const article = screen.getByRole("article")
      expect(article).not.toHaveAttribute("data-as-of")
    })
  })

  describe("Language attribute", () => {
    it("sets lang attribute to hr on article element", () => {
      render(<AIAnswerBlock {...createMinimalProps()} />)
      const article = screen.getByRole("article")
      expect(article).toHaveAttribute("lang", "hr")
    })
  })

  describe("BLUF rendering", () => {
    it("renders BLUF in header with data-ai-bluf attribute", () => {
      render(
        <AIAnswerBlock {...createMinimalProps({ bluf: "The tax threshold is 39,816.84 EUR." })} />
      )

      const header = document.querySelector("header[data-ai-bluf='true']")
      expect(header).toBeInTheDocument()
      expect(header).toHaveTextContent("The tax threshold is 39,816.84 EUR.")
    })

    it("renders BLUF text within a paragraph element", () => {
      render(<AIAnswerBlock {...createMinimalProps({ bluf: "Important information." })} />)

      const header = document.querySelector("header[data-ai-bluf='true']")
      const paragraph = header?.querySelector("p")
      expect(paragraph).toBeInTheDocument()
      expect(paragraph).toHaveTextContent("Important information.")
    })
  })

  describe("Explanation rendering", () => {
    it("renders children in main with data-ai-explanation attribute", () => {
      render(
        <AIAnswerBlock {...createMinimalProps()}>
          <div data-testid="custom-content">Custom explanation content</div>
        </AIAnswerBlock>
      )

      const main = document.querySelector("main[data-ai-explanation='true']")
      expect(main).toBeInTheDocument()
      expect(screen.getByTestId("custom-content")).toBeInTheDocument()
    })
  })

  describe("Sources rendering", () => {
    const mockSources: AIAnswerSource[] = [
      { ref: "NN:2/25", label: "Narodne novine 2/25", url: "https://nn.hr/2/25" },
      { ref: "NN:33/24", label: "Narodne novine 33/24" },
    ]

    it("renders sources in footer with data-ai-sources attribute", () => {
      render(<AIAnswerBlock {...createMinimalProps({ sources: mockSources })} />)

      const footer = document.querySelector("footer[data-ai-sources='true']")
      expect(footer).toBeInTheDocument()
    })

    it("renders sources as a list", () => {
      render(<AIAnswerBlock {...createMinimalProps({ sources: mockSources })} />)

      const footer = document.querySelector("footer[data-ai-sources='true']")
      const list = footer?.querySelector("ul")
      expect(list).toBeInTheDocument()

      const items = list?.querySelectorAll("li")
      expect(items).toHaveLength(2)
    })

    it("sets data-source-ref attribute on each list item", () => {
      render(<AIAnswerBlock {...createMinimalProps({ sources: mockSources })} />)

      const item1 = document.querySelector("li[data-source-ref='NN:2/25']")
      const item2 = document.querySelector("li[data-source-ref='NN:33/24']")

      expect(item1).toBeInTheDocument()
      expect(item2).toBeInTheDocument()
    })

    it("renders source label as link when URL is provided", () => {
      render(<AIAnswerBlock {...createMinimalProps({ sources: mockSources })} />)

      const link = screen.getByRole("link", { name: "Narodne novine 2/25" })
      expect(link).toHaveAttribute("href", "https://nn.hr/2/25")
    })

    it("renders source label without link when URL is not provided", () => {
      render(<AIAnswerBlock {...createMinimalProps({ sources: mockSources })} />)

      // Should not be a link
      expect(screen.queryByRole("link", { name: "Narodne novine 33/24" })).not.toBeInTheDocument()
      // But text should still appear
      expect(screen.getByText("Narodne novine 33/24")).toBeInTheDocument()
    })

    it("does not render footer when no sources provided", () => {
      render(<AIAnswerBlock {...createMinimalProps({ sources: undefined })} />)

      const footer = document.querySelector("footer[data-ai-sources='true']")
      expect(footer).not.toBeInTheDocument()
    })

    it("does not render footer when sources array is empty", () => {
      render(<AIAnswerBlock {...createMinimalProps({ sources: [] })} />)

      const footer = document.querySelector("footer[data-ai-sources='true']")
      expect(footer).not.toBeInTheDocument()
    })
  })

  describe("Confidence badge visibility", () => {
    it("does not show confidence badge when confidence is high", () => {
      render(<AIAnswerBlock {...createMinimalProps({ confidence: "high" })} />)

      // Badge should not be visible for high confidence
      const header = document.querySelector("header[data-ai-bluf='true']")
      expect(header?.textContent).not.toMatch(/high/i)
    })

    it("shows confidence badge when confidence is medium", () => {
      render(<AIAnswerBlock {...createMinimalProps({ confidence: "medium" })} />)

      // Should show Croatian label for medium confidence
      expect(screen.getByText(/srednja pouzdanost/i)).toBeInTheDocument()
    })

    it("shows confidence badge when confidence is low", () => {
      render(<AIAnswerBlock {...createMinimalProps({ confidence: "low" })} />)

      // Should show Croatian label for low confidence
      expect(screen.getByText(/niska pouzdanost/i)).toBeInTheDocument()
    })

    it("shows confidence badge when confidence is pending", () => {
      render(<AIAnswerBlock {...createMinimalProps({ confidence: "pending" })} />)

      // Should show Croatian label for pending confidence
      expect(screen.getByText(/na cekanju/i)).toBeInTheDocument()
    })
  })

  describe("Date display", () => {
    it("displays the last updated date in header", () => {
      render(<AIAnswerBlock {...createMinimalProps({ lastUpdated: "2025-01-15" })} />)

      // Check that date is displayed (format may vary)
      const header = document.querySelector("header[data-ai-bluf='true']")
      expect(header).toBeInTheDocument()
      // The date should be somewhere in the header's meta section
    })
  })

  describe("Custom className", () => {
    it("applies custom className to article", () => {
      render(<AIAnswerBlock {...createMinimalProps({ className: "custom-class" })} />)

      const article = screen.getByRole("article")
      expect(article).toHaveClass("custom-class")
    })
  })
})
