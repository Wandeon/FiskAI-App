// src/lib/fiscal-data/data/chamber-fees.ts

import type { ChamberFeesData } from "../types"

/**
 * Chamber Fees and Tourist Board Contributions for Croatia 2025
 *
 * Sources:
 * - HOK: https://www.hok.hr/
 * - HTZ: https://www.htz.hr/
 */
export const CHAMBER_FEES: ChamberFeesData = {
  year: 2025,
  lastVerified: "2025-01-15",
  source: "https://www.hok.hr/",

  // ===========================================================================
  // HOK - HRVATSKA OBRTNIČKA KOMORA (Croatian Chamber of Crafts)
  // ===========================================================================
  hok: {
    monthly: 11.4, // EUR
    quarterly: 34.2, // EUR (11.40 * 3)
    annual: 136.8, // EUR (11.40 * 12)
    deadlines: ["27.02", "31.05", "31.08", "30.11"], // Quarterly payment dates
  },

  // ===========================================================================
  // TURISTIČKA ZAJEDNICA (Tourist Board) - Membership fees
  // Rates are percentage of total annual revenue
  // ===========================================================================
  tz: {
    groups: [
      {
        id: "group1",
        rate: 0.0014212, // 0.14212%
        description: "Turizam i ugostiteljstvo",
        activities: [
          "Hoteli i sličan smještaj",
          "Restorani i pokretni ugostiteljski objekti",
          "Pripremanje i usluživanje pića",
          "Putničke agencije i turoperatori",
        ],
      },
      {
        id: "group2",
        rate: 0.0011367, // 0.11367%
        description: "Trgovina i prijevoz",
        activities: [
          "Trgovina na veliko i malo",
          "Kopneni prijevoz",
          "Vodeni prijevoz",
          "Zračni prijevoz",
          "Skladištenje",
        ],
      },
      {
        id: "group3",
        rate: 0.0008527, // 0.08527%
        description: "Uslužne djelatnosti",
        activities: [
          "Pravne i računovodstvene djelatnosti",
          "Arhitektonske i inženjerske djelatnosti",
          "Oglašavanje i istraživanje tržišta",
          "Ostale stručne i tehničke djelatnosti",
          "IT usluge i programiranje",
        ],
      },
      {
        id: "group4",
        rate: 0.0002842, // 0.02842%
        description: "Proizvodne djelatnosti",
        activities: ["Prerađivačka industrija", "Građevinarstvo", "Opskrba električnom energijom"],
      },
      {
        id: "group5",
        rate: 0.0001705, // 0.01705%
        description: "Primarne djelatnosti",
        activities: ["Poljoprivreda", "Šumarstvo", "Ribarstvo", "Rudarstvo"],
      },
    ],
  },
} as const

// =============================================================================
// HGK - HRVATSKA GOSPODARSKA KOMORA (Croatian Chamber of Economy)
// For D.O.O. and larger businesses
// =============================================================================

export const HGK_FEES = {
  year: 2025,
  lastVerified: "2025-01-15",
  source: "https://www.hgk.hr/",

  // Fee categories based on total revenue
  categories: [
    {
      id: "micro",
      maxRevenue: 995421.06, // ~7.5M HRK
      monthlyFee: 42.47, // EUR
      annualFee: 509.64, // EUR
      description: "Mikro poduzetnici",
    },
    {
      id: "small",
      maxRevenue: 9954210.6, // ~75M HRK
      monthlyFee: 165.02, // EUR
      annualFee: 1980.24, // EUR
      description: "Mali poduzetnici",
    },
    {
      id: "medium",
      maxRevenue: 39816842.4, // ~300M HRK
      monthlyFee: 496.4, // EUR
      annualFee: 5956.8, // EUR
      description: "Srednji poduzetnici",
    },
    {
      id: "large",
      maxRevenue: Infinity,
      monthlyFee: 1324.47, // EUR
      annualFee: 15893.64, // EUR
      description: "Veliki poduzetnici",
    },
  ],
} as const

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate annual HOK fee
 */
export function calculateAnnualHOKFee(): number {
  return CHAMBER_FEES.hok.annual
}

/**
 * Calculate quarterly HOK fee
 */
export function calculateQuarterlyHOKFee(): number {
  return CHAMBER_FEES.hok.quarterly
}

/**
 * Get TZ rate for a given activity/NKD code
 */
export function getTZRate(groupId: string): number {
  const group = CHAMBER_FEES.tz.groups.find((g) => g.id === groupId)
  return group?.rate || CHAMBER_FEES.tz.groups[2].rate // Default to group 3 (services)
}

/**
 * Calculate annual TZ contribution based on revenue and activity group
 */
export function calculateTZContribution(annualRevenue: number, groupId: string = "group3"): number {
  const rate = getTZRate(groupId)
  return Math.round(annualRevenue * rate * 100) / 100
}

/**
 * Get HGK fee category based on revenue
 */
export function getHGKCategory(annualRevenue: number) {
  return (
    HGK_FEES.categories.find((cat) => annualRevenue <= cat.maxRevenue) ||
    HGK_FEES.categories[HGK_FEES.categories.length - 1]
  )
}

/**
 * Calculate annual HGK fee based on revenue
 */
export function calculateHGKFee(annualRevenue: number): number {
  const category = getHGKCategory(annualRevenue)
  return category.annualFee
}

/**
 * Get next HOK payment deadline
 */
export function getNextHOKDeadline(fromDate: Date = new Date()): Date {
  const year = fromDate.getFullYear()

  for (const dateStr of CHAMBER_FEES.hok.deadlines) {
    const [day, month] = dateStr.split(".").map(Number)
    const deadline = new Date(year, month - 1, day)

    if (deadline > fromDate) {
      return deadline
    }
  }

  // Return first deadline of next year
  const [day, month] = CHAMBER_FEES.hok.deadlines[0].split(".").map(Number)
  return new Date(year + 1, month - 1, day)
}

/**
 * Get TZ group by NKD code (simplified mapping)
 */
export function getTZGroupByNKD(nkdCode: string): string {
  const prefix = nkdCode.substring(0, 2)

  // Tourism & hospitality
  if (["55", "56", "79"].includes(prefix)) return "group1"

  // Trade & transport
  if (["45", "46", "47", "49", "50", "51", "52"].includes(prefix)) return "group2"

  // Services
  if (["62", "63", "69", "70", "71", "72", "73", "74"].includes(prefix)) return "group3"

  // Manufacturing & construction
  if (
    [
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
      "24",
      "25",
      "26",
      "27",
      "28",
      "29",
      "30",
      "31",
      "32",
      "33",
      "41",
      "42",
      "43",
    ].includes(prefix)
  )
    return "group4"

  // Primary
  if (["01", "02", "03", "05", "06", "07", "08", "09"].includes(prefix)) return "group5"

  // Default to services
  return "group3"
}
