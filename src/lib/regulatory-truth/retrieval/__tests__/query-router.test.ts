// src/lib/regulatory-truth/retrieval/__tests__/query-router.test.ts
import { describe, it, expect } from "vitest"
import { detectIntentFromPatterns } from "../query-router"

describe("Query Router - Intent Detection", () => {
  describe("PROCESS intent detection", () => {
    const processQueries = [
      { query: "Kako da se registriram za OSS?", desc: "Croatian 'kako da'" },
      { query: "Kako mogu prijaviti PDV?", desc: "Croatian 'kako mogu'" },
      { query: "Koraci za prijavu PDV-a", desc: "Croatian 'koraci za'" },
      { query: "Postupak registracije", desc: "Croatian 'postupak'" },
      { query: "Registracija za PDV", desc: "Croatian 'registracija'" },
      { query: "Prijava za OSS", desc: "Croatian 'prijava za'" },
      { query: "How do I file VAT return?", desc: "English 'how do i'" },
      { query: "How to register for VAT?", desc: "English 'how to'" },
      { query: "What are the steps to register?", desc: "English 'what are the steps'" },
    ]

    it.each(processQueries)('should detect PROCESS intent for: "$query" ($desc)', ({ query }) => {
      const intent = detectIntentFromPatterns(query)
      expect(intent).toBe("PROCESS")
    })
  })

  describe("REFERENCE intent detection", () => {
    const refQueries = [
      { query: "IBAN za Split", desc: "Croatian 'iban za'" },
      { query: "Koji je IBAN za poreznu upravu?", desc: "Croatian 'koji je iban'" },
      { query: "Uplatni račun za PDV", desc: "Croatian 'uplatni racun'" },
      { query: "Šifra za djelatnost", desc: "Croatian 'sifra za'" },
      { query: "CN kod za softver", desc: "Croatian 'cn kod'" },
      { query: "What is the IBAN for tax office?", desc: "English 'what is the iban'" },
      { query: "Account number for VAT payment", desc: "English 'account number'" },
    ]

    it.each(refQueries)('should detect REFERENCE intent for: "$query" ($desc)', ({ query }) => {
      const intent = detectIntentFromPatterns(query)
      expect(intent).toBe("REFERENCE")
    })
  })

  describe("DOCUMENT intent detection", () => {
    const docQueries = [
      { query: "Obrazac PDV-P", desc: "Croatian 'obrazac'" },
      { query: "Gdje mogu naći formular?", desc: "Croatian 'formular'" },
      { query: "Download JOPPD", desc: "English 'download'" },
      { query: "Preuzmi obrazac", desc: "Croatian 'preuzmi'" },
      { query: "Gdje je PDV-P?", desc: "Croatian 'gdje je'" },
      { query: "Gdje mogu naći JOPPD?", desc: "Croatian 'gdje mogu naci'" },
      { query: "PDV-S obrazac", desc: "Form code pattern 'pdv-s'" },
      { query: "JOPPD obrazac za prijavu", desc: "Form code 'joppd'" },
      { query: "Where can I find the PDV form?", desc: "English 'where can i find'" },
      { query: "Form for VAT registration", desc: "English 'form for'" },
    ]

    it.each(docQueries)('should detect DOCUMENT intent for: "$query" ($desc)', ({ query }) => {
      const intent = detectIntentFromPatterns(query)
      expect(intent).toBe("DOCUMENT")
    })
  })

  describe("TEMPORAL intent detection", () => {
    const temporalQueries = [
      { query: "Prijelazne odredbe za PDV", desc: "Croatian 'prijelazne'" },
      { query: "Prijelazna pravila", desc: "Croatian 'prijelazna'" },
      { query: "Stara stopa ili nova?", desc: "Croatian 'stara stopa'" },
      { query: "Nova stopa poreza", desc: "Croatian 'nova stopa'" },
      { query: "Od 1.1.2025 koja stopa?", desc: "Croatian date pattern 'od dd.mm.yyyy'" },
      { query: "Prije 15. prosinca", desc: "Croatian 'prije dd.'" },
      { query: "Poslije 1. siječnja", desc: "Croatian 'poslije dd.'" },
      { query: "Old vs new VAT rate", desc: "English 'old vs new'" },
      { query: "Transitional provisions", desc: "English 'transitional'" },
    ]

    it.each(temporalQueries)('should detect TEMPORAL intent for: "$query" ($desc)', ({ query }) => {
      const intent = detectIntentFromPatterns(query)
      expect(intent).toBe("TEMPORAL")
    })
  })

  describe("STRATEGY intent detection", () => {
    const strategyQueries = [
      { query: "Trebam li otvoriti obrt ili d.o.o.?", desc: "Croatian 'trebam li'" },
      { query: "Trebam li se registrirati?", desc: "Croatian 'trebam li' (simple)" },
      { query: "Sto je bolje - pausalni ili normalni?", desc: "Croatian 'sto je bolje'" },
      { query: "Koji je bolji izbor za mene?", desc: "Croatian 'koji je bolji'" },
      { query: "Should I open a d.o.o.?", desc: "English 'should i'" },
      { query: "Pausalni obrt vs d.o.o.", desc: "Croatian 'vs'" },
      { query: "Kako odabrati pravi oblik?", desc: "Croatian 'odabrati'" },
    ]

    it.each(strategyQueries)('should detect STRATEGY intent for: "$query" ($desc)', ({ query }) => {
      const intent = detectIntentFromPatterns(query)
      expect(intent).toBe("STRATEGY")
    })
  })

  describe("LOGIC intent detection", () => {
    const logicQueries = [
      { query: "Moram li plaćati PDV?", desc: "Croatian 'moram li'" },
      { query: "Koliko iznosi stopa za hranu?", desc: "Croatian 'koliko iznosi'" },
      { query: "Koja je stopa za sok?", desc: "Croatian 'koja je stopa'" },
      { query: "Prag za OSS registraciju?", desc: "Croatian 'prag za'" },
      { query: "Ako prodajem u EU", desc: "Croatian 'ako prodajem'" },
      { query: "Do I have to pay VAT?", desc: "English 'do i have to'" },
      { query: "What is the rate for food?", desc: "English 'what is the rate'" },
      { query: "Threshold for VAT registration", desc: "English 'threshold'" },
      { query: "Am I required to register?", desc: "English 'am i required'" },
    ]

    it.each(logicQueries)('should detect LOGIC intent for: "$query" ($desc)', ({ query }) => {
      const intent = detectIntentFromPatterns(query)
      expect(intent).toBe("LOGIC")
    })
  })

  describe("No pattern match (returns null)", () => {
    const generalQueries = [
      "Hello, can you help me?",
      "Tell me about Croatian taxes",
      "What is VAT?",
      "Explain pausalni obrt",
    ]

    it.each(generalQueries)('should return null for general query: "%s"', (query) => {
      const intent = detectIntentFromPatterns(query)
      expect(intent).toBeNull()
    })
  })

  describe("Pattern priority", () => {
    it("should prioritize PROCESS over LOGIC when both patterns match", () => {
      // "Kako da" is PROCESS, should match before LOGIC patterns
      const intent = detectIntentFromPatterns("Kako da izracunam koliko iznosi PDV?")
      expect(intent).toBe("PROCESS")
    })

    it("should prioritize DOCUMENT over STRATEGY when form code is present", () => {
      // PDV-P is DOCUMENT pattern, should match before STRATEGY
      const intent = detectIntentFromPatterns("Trebam PDV-P obrazac")
      expect(intent).toBe("DOCUMENT")
    })

    it("should detect TEMPORAL before LOGIC for date-based queries", () => {
      const intent = detectIntentFromPatterns("Od 1.1.2025 moram li placati novu stopu?")
      expect(intent).toBe("TEMPORAL")
    })

    it("should detect STRATEGY for comparison queries with 'trebam li'", () => {
      // "trebam li" is now STRATEGY (comparison/decision queries)
      const intent = detectIntentFromPatterns("Trebam li pausalni ili normalni PDV?")
      expect(intent).toBe("STRATEGY")
    })
  })
})
