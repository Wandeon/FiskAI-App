// src/lib/fiscal-data/data/deadlines.ts

import type { DeadlinesData } from "../types"

/**
 * Fiscal Deadlines for Croatia 2025
 *
 * Sources:
 * - Porezna uprava: https://www.porezna-uprava.hr/
 * - HOK: https://www.hok.hr/
 */
export const DEADLINES: DeadlinesData = {
  year: 2025,
  lastVerified: "2025-01-15",
  source: "https://www.porezna-uprava.hr/",

  // ===========================================================================
  // CONTRIBUTION DEADLINES
  // ===========================================================================
  contributions: {
    monthly: {
      name: "Mjesečni doprinosi",
      description: "Rok za uplatu mjesečnih doprinosa (MIO I, MIO II, HZZO)",
      dates: ["15"], // 15. u mjesecu za prethodni mjesec
      frequency: "monthly",
    },
    mioII: {
      name: "MIO II. stup",
      description: "Rok za uplatu doprinosa za II. mirovinski stup",
      dates: ["15"], // 15. u mjesecu
      frequency: "monthly",
    },
  },

  // ===========================================================================
  // PAUŠALNI TAX DEADLINES
  // ===========================================================================
  pausalTax: {
    name: "Paušalni porez - kvartalne uplate",
    description: "Kvartalni rokovi za uplatu paušalnog poreza na dohodak",
    dates: ["31.01", "30.04", "31.07", "31.10"],
    frequency: "quarterly",
  },

  // ===========================================================================
  // HOK (CHAMBER) DEADLINES
  // ===========================================================================
  hok: {
    name: "HOK članarina",
    description: "Kvartalni rokovi za uplatu članarine Hrvatskoj obrtničkoj komori",
    dates: ["27.02", "31.05", "31.08", "30.11"],
    frequency: "quarterly",
  },

  // ===========================================================================
  // ANNUAL FILING DEADLINES
  // ===========================================================================
  annualFiling: {
    dohodak: {
      name: "Godišnja prijava poreza na dohodak",
      description: "Rok za podnošenje godišnje porezne prijave (DOH obrazac)",
      dates: ["28.02"], // Do kraja veljače za prethodnu godinu
      frequency: "annual",
    },
    dobit: {
      name: "Prijava poreza na dobit",
      description: "Rok za podnošenje prijave poreza na dobit (PD obrazac)",
      dates: ["30.04"], // Do kraja travnja za prethodnu godinu
      frequency: "annual",
    },
  },
} as const

// =============================================================================
// ADDITIONAL DEADLINES
// =============================================================================

export const ADDITIONAL_DEADLINES = {
  // PDV rokovi
  pdv: {
    monthly: {
      name: "PDV prijava - mjesečna",
      description: "Mjesečna PDV prijava za obveznike s prometom > 800.000 EUR",
      dates: ["20"], // 20. u mjesecu za prethodni mjesec
      frequency: "monthly" as const,
    },
    quarterly: {
      name: "PDV prijava - kvartalna",
      description: "Kvartalna PDV prijava za ostale obveznike",
      dates: ["20.01", "20.04", "20.07", "20.10"],
      frequency: "quarterly" as const,
    },
  },

  // JOPPD
  joppd: {
    name: "JOPPD obrazac",
    description: "Rok za predaju JOPPD obrasca (isplate plaća i sl.)",
    dates: ["15"], // 15. u mjesecu za isplate u prethodnom mjesecu
    frequency: "monthly" as const,
  },

  // Turistička zajednica
  tz: {
    name: "Turistička članarina",
    description: "Godišnji obračun i uplata članarine turističkoj zajednici",
    dates: ["31.03"], // Do kraja ožujka za prethodnu godinu
    frequency: "annual" as const,
  },

  // PO-SD obrazac
  posd: {
    name: "PO-SD obrazac",
    description: "Prijava paušalnog poreza za sljedeću godinu",
    dates: ["15.01"], // Do 15. siječnja
    frequency: "annual" as const,
  },

  posdQuarterly: {
    name: "PO-SD obrazac - kvartalno",
    description: "Rok za kvartalnu predaju PO-SD obrasca",
    dates: ["20.01", "20.04", "20.07", "20.10"],
    frequency: "quarterly" as const,
  },

  // Godišnji financijski izvještaji
  financialStatements: {
    name: "Godišnji financijski izvještaji",
    description: "Rok za predaju godišnjih financijskih izvještaja za d.o.o.",
    dates: ["30.04"], // Do kraja travnja za prethodnu godinu
    frequency: "annual" as const,
  },
} as const

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the next deadline date for a given deadline type
 */
export function getNextDeadline(
  deadline: { dates: string[]; frequency: string },
  fromDate: Date = new Date()
): Date {
  const year = fromDate.getFullYear()
  const month = fromDate.getMonth()
  const day = fromDate.getDate()

  for (const dateStr of deadline.dates) {
    let deadlineDate: Date

    if (deadline.frequency === "monthly") {
      // Format: "15" (day of month)
      const deadlineDay = parseInt(dateStr)
      deadlineDate = new Date(year, month, deadlineDay)
      if (deadlineDate <= fromDate) {
        deadlineDate = new Date(year, month + 1, deadlineDay)
      }
    } else {
      // Format: "31.01" (day.month)
      const [d, m] = dateStr.split(".").map(Number)
      deadlineDate = new Date(year, m - 1, d)
      if (deadlineDate <= fromDate) {
        deadlineDate = new Date(year + 1, m - 1, d)
      }
    }

    if (deadlineDate > fromDate) {
      return deadlineDate
    }
  }

  // If no future date found in current year, return first date of next year
  const [d, m] = deadline.dates[0].split(".").map(Number)
  if (deadline.frequency === "monthly") {
    return new Date(year, month + 1, parseInt(deadline.dates[0]))
  }
  return new Date(year + 1, (m || 1) - 1, d || parseInt(deadline.dates[0]))
}

/**
 * Get all upcoming deadlines within a given number of days
 */
export function getUpcomingDeadlines(
  withinDays: number = 30,
  fromDate: Date = new Date()
): Array<{ name: string; date: Date; description: string }> {
  const upcoming: Array<{ name: string; date: Date; description: string }> = []
  const endDate = new Date(fromDate)
  endDate.setDate(endDate.getDate() + withinDays)

  const allDeadlines = [
    DEADLINES.contributions.monthly,
    DEADLINES.pausalTax,
    DEADLINES.hok,
    DEADLINES.annualFiling.dohodak,
    DEADLINES.annualFiling.dobit,
    ADDITIONAL_DEADLINES.pdv.monthly,
    ADDITIONAL_DEADLINES.joppd,
  ]

  for (const deadline of allDeadlines) {
    const nextDate = getNextDeadline(deadline, fromDate)
    if (nextDate <= endDate) {
      upcoming.push({
        name: deadline.name,
        date: nextDate,
        description: deadline.description,
      })
    }
  }

  return upcoming.sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Format deadline date in Croatian format
 */
export function formatDeadlineDate(date: Date): string {
  return date.toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}
