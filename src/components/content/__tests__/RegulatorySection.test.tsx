import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { RegulatorySection } from "../RegulatorySection"

describe("RegulatorySection", () => {
  describe("basic rendering", () => {
    it("renders children correctly", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high">
          <p>Test content</p>
        </RegulatorySection>
      )

      expect(screen.getByText("Test content")).toBeInTheDocument()
    })

    it("renders as a section element", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toBeInTheDocument()
    })

    it("applies custom className", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" className="custom-class">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveClass("custom-class")
    })
  })

  describe("data attributes", () => {
    it("sets id attribute correctly", () => {
      render(
        <RegulatorySection id="sec-123" confidence="high">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("id", "sec-123")
    })

    it("sets data-regulatory-section attribute", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-regulatory-section", "true")
    })

    it("sets data-regulatory-section-version to default 1", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-regulatory-section-version", "1")
    })

    it("sets data-regulatory-section-version from prop", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" version={3}>
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-regulatory-section-version", "3")
    })

    it("sets data-confidence-stated correctly", () => {
      render(
        <RegulatorySection id="sec-1" confidence="medium">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-confidence-stated", "medium")
    })

    it("sets data-confidence-derived when provided", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" derivedConfidence="medium">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-confidence-derived", "medium")
    })

    it("does not set data-confidence-derived when not provided", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).not.toHaveAttribute("data-confidence-derived")
    })

    it("sets data-source-label when source is provided", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" source="NN 114/23">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-source-label", "NN 114/23")
    })

    it("sets data-source-ref when sourceRef is provided", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" sourceRef="NN:114/23">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-source-ref", "NN:114/23")
    })

    it("sets data-source-evidence-id when provided", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" sourceEvidenceId="ev-abc123">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-source-evidence-id", "ev-abc123")
    })

    it("sets data-as-of when provided", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" asOf="2024-01-15">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-as-of", "2024-01-15")
    })

    it("sets data-source-pointer-id when provided", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" sourcePointerId="ptr-xyz789">
          <p>Content</p>
        </RegulatorySection>
      )
      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-source-pointer-id", "ptr-xyz789")
    })

    it("sets data-effective-from when provided", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" effectiveFrom="2024-01-01">
          <p>Content</p>
        </RegulatorySection>
      )
      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-effective-from", "2024-01-01")
    })

    it("sets data-conflict to false when hasConflict is false or not provided", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-conflict", "false")
    })

    it("sets data-conflict to true when hasConflict is true", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" hasConflict>
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-conflict", "true")
    })
  })

  describe("effective confidence (downgrade policy)", () => {
    // Confidence order: high > medium > low > pending
    // Effective = min(stated, derived)

    it("sets effective confidence to stated when no derived", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-confidence-effective", "high")
    })

    it("downgrades effective when derived is lower than stated", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" derivedConfidence="low">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-confidence-effective", "low")
    })

    it("keeps stated when derived is higher than stated", () => {
      render(
        <RegulatorySection id="sec-1" confidence="low" derivedConfidence="high">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-confidence-effective", "low")
    })

    it("handles medium vs low correctly", () => {
      render(
        <RegulatorySection id="sec-1" confidence="medium" derivedConfidence="low">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-confidence-effective", "low")
    })

    it("handles pending as lowest confidence", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" derivedConfidence="pending">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-confidence-effective", "pending")
    })

    it("handles same stated and derived confidence", () => {
      render(
        <RegulatorySection id="sec-1" confidence="medium" derivedConfidence="medium">
          <p>Content</p>
        </RegulatorySection>
      )

      const section = document.querySelector("section")
      expect(section).toHaveAttribute("data-confidence-effective", "medium")
    })
  })

  describe("conflict indicator", () => {
    it("shows conflict warning when hasConflict is true", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" hasConflict>
          <p>Content</p>
        </RegulatorySection>
      )

      // Look for a conflict indicator element
      const conflictIndicator = screen.getByRole("status", { name: /conflict/i })
      expect(conflictIndicator).toBeInTheDocument()
    })

    it("does not show conflict warning when hasConflict is false", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" hasConflict={false}>
          <p>Content</p>
        </RegulatorySection>
      )

      const conflictIndicator = screen.queryByRole("status", { name: /conflict/i })
      expect(conflictIndicator).not.toBeInTheDocument()
    })
  })

  describe("confidence badge", () => {
    it("shows confidence badge with effective confidence", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high">
          <p>Content</p>
        </RegulatorySection>
      )

      // Should have a confidence indicator
      const badge = screen.getByRole("status", { name: /confidence/i })
      expect(badge).toBeInTheDocument()
    })

    it("shows appropriate icon for high confidence", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high">
          <p>Content</p>
        </RegulatorySection>
      )

      const badge = screen.getByRole("status", { name: /high confidence/i })
      expect(badge).toBeInTheDocument()
    })

    it("shows appropriate icon for low confidence", () => {
      render(
        <RegulatorySection id="sec-1" confidence="low">
          <p>Content</p>
        </RegulatorySection>
      )

      const badge = screen.getByRole("status", { name: /low confidence/i })
      expect(badge).toBeInTheDocument()
    })
  })

  describe("source citation", () => {
    it("shows source citation when source is provided", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high" source="NN 114/23">
          <p>Content</p>
        </RegulatorySection>
      )

      expect(screen.getByText("NN 114/23")).toBeInTheDocument()
    })

    it("does not show source citation when source is not provided", () => {
      render(
        <RegulatorySection id="sec-1" confidence="high">
          <p>Content</p>
        </RegulatorySection>
      )

      // The source should not appear - we can verify by looking for a cite element
      const cite = document.querySelector("cite")
      expect(cite).not.toBeInTheDocument()
    })
  })
})
