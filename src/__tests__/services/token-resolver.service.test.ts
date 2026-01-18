// src/__tests__/services/token-resolver.service.test.ts

/**
 * Unit tests for TokenResolver service
 *
 * These are pure unit tests with no database dependencies.
 * They verify token resolution, formatting, and context handling.
 */

import {
  TokenResolver,
  tokenResolver,
  type TokenContext,
  type TokenCompany,
  type TokenUser,
} from "@/lib/services/token-resolver.service"

describe("TokenResolver", () => {
  let resolver: TokenResolver

  beforeEach(() => {
    resolver = new TokenResolver()
  })

  // ===========================================================================
  // BASIC TOKEN RESOLUTION
  // ===========================================================================

  describe("resolve", () => {
    it("resolves a single token", () => {
      const result = resolver.resolve("Year: {{current_year}}")
      const currentYear = new Date().getFullYear()
      expect(result).toBe(`Year: ${currentYear}`)
    })

    it("resolves multiple tokens in same string", () => {
      const result = resolver.resolve("Limit for {{current_year}}: {{pausal_limit}}")
      const currentYear = new Date().getFullYear()
      expect(result).toBe(`Limit for ${currentYear}: 60.000 €`)
    })

    it("handles templates with no tokens", () => {
      const result = resolver.resolve("Just plain text")
      expect(result).toBe("Just plain text")
    })

    it("handles empty string", () => {
      const result = resolver.resolve("")
      expect(result).toBe("")
    })

    it("preserves unknown tokens (graceful handling)", () => {
      const result = resolver.resolve("Value: {{unknown_token}}")
      expect(result).toBe("Value: {{unknown_token}}")
    })

    it("is case-insensitive for token names", () => {
      const result1 = resolver.resolve("{{CURRENT_YEAR}}")
      const result2 = resolver.resolve("{{current_year}}")
      const result3 = resolver.resolve("{{Current_Year}}")
      expect(result1).toBe(result2)
      expect(result2).toBe(result3)
    })
  })

  // ===========================================================================
  // CROATIAN NUMBER FORMATTING
  // ===========================================================================

  describe("Croatian number formatting", () => {
    it("formats pausal_limit as Croatian currency", () => {
      const result = resolver.resolve("{{pausal_limit}}")
      expect(result).toBe("60.000 €")
    })

    it("formats contribution amounts with Croatian decimals", () => {
      const result = resolver.resolve("{{contribution_mio}}")
      // 143.84 EUR - Croatian format with comma for decimals
      expect(result).toBe("143,84 €")
    })

    it("formats monthly_contributions_total", () => {
      const result = resolver.resolve("{{monthly_contributions_total}}")
      expect(result).toBe("262,51 €")
    })

    it("formats vat_threshold as currency", () => {
      const result = resolver.resolve("{{vat_threshold}}")
      expect(result).toBe("60.000 €")
    })
  })

  // ===========================================================================
  // PERCENTAGE FORMATTING
  // ===========================================================================

  describe("percentage formatting", () => {
    it("formats vat_rate_standard as percentage", () => {
      const result = resolver.resolve("{{vat_rate_standard}}")
      expect(result).toBe("25%")
    })

    it("formats vat_rate_reduced as percentage", () => {
      const result = resolver.resolve("{{vat_rate_reduced}}")
      expect(result).toBe("13%")
    })

    it("formats vat_rate_reduced2 as percentage", () => {
      const result = resolver.resolve("{{vat_rate_reduced2}}")
      expect(result).toBe("5%")
    })

    it("formats tax_rate_pausal as percentage", () => {
      const result = resolver.resolve("{{tax_rate_pausal}}")
      expect(result).toBe("12%")
    })

    it("formats mio_i_rate as percentage", () => {
      const result = resolver.resolve("{{mio_i_rate}}")
      expect(result).toBe("15%")
    })

    it("formats hzzo_rate as percentage with decimal", () => {
      const result = resolver.resolve("{{hzzo_rate}}")
      expect(result).toBe("16,5%")
    })
  })

  // ===========================================================================
  // COMPANY CONTEXT VALUES
  // ===========================================================================

  describe("company context values", () => {
    const mockCompany: TokenCompany = {
      name: "Test Obrt",
      oib: "12345678901",
      address: "Testna ulica 1",
      city: "Zagreb",
      postalCode: "10000",
      country: "HR",
      email: "test@example.com",
      phone: "+385 1 234 5678",
      iban: "HR1234567890123456789",
      vatNumber: "HR12345678901",
    }

    it("resolves company_name", () => {
      const result = resolver.resolve("{{company_name}}", { company: mockCompany })
      expect(result).toBe("Test Obrt")
    })

    it("resolves company_oib", () => {
      const result = resolver.resolve("{{company_oib}}", { company: mockCompany })
      expect(result).toBe("12345678901")
    })

    it("resolves company_address", () => {
      const result = resolver.resolve("{{company_address}}", { company: mockCompany })
      expect(result).toBe("Testna ulica 1")
    })

    it("resolves company_city", () => {
      const result = resolver.resolve("{{company_city}}", { company: mockCompany })
      expect(result).toBe("Zagreb")
    })

    it("resolves company_email", () => {
      const result = resolver.resolve("{{company_email}}", { company: mockCompany })
      expect(result).toBe("test@example.com")
    })

    it("resolves company_iban", () => {
      const result = resolver.resolve("{{company_iban}}", { company: mockCompany })
      expect(result).toBe("HR1234567890123456789")
    })

    it("resolves company_full_address", () => {
      const result = resolver.resolve("{{company_full_address}}", { company: mockCompany })
      expect(result).toBe("Testna ulica 1, 10000, Zagreb")
    })

    it("handles company with minimal fields", () => {
      const minimalCompany: TokenCompany = {
        name: "Minimal Obrt",
        oib: "99999999999",
      }
      const result = resolver.resolve("{{company_name}} - {{company_oib}}", {
        company: minimalCompany,
      })
      expect(result).toBe("Minimal Obrt - 99999999999")
    })

    it("leaves company tokens unresolved when no company in context", () => {
      const result = resolver.resolve("{{company_name}}")
      expect(result).toBe("{{company_name}}")
    })
  })

  // ===========================================================================
  // USER CONTEXT VALUES
  // ===========================================================================

  describe("user context values", () => {
    const mockUser: TokenUser = {
      name: "Ivan Horvat",
      email: "ivan@example.com",
    }

    it("resolves user_name", () => {
      const result = resolver.resolve("{{user_name}}", { user: mockUser })
      expect(result).toBe("Ivan Horvat")
    })

    it("resolves user_email", () => {
      const result = resolver.resolve("{{user_email}}", { user: mockUser })
      expect(result).toBe("ivan@example.com")
    })

    it("handles user with null name", () => {
      const userWithNullName: TokenUser = {
        name: null,
        email: "test@example.com",
      }
      const result = resolver.resolve("Email: {{user_email}}", { user: userWithNullName })
      expect(result).toBe("Email: test@example.com")
    })

    it("leaves user_name unresolved when user.name is null", () => {
      const userWithNullName: TokenUser = {
        name: null,
        email: "test@example.com",
      }
      const result = resolver.resolve("{{user_name}}", { user: userWithNullName })
      expect(result).toBe("{{user_name}}")
    })
  })

  // ===========================================================================
  // DATE/TIME TOKENS
  // ===========================================================================

  describe("date/time tokens", () => {
    it("resolves current_year", () => {
      const result = resolver.resolve("{{current_year}}")
      expect(result).toBe(String(new Date().getFullYear()))
    })

    it("resolves current_month (1-12)", () => {
      const result = resolver.resolve("{{current_month}}")
      const expected = new Date().getMonth() + 1
      expect(result).toBe(String(expected))
    })

    it("resolves current_quarter (1-4)", () => {
      const result = resolver.resolve("{{current_quarter}}")
      const quarter = Math.floor(new Date().getMonth() / 3) + 1
      expect(result).toBe(String(quarter))
    })

    it("resolves today as Croatian date format", () => {
      const result = resolver.resolve("{{today}}")
      // Should match DD.MM.YYYY pattern
      expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/)
    })

    it("resolves current_month_name in Croatian", () => {
      const result = resolver.resolve("{{current_month_name}}")
      const croatianMonths = [
        "siječanj",
        "veljača",
        "ožujak",
        "travanj",
        "svibanj",
        "lipanj",
        "srpanj",
        "kolovoz",
        "rujan",
        "listopad",
        "studeni",
        "prosinac",
      ]
      expect(croatianMonths).toContain(result)
    })

    it("resolves current_quarter_name", () => {
      const result = resolver.resolve("{{current_quarter_name}}")
      expect(result).toMatch(/^Q[1-4] \([a-zčćžšđ]+-[a-zčćžšđ]+\)$/i)
    })
  })

  // ===========================================================================
  // YEAR CONTEXT
  // ===========================================================================

  describe("year context", () => {
    it("uses provided year for regulatory values", () => {
      const result = resolver.resolve("{{pausal_limit}}", { year: 2024 })
      // 2024 limit was 39816.84
      expect(result).toBe("39.816,84 €")
    })

    it("uses current year when year not provided", () => {
      const result = resolver.resolve("{{pausal_limit}}")
      expect(result).toBe("60.000 €")
    })
  })

  // ===========================================================================
  // LIMIT PERCENTAGE TOKENS
  // ===========================================================================

  describe("limit percentage tokens", () => {
    it("resolves limit_30_pct", () => {
      const result = resolver.resolve("{{limit_30_pct}}")
      expect(result).toBe("18.000 €") // 60000 * 0.3 = 18000
    })

    it("resolves limit_60_pct", () => {
      const result = resolver.resolve("{{limit_60_pct}}")
      expect(result).toBe("36.000 €") // 60000 * 0.6 = 36000
    })

    it("resolves limit_100_pct", () => {
      const result = resolver.resolve("{{limit_100_pct}}")
      expect(result).toBe("60.000 €")
    })
  })

  // ===========================================================================
  // BATCH RESOLUTION
  // ===========================================================================

  describe("resolveMany", () => {
    it("resolves multiple templates", () => {
      const templates = [
        "Year: {{current_year}}",
        "Limit: {{pausal_limit}}",
        "VAT: {{vat_rate_standard}}",
      ]
      const results = resolver.resolveMany(templates)
      const currentYear = new Date().getFullYear()

      expect(results).toHaveLength(3)
      expect(results[0]).toBe(`Year: ${currentYear}`)
      expect(results[1]).toBe("Limit: 60.000 €")
      expect(results[2]).toBe("VAT: 25%")
    })

    it("handles empty array", () => {
      const results = resolver.resolveMany([])
      expect(results).toEqual([])
    })

    it("applies same context to all templates", () => {
      const company: TokenCompany = {
        name: "Test Co",
        oib: "12345678901",
      }
      const templates = ["{{company_name}}", "{{company_oib}}"]
      const results = resolver.resolveMany(templates, { company })

      expect(results[0]).toBe("Test Co")
      expect(results[1]).toBe("12345678901")
    })
  })

  // ===========================================================================
  // AVAILABLE TOKENS
  // ===========================================================================

  describe("getAvailableTokens", () => {
    it("returns all regulatory tokens", () => {
      const tokens = resolver.getAvailableTokens()

      expect(tokens).toHaveProperty("pausal_limit")
      expect(tokens).toHaveProperty("vat_rate_standard")
      expect(tokens).toHaveProperty("current_year")
      expect(tokens).toHaveProperty("contribution_mio")
    })

    it("includes company tokens when company provided", () => {
      const company: TokenCompany = {
        name: "Test",
        oib: "12345678901",
      }
      const tokens = resolver.getAvailableTokens({ company })

      expect(tokens).toHaveProperty("company_name")
      expect(tokens.company_name).toBe("Test")
    })

    it("includes user tokens when user provided", () => {
      const user: TokenUser = {
        name: "Test User",
        email: "test@example.com",
      }
      const tokens = resolver.getAvailableTokens({ user })

      expect(tokens).toHaveProperty("user_email")
      expect(tokens.user_email).toBe("test@example.com")
    })
  })

  // ===========================================================================
  // UNRESOLVED TOKENS
  // ===========================================================================

  describe("getUnresolvedTokens", () => {
    it("returns empty array when all tokens resolved", () => {
      const unresolved = resolver.getUnresolvedTokens("{{current_year}}")
      expect(unresolved).toEqual([])
    })

    it("returns array of unresolved token names", () => {
      const unresolved = resolver.getUnresolvedTokens("{{unknown_token}} and {{another_unknown}}")
      expect(unresolved).toContain("unknown_token")
      expect(unresolved).toContain("another_unknown")
    })

    it("returns company tokens as unresolved when no company context", () => {
      const unresolved = resolver.getUnresolvedTokens("{{company_name}}")
      expect(unresolved).toContain("company_name")
    })

    it("returns user tokens as unresolved when no user context", () => {
      const unresolved = resolver.getUnresolvedTokens("{{user_email}}")
      expect(unresolved).toContain("user_email")
    })
  })

  // ===========================================================================
  // REAL-WORLD EXAMPLES FROM SPEC
  // ===========================================================================

  describe("real-world examples from spec", () => {
    it("resolves onboarding income question", () => {
      const template = "Paušalni limit {{current_year}}: {{pausal_limit}}"
      const result = resolver.resolve(template)
      const year = new Date().getFullYear()
      expect(result).toBe(`Paušalni limit ${year}: 60.000 €`)
    })

    it("resolves compliance status message", () => {
      const company: TokenCompany = {
        name: "Obrt Emina",
        oib: "12345678901",
      }
      const template = "{{company_name}} - Vaš limit za {{current_year}} je {{pausal_limit}}"
      const result = resolver.resolve(template, { company })
      const year = new Date().getFullYear()
      expect(result).toBe(`Obrt Emina - Vaš limit za ${year} je 60.000 €`)
    })

    it("resolves contribution reminder", () => {
      const template = "Mjesečni doprinosi: {{monthly_contributions_total}}"
      const result = resolver.resolve(template)
      expect(result).toBe("Mjesečni doprinosi: 262,51 €")
    })

    it("resolves VAT information", () => {
      const template = "PDV stopa: {{vat_rate_standard}}"
      const result = resolver.resolve(template)
      expect(result).toBe("PDV stopa: 25%")
    })
  })

  // ===========================================================================
  // SINGLETON EXPORT
  // ===========================================================================

  describe("singleton export", () => {
    it("exports a singleton instance", () => {
      expect(tokenResolver).toBeInstanceOf(TokenResolver)
    })

    it("singleton works correctly", () => {
      const result = tokenResolver.resolve("{{pausal_limit}}")
      expect(result).toBe("60.000 €")
    })
  })

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe("edge cases", () => {
    it("handles consecutive tokens", () => {
      const result = resolver.resolve("{{current_year}}{{current_year}}")
      const year = new Date().getFullYear()
      expect(result).toBe(`${year}${year}`)
    })

    it("handles tokens with surrounding text", () => {
      const result = resolver.resolve("Start{{current_year}}End")
      const year = new Date().getFullYear()
      expect(result).toBe(`Start${year}End`)
    })

    it("handles newlines in template", () => {
      const result = resolver.resolve("Line 1: {{current_year}}\nLine 2: {{pausal_limit}}")
      const year = new Date().getFullYear()
      expect(result).toBe(`Line 1: ${year}\nLine 2: 60.000 €`)
    })

    it("handles special characters in template", () => {
      const result = resolver.resolve("Limit: {{pausal_limit}} (€)")
      expect(result).toBe("Limit: 60.000 € (€)")
    })
  })
})
