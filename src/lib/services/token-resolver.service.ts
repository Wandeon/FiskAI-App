// src/lib/services/token-resolver.service.ts

/**
 * TokenResolver Service
 *
 * Resolves runtime tokens in UX text, replacing placeholders like
 * {{pausal_limit}} with formatted values.
 *
 * This service is the single source of truth for token resolution.
 * It integrates with RegulatoryCalendarService for regulatory values
 * and supports context-based values from Company and User objects.
 *
 * @example
 * import { tokenResolver } from '@/lib/services/token-resolver.service'
 *
 * const message = tokenResolver.resolve(
 *   "Vaš limit za {{current_year}} je {{pausal_limit}}",
 *   { company, user, year: 2025, locale: "hr" }
 * )
 * // → "Vaš limit za 2025 je 60.000 €"
 */

import { regulatoryCalendarService } from "./regulatory-calendar.service"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Minimal Company interface for token resolution
 * Uses only fields needed for token values
 */
export interface TokenCompany {
  name: string
  oib: string
  address?: string
  city?: string
  postalCode?: string
  country?: string
  email?: string
  phone?: string
  iban?: string
  vatNumber?: string | null
  isVatPayer?: boolean
}

/**
 * Minimal User interface for token resolution
 */
export interface TokenUser {
  name?: string | null
  email: string
}

/**
 * Context provided to the token resolver
 */
export interface TokenContext {
  /** Company data for company-specific tokens */
  company?: TokenCompany
  /** User data for user-specific tokens */
  user?: TokenUser
  /** Year for historical regulatory values (defaults to current year) */
  year?: number
  /**
   * Locale for formatting (reserved for future i18n)
   * Currently only 'hr' Croatian formatting is implemented
   * @default 'hr'
   */
  locale?: string
}

/**
 * Token value types
 */
type TokenValue = string | number | Date | undefined | null

/**
 * Token definition with value and optional formatter
 */
interface TokenDefinition {
  value: TokenValue
  format?: "currency" | "percentage" | "date" | "number" | "string"
}

// =============================================================================
// FORMATTERS
// =============================================================================

/**
 * Format a number as Croatian currency (e.g., "60.000 €")
 */
function formatCroatianCurrency(value: number): string {
  // Croatian format uses dots for thousands, comma for decimals
  const formatter = new Intl.NumberFormat("hr-HR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  const formatted = formatter.format(value)
  return `${formatted} €`
}

/**
 * Format a number as Croatian percentage (e.g., "25%")
 */
function formatCroatianPercentage(value: number): string {
  // Convert decimal to percentage (0.25 -> 25)
  const percentage = value * 100

  // Use Croatian locale for proper comma decimal separator
  if (percentage % 1 === 0) {
    // Whole number - no decimals needed
    return `${percentage.toFixed(0)}%`
  } else {
    // Has decimals - use Croatian format (comma for decimal separator)
    const formatter = new Intl.NumberFormat("hr-HR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })
    return `${formatter.format(percentage)}%`
  }
}

/**
 * Format a date as Croatian format (DD.MM.YYYY)
 */
function formatCroatianDate(value: Date): string {
  const day = value.getDate().toString().padStart(2, "0")
  const month = (value.getMonth() + 1).toString().padStart(2, "0")
  const year = value.getFullYear()
  return `${day}.${month}.${year}`
}

/**
 * Format a number in Croatian format
 */
function formatCroatianNumber(value: number): string {
  const formatter = new Intl.NumberFormat("hr-HR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return formatter.format(value)
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

/**
 * TokenResolver
 *
 * Resolves runtime tokens in UX text templates.
 *
 * Token Sources:
 * 1. Regulatory values from RegulatoryCalendarService
 * 2. Company-specific values from context.company
 * 3. User values from context.user
 * 4. Date/time values (current_year, current_month, etc.)
 *
 * Formatting:
 * - Currency: Croatian format (60.000 €)
 * - Percentages: 25% (not 0.25)
 * - Dates: DD.MM.YYYY
 */
export class TokenResolver {
  private readonly TOKEN_PATTERN = /\{\{([a-z0-9_]+)\}\}/gi

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Resolve all tokens in a template string
   *
   * @param template - Template string with {{token}} placeholders
   * @param context - Context object with company, user, year, locale
   * @returns Resolved string with tokens replaced by formatted values
   *
   * @example
   * resolve("Limit: {{pausal_limit}}", { year: 2025, locale: "hr" })
   * // → "Limit: 60.000 €"
   */
  resolve(template: string, context: TokenContext = {}): string {
    const tokens = this.buildTokenMap(context)

    return template.replace(this.TOKEN_PATTERN, (match, tokenName: string) => {
      const normalizedName = tokenName.toLowerCase()
      const definition = tokens.get(normalizedName)

      if (!definition) {
        // Token not found - return as-is (graceful handling)
        if (process.env.NODE_ENV === "development") {
          console.warn(`[TokenResolver] Unknown token: {{${tokenName}}}`)
        }
        return match
      }

      return this.formatValue(definition)
    })
  }

  /**
   * Resolve tokens in multiple templates (batch operation)
   *
   * @param templates - Array of template strings
   * @param context - Context object
   * @returns Array of resolved strings
   *
   * @example
   * resolveMany(["Limit: {{pausal_limit}}", "Year: {{current_year}}"], context)
   * // → ["Limit: 60.000 €", "Year: 2025"]
   */
  resolveMany(templates: string[], context: TokenContext = {}): string[] {
    // Build token map once for efficiency
    const tokens = this.buildTokenMap(context)

    return templates.map((template) => {
      return template.replace(this.TOKEN_PATTERN, (match, tokenName: string) => {
        const normalizedName = tokenName.toLowerCase()
        const definition = tokens.get(normalizedName)

        if (!definition) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[TokenResolver] Unknown token: {{${tokenName}}}`)
          }
          return match
        }

        return this.formatValue(definition)
      })
    })
  }

  /**
   * Get all available tokens and their current values
   * Useful for debugging and documentation
   *
   * @param context - Context object
   * @returns Map of token names to their formatted values
   */
  getAvailableTokens(context: TokenContext = {}): Record<string, string> {
    const tokens = this.buildTokenMap(context)
    const result: Record<string, string> = {}

    for (const [name, definition] of tokens) {
      result[name] = this.formatValue(definition)
    }

    return result
  }

  /**
   * Check if a template contains any unresolved tokens
   *
   * @param template - Template string
   * @param context - Context object
   * @returns Array of unresolved token names
   */
  getUnresolvedTokens(template: string, context: TokenContext = {}): string[] {
    const tokens = this.buildTokenMap(context)
    const unresolved: string[] = []

    let match: RegExpExecArray | null
    const pattern = new RegExp(this.TOKEN_PATTERN)

    while ((match = pattern.exec(template)) !== null) {
      const tokenName = match[1].toLowerCase()
      if (!tokens.has(tokenName)) {
        unresolved.push(tokenName)
      }
    }

    return unresolved
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Build complete token map from all sources
   */
  private buildTokenMap(context: TokenContext): Map<string, TokenDefinition> {
    const tokens = new Map<string, TokenDefinition>()

    // 1. Regulatory values from RegulatoryCalendarService
    this.addRegulatoryTokens(tokens, context.year)

    // 2. Company-specific values
    if (context.company) {
      this.addCompanyTokens(tokens, context.company)
    }

    // 3. User values
    if (context.user) {
      this.addUserTokens(tokens, context.user)
    }

    // 4. Date/time tokens
    this.addDateTokens(tokens)

    return tokens
  }

  /**
   * Add tokens from RegulatoryCalendarService
   */
  private addRegulatoryTokens(tokens: Map<string, TokenDefinition>, year?: number): void {
    const regValues = regulatoryCalendarService.getTokenValues()

    // Thresholds - format as currency
    tokens.set("pausal_limit", {
      value: year
        ? regulatoryCalendarService.getPausalLimit(year)
        : (regValues.pausal_limit as number),
      format: "currency",
    })

    tokens.set("vat_threshold", {
      value: year
        ? regulatoryCalendarService.getVatThreshold(year)
        : (regValues.vat_threshold as number),
      format: "currency",
    })

    // VAT rates - format as percentage
    tokens.set("vat_rate_standard", {
      value: regValues.vat_rate_standard as number,
      format: "percentage",
    })

    tokens.set("vat_rate_reduced", {
      value: regValues.vat_rate_reduced as number,
      format: "percentage",
    })

    tokens.set("vat_rate_reduced2", {
      value: regValues.vat_rate_reduced2 as number,
      format: "percentage",
    })

    // Pausal tax rate - format as percentage
    tokens.set("tax_rate_pausal", {
      value: regValues.pausal_tax_rate as number,
      format: "percentage",
    })

    // Contribution rates - format as percentage
    tokens.set("mio_i_rate", {
      value: regValues.mio_i_rate as number,
      format: "percentage",
    })

    tokens.set("mio_ii_rate", {
      value: regValues.mio_ii_rate as number,
      format: "percentage",
    })

    tokens.set("hzzo_rate", {
      value: regValues.hzzo_rate as number,
      format: "percentage",
    })

    // Contribution amounts - format as currency
    tokens.set("contribution_mio", {
      value: regValues.contribution_mio as number,
      format: "currency",
    })

    tokens.set("monthly_mio_i", {
      value: regValues.monthly_mio_i as number,
      format: "currency",
    })

    tokens.set("monthly_mio_ii", {
      value: regValues.monthly_mio_ii as number,
      format: "currency",
    })

    tokens.set("monthly_hzzo", {
      value: regValues.monthly_hzzo as number,
      format: "currency",
    })

    tokens.set("monthly_contributions_total", {
      value: regValues.monthly_contributions_total as number,
      format: "currency",
    })

    tokens.set("contribution_base_minimum", {
      value: regValues.contribution_base_minimum as number,
      format: "currency",
    })

    tokens.set("contribution_base_maximum", {
      value: regValues.contribution_base_maximum as number,
      format: "currency",
    })

    // Year/time values - format as string
    tokens.set("current_year", {
      value: regValues.current_year as number,
      format: "string",
    })

    tokens.set("current_quarter", {
      value: regValues.current_quarter as number,
      format: "string",
    })

    tokens.set("current_month", {
      value: regValues.current_month as number,
      format: "string",
    })

    // Deadline date - stub for now (needs ComplianceService)
    // TODO: Integrate with ComplianceService when available
    tokens.set("deadline_date", {
      value: null,
      format: "date",
    })

    // Limit percentage calculations for onboarding
    const pausalLimit = year
      ? regulatoryCalendarService.getPausalLimit(year)
      : (regValues.pausal_limit as number)

    tokens.set("limit_30_pct", {
      value: Math.round(pausalLimit * 0.3),
      format: "currency",
    })

    tokens.set("limit_60_pct", {
      value: Math.round(pausalLimit * 0.6),
      format: "currency",
    })

    tokens.set("limit_100_pct", {
      value: pausalLimit,
      format: "currency",
    })
  }

  /**
   * Add tokens from Company context
   */
  private addCompanyTokens(tokens: Map<string, TokenDefinition>, company: TokenCompany): void {
    tokens.set("company_name", {
      value: company.name,
      format: "string",
    })

    tokens.set("company_oib", {
      value: company.oib,
      format: "string",
    })

    if (company.address) {
      tokens.set("company_address", {
        value: company.address,
        format: "string",
      })
    }

    if (company.city) {
      tokens.set("company_city", {
        value: company.city,
        format: "string",
      })
    }

    if (company.postalCode) {
      tokens.set("company_postal_code", {
        value: company.postalCode,
        format: "string",
      })
    }

    if (company.country) {
      tokens.set("company_country", {
        value: company.country,
        format: "string",
      })
    }

    if (company.email) {
      tokens.set("company_email", {
        value: company.email,
        format: "string",
      })
    }

    if (company.phone) {
      tokens.set("company_phone", {
        value: company.phone,
        format: "string",
      })
    }

    if (company.iban) {
      tokens.set("company_iban", {
        value: company.iban,
        format: "string",
      })
    }

    if (company.vatNumber) {
      tokens.set("company_vat_number", {
        value: company.vatNumber,
        format: "string",
      })
    }

    // Full address for convenience
    const fullAddress = [company.address, company.postalCode, company.city]
      .filter(Boolean)
      .join(", ")

    if (fullAddress) {
      tokens.set("company_full_address", {
        value: fullAddress,
        format: "string",
      })
    }
  }

  /**
   * Add tokens from User context
   */
  private addUserTokens(tokens: Map<string, TokenDefinition>, user: TokenUser): void {
    if (user.name) {
      tokens.set("user_name", {
        value: user.name,
        format: "string",
      })
    }

    tokens.set("user_email", {
      value: user.email,
      format: "string",
    })
  }

  /**
   * Add date/time tokens
   */
  private addDateTokens(tokens: Map<string, TokenDefinition>): void {
    const now = new Date()

    tokens.set("today", {
      value: now,
      format: "date",
    })

    // Month name in Croatian
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

    tokens.set("current_month_name", {
      value: croatianMonths[now.getMonth()],
      format: "string",
    })

    // Quarter name in Croatian
    const quarterNames = [
      "Q1 (siječanj-ožujak)",
      "Q2 (travanj-lipanj)",
      "Q3 (srpanj-rujan)",
      "Q4 (listopad-prosinac)",
    ]
    const currentQuarter = Math.floor(now.getMonth() / 3)

    tokens.set("current_quarter_name", {
      value: quarterNames[currentQuarter],
      format: "string",
    })
  }

  /**
   * Format a token value based on its type
   */
  private formatValue(definition: TokenDefinition): string {
    const { value, format } = definition

    if (value === null || value === undefined) {
      return ""
    }

    switch (format) {
      case "currency":
        return formatCroatianCurrency(value as number)

      case "percentage":
        return formatCroatianPercentage(value as number)

      case "date":
        return formatCroatianDate(value as Date)

      case "number":
        return formatCroatianNumber(value as number)

      case "string":
      default:
        return String(value)
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

/**
 * Singleton instance of TokenResolver
 *
 * @example
 * import { tokenResolver } from '@/lib/services/token-resolver.service'
 *
 * const message = tokenResolver.resolve(
 *   "Vaš limit za {{current_year}} je {{pausal_limit}}",
 *   { company, user, year: 2025, locale: "hr" }
 * )
 */
export const tokenResolver = new TokenResolver()

// Also export the class for testing
export default TokenResolver
