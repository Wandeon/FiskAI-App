import { describe, it, expect } from "vitest"
import { classifyUrl, applyRiskInheritance } from "../node-classifier"

describe("classifyUrl", () => {
  describe("asset detection", () => {
    it("classifies PDF URLs as ASSET", () => {
      const result = classifyUrl("https://example.com/document.pdf")
      expect(result.nodeType).toBe("ASSET")
      expect(result.freshnessRisk).toBe("MEDIUM")
    })

    it("classifies DOCX URLs as ASSET", () => {
      const result = classifyUrl("https://example.com/file.docx")
      expect(result.nodeType).toBe("ASSET")
    })

    it("classifies by content-type header", () => {
      const result = classifyUrl("https://example.com/download", "application/pdf")
      expect(result.nodeType).toBe("ASSET")
    })
  })

  describe("Croatian regulatory patterns", () => {
    it("classifies /vijesti/ as NEWS_FEED with HIGH risk", () => {
      const result = classifyUrl("https://hzzo.hr/vijesti/nova-objava")
      expect(result.nodeType).toBe("HUB")
      expect(result.nodeRole).toBe("NEWS_FEED")
      expect(result.freshnessRisk).toBe("HIGH")
    })

    it("classifies /novosti/ as NEWS_FEED", () => {
      const result = classifyUrl("https://porezna.hr/novosti/")
      expect(result.nodeRole).toBe("NEWS_FEED")
    })

    it("classifies /propisi/ as REGULATION with CRITICAL risk", () => {
      const result = classifyUrl("https://nn.hr/propisi/zakon-123")
      expect(result.nodeType).toBe("LEAF")
      expect(result.nodeRole).toBe("REGULATION")
      expect(result.freshnessRisk).toBe("CRITICAL")
    })

    it("classifies /zakoni/ as REGULATION", () => {
      const result = classifyUrl("https://nn.hr/zakoni/pdv")
      expect(result.nodeRole).toBe("REGULATION")
      expect(result.freshnessRisk).toBe("CRITICAL")
    })

    it("classifies /savjetovanja/ as GUIDANCE with CRITICAL risk", () => {
      const result = classifyUrl("https://gov.hr/savjetovanja/novi-zakon")
      expect(result.nodeRole).toBe("GUIDANCE")
      expect(result.freshnessRisk).toBe("CRITICAL")
    })

    it("classifies /obrasci/ as FORM with MEDIUM risk", () => {
      const result = classifyUrl("https://porezna.hr/obrasci/pd-prijava")
      expect(result.nodeType).toBe("LEAF")
      expect(result.nodeRole).toBe("FORM")
      expect(result.freshnessRisk).toBe("MEDIUM")
    })

    it("classifies /arhiva/ as ARCHIVE with LOW risk", () => {
      const result = classifyUrl("https://example.com/arhiva/2020/")
      expect(result.nodeType).toBe("HUB")
      expect(result.nodeRole).toBe("ARCHIVE")
      expect(result.freshnessRisk).toBe("LOW")
    })

    it("classifies /upute/ as GUIDANCE", () => {
      const result = classifyUrl("https://porezna.hr/upute/pausalni")
      expect(result.nodeRole).toBe("GUIDANCE")
      expect(result.freshnessRisk).toBe("MEDIUM")
    })

    it("classifies /misljenja/ as GUIDANCE", () => {
      const result = classifyUrl("https://porezna.hr/misljenja/pdv-stope")
      expect(result.nodeRole).toBe("GUIDANCE")
    })
  })

  describe("default classification", () => {
    it("returns LEAF/MEDIUM for unknown URLs", () => {
      const result = classifyUrl("https://example.com/random-page")
      expect(result.nodeType).toBe("LEAF")
      expect(result.nodeRole).toBeNull()
      expect(result.freshnessRisk).toBe("MEDIUM")
    })
  })
})

describe("applyRiskInheritance", () => {
  it("upgrades ASSET risk when parent is CRITICAL", () => {
    const classification = {
      nodeType: "ASSET" as const,
      nodeRole: null,
      freshnessRisk: "MEDIUM" as const,
    }
    const result = applyRiskInheritance(classification, "CRITICAL")
    expect(result.freshnessRisk).toBe("CRITICAL")
  })

  it("upgrades ASSET risk when parent is HIGH", () => {
    const classification = {
      nodeType: "ASSET" as const,
      nodeRole: null,
      freshnessRisk: "MEDIUM" as const,
    }
    const result = applyRiskInheritance(classification, "HIGH")
    expect(result.freshnessRisk).toBe("HIGH")
  })

  it("does not change non-ASSET nodes", () => {
    const classification = {
      nodeType: "LEAF" as const,
      nodeRole: null,
      freshnessRisk: "MEDIUM" as const,
    }
    const result = applyRiskInheritance(classification, "CRITICAL")
    expect(result.freshnessRisk).toBe("MEDIUM")
  })

  it("does not downgrade ASSET risk", () => {
    const classification = {
      nodeType: "ASSET" as const,
      nodeRole: null,
      freshnessRisk: "MEDIUM" as const,
    }
    const result = applyRiskInheritance(classification, "LOW")
    expect(result.freshnessRisk).toBe("MEDIUM")
  })
})
