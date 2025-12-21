// src/lib/regulatory-truth/data/sources.ts

export interface SourceDefinition {
  slug: string
  name: string
  url: string
  hierarchy: number // 1=Ustav, 2=Zakon, 3=Podzakonski, 4=Pravilnik, 5=Uputa, 6=Mišljenje, 7=Praksa
  fetchIntervalHours: number
  priority: "critical" | "high" | "medium" | "low"
  domains: string[] // pausalni, pdv, doprinosi, etc.
}

/**
 * Priority Croatian regulatory sources for FiskAI
 * Ordered by importance for paušalni obrt compliance
 */
export const REGULATORY_SOURCES: SourceDefinition[] = [
  // ==========================================================================
  // PRIORITY 1: Paušalni Core Sources
  // ==========================================================================
  {
    slug: "porezna-pausalno",
    name: "Porezna uprava - Paušalno oporezivanje",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/pausalno_oporezivanje.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "critical",
    domains: ["pausalni"],
  },
  {
    slug: "porezna-pausalno-obrtnici",
    name: "Porezna uprava - Paušalno oporezivanje obrtnika",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/porez_na_dohodak_pausalno_oporezivanje_obrtnika.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "critical",
    domains: ["pausalni"],
  },
  {
    slug: "narodne-novine-pausalni",
    name: "Narodne novine - Zakon o porezu na dohodak",
    url: "https://narodne-novine.nn.hr/clanci/sluzbeni/2016_12_115_2519.html",
    hierarchy: 2,
    fetchIntervalHours: 168, // Weekly
    priority: "critical",
    domains: ["pausalni", "porez_dohodak"],
  },

  // ==========================================================================
  // PRIORITY 2: Contributions (Doprinosi)
  // ==========================================================================
  {
    slug: "hzmo-doprinosi",
    name: "HZMO - Doprinosi za mirovinsko osiguranje",
    url: "https://www.mirovinsko.hr/hr/doprinosi/72",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "critical",
    domains: ["doprinosi"],
  },
  {
    slug: "hzzo-doprinosi",
    name: "HZZO - Doprinosi za zdravstveno osiguranje",
    url: "https://www.hzzo.hr/obvezno-osiguranje/",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "critical",
    domains: ["doprinosi"],
  },
  {
    slug: "porezna-doprinosi-stope",
    name: "Porezna uprava - Stope doprinosa",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/doprinosi.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "critical",
    domains: ["doprinosi"],
  },

  // ==========================================================================
  // PRIORITY 3: VAT (PDV)
  // ==========================================================================
  {
    slug: "porezna-pdv",
    name: "Porezna uprava - Porez na dodanu vrijednost",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/porez_na_dodanu_vrijednost.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["pdv"],
  },
  {
    slug: "porezna-pdv-stope",
    name: "Porezna uprava - Stope PDV-a",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/stope_poreza_na_dodanu_vrijednost.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["pdv"],
  },
  {
    slug: "porezna-pdv-prag",
    name: "Porezna uprava - Prag za upis u registar PDV-a",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/prag_za_upis_u_registar_obveznika_PDV.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "critical",
    domains: ["pdv", "pausalni"],
  },

  // ==========================================================================
  // PRIORITY 4: Fiscalization (Fiskalizacija)
  // ==========================================================================
  {
    slug: "porezna-fiskalizacija",
    name: "Porezna uprava - Fiskalizacija",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/fiskalizacija.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["fiskalizacija"],
  },
  {
    slug: "fina-fiskalizacija",
    name: "FINA - Fiskalizacija certifikati",
    url: "https://www.fina.hr/fiskalizacija",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["fiskalizacija"],
  },

  // ==========================================================================
  // PRIORITY 5: Deadlines (Rokovi)
  // ==========================================================================
  {
    slug: "porezna-rokovi",
    name: "Porezna uprava - Rokovi plaćanja",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/rokovi_placanja_poreza.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["rokovi"],
  },

  // ==========================================================================
  // PRIORITY 6: Chamber Fees (HOK)
  // ==========================================================================
  {
    slug: "hok-clanarina",
    name: "HOK - Članarina obrtnika",
    url: "https://www.hok.hr/clanarina",
    hierarchy: 7,
    fetchIntervalHours: 168, // Weekly
    priority: "medium",
    domains: ["pausalni"],
  },

  // ==========================================================================
  // PRIORITY 7: Income Tax (Porez na dohodak)
  // ==========================================================================
  {
    slug: "porezna-porez-dohodak",
    name: "Porezna uprava - Porez na dohodak",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/porez_na_dohodak.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["porez_dohodak"],
  },
  {
    slug: "porezna-osobni-odbitak",
    name: "Porezna uprava - Osobni odbitak",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/osobni_odbitak.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["porez_dohodak"],
  },

  // ==========================================================================
  // PRIORITY 8: Corporate Tax (Porez na dobit)
  // ==========================================================================
  {
    slug: "porezna-porez-dobit",
    name: "Porezna uprava - Porez na dobit",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/porez_na_dobit.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "low",
    domains: ["porez_dohodak"],
  },

  // ==========================================================================
  // PRIORITY 9: Minimum Wage & Employment
  // ==========================================================================
  {
    slug: "mrms-minimalna-placa",
    name: "MRMS - Minimalna plaća",
    url: "https://www.mrms.hr/minimalna-placa/",
    hierarchy: 4,
    fetchIntervalHours: 168, // Weekly
    priority: "medium",
    domains: ["doprinosi"],
  },

  // ==========================================================================
  // PRIORITY 10: EU Transactions
  // ==========================================================================
  {
    slug: "porezna-eu-promet",
    name: "Porezna uprava - Promet s EU",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/eu_promet.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["pdv", "pausalni"],
  },

  // ==========================================================================
  // PRIORITY 11: Additional Legal Sources
  // ==========================================================================
  {
    slug: "narodne-novine-doprinosi",
    name: "Narodne novine - Zakon o doprinosima",
    url: "https://narodne-novine.nn.hr/clanci/sluzbeni/2018_12_106_2088.html",
    hierarchy: 2, // Zakon
    fetchIntervalHours: 168, // Weekly
    priority: "high",
    domains: ["doprinosi"],
  },
  {
    slug: "porezna-prirez",
    name: "Porezna uprava - Prirez porezu na dohodak",
    url: "https://www.porezna-uprava.hr/HR_Porezni_sustav/Stranice/prirez_porezu_na_dohodak.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["porez_dohodak", "pausalni"],
  },
]

/**
 * Get sources by priority
 */
export function getSourcesByPriority(priority: SourceDefinition["priority"]): SourceDefinition[] {
  return REGULATORY_SOURCES.filter((s) => s.priority === priority)
}

/**
 * Get sources by domain
 */
export function getSourcesByDomain(domain: string): SourceDefinition[] {
  return REGULATORY_SOURCES.filter((s) => s.domains.includes(domain))
}

/**
 * Get critical sources (for hourly monitoring)
 */
export function getCriticalSources(): SourceDefinition[] {
  return REGULATORY_SOURCES.filter((s) => s.priority === "critical")
}
