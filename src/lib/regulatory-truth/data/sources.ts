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
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/pausalno_oporezivanje.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "critical",
    domains: ["pausalni"],
  },
  {
    slug: "porezna-pausalno-obrtnici",
    name: "Porezna uprava - Paušalno oporezivanje obrtnika",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/porez_na_dohodak_pausalno_oporezivanje_obrtnika.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "critical",
    domains: ["pausalni"],
  },
  {
    slug: "narodne-novine-pausalni",
    name: "Narodne novine - Zakon o porezu na dohodak",
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2016/115/2519",
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
    url: "https://hzzo.hr/obvezno-osiguranje/",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "critical",
    domains: ["doprinosi"],
  },
  {
    slug: "porezna-doprinosi-stope",
    name: "Porezna uprava - Stope doprinosa",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/doprinosi.aspx",
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
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/porez_na_dodanu_vrijednost.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["pdv"],
  },
  {
    slug: "porezna-pdv-stope",
    name: "Porezna uprava - Stope PDV-a",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/stope_poreza_na_dodanu_vrijednost.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["pdv"],
  },
  {
    slug: "porezna-pdv-prag",
    name: "Porezna uprava - Prag za upis u registar PDV-a",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/prag_za_upis_u_registar_obveznika_PDV.aspx",
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
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/fiskalizacija.aspx",
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
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/rokovi_placanja_poreza.aspx",
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
    priority: "high",
    domains: ["pausalni"],
  },

  // ==========================================================================
  // PRIORITY 7: Income Tax (Porez na dohodak)
  // ==========================================================================
  {
    slug: "porezna-porez-dohodak",
    name: "Porezna uprava - Porez na dohodak",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/porez_na_dohodak.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["porez_dohodak"],
  },
  {
    slug: "porezna-osobni-odbitak",
    name: "Porezna uprava - Osobni odbitak",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/osobni_odbitak.aspx",
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
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/porez_na_dobit.aspx",
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
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/eu_promet.aspx",
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
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2018/106/2088",
    hierarchy: 2, // Zakon
    fetchIntervalHours: 168, // Weekly
    priority: "high",
    domains: ["doprinosi"],
  },
  {
    slug: "porezna-prirez",
    name: "Porezna uprava - Prirez porezu na dohodak",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/prirez_porezu_na_dohodak.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["porez_dohodak", "pausalni"],
  },

  // ==========================================================================
  // PRIORITY 12: Additional Laws (Narodne novine)
  // ==========================================================================
  {
    slug: "nn-zakon-pdv",
    name: "Narodne novine - Zakon o porezu na dodanu vrijednost",
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2012/73/1715",
    hierarchy: 2,
    fetchIntervalHours: 168,
    priority: "critical",
    domains: ["pdv"],
  },
  {
    slug: "nn-zakon-fiskalizacija",
    name: "Narodne novine - Zakon o fiskalizaciji u prometu gotovinom",
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2012/133/2833",
    hierarchy: 2,
    fetchIntervalHours: 168,
    priority: "high",
    domains: ["fiskalizacija"],
  },
  {
    slug: "nn-zakon-racunovodstvo",
    name: "Narodne novine - Zakon o računovodstvu",
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2015/78/1493",
    hierarchy: 2,
    fetchIntervalHours: 168,
    priority: "medium",
    domains: ["obrasci"],
  },
  {
    slug: "nn-zakon-obrtu",
    name: "Narodne novine - Zakon o obrtu",
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2013/143/3065",
    hierarchy: 2,
    fetchIntervalHours: 168,
    priority: "high",
    domains: ["pausalni"],
  },
  {
    slug: "nn-opci-porezni-zakon",
    name: "Narodne novine - Opći porezni zakon",
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2017/115/2629",
    hierarchy: 2,
    fetchIntervalHours: 168,
    priority: "high",
    domains: ["pausalni", "pdv", "porez_dohodak"],
  },
  {
    slug: "nn-zakon-mirovinsko",
    name: "Narodne novine - Zakon o mirovinskom osiguranju",
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2018/115/2262",
    hierarchy: 2,
    fetchIntervalHours: 168,
    priority: "high",
    domains: ["doprinosi"],
  },
  {
    slug: "nn-zakon-zdravstveno",
    name: "Narodne novine - Zakon o obveznom zdravstvenom osiguranju",
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2013/80/1669",
    hierarchy: 2,
    fetchIntervalHours: 168,
    priority: "high",
    domains: ["doprinosi"],
  },

  // ==========================================================================
  // PRIORITY 13: Additional Porezna uprava Pages
  // ==========================================================================
  {
    slug: "porezna-porezne-kartice",
    name: "Porezna uprava - Porezne kartice",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/porezne_kartice.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["porez_dohodak"],
  },
  {
    slug: "porezna-posebni-porezi",
    name: "Porezna uprava - Posebni porezi",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/posebni_porezi.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "low",
    domains: ["pdv"],
  },
  {
    slug: "porezna-porezna-osnovica",
    name: "Porezna uprava - Porezna osnovica",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/porezna_osnovica.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["porez_dohodak", "pausalni"],
  },
  {
    slug: "porezna-predujam",
    name: "Porezna uprava - Predujam poreza",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/predujam_poreza.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["porez_dohodak"],
  },
  {
    slug: "porezna-godisnja-prijava",
    name: "Porezna uprava - Godišnja porezna prijava",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/godisnja_porezna_prijava.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["porez_dohodak", "obrasci"],
  },
  {
    slug: "porezna-joppd",
    name: "Porezna uprava - JOPPD obrazac",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/joppd.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["obrasci", "doprinosi"],
  },
  {
    slug: "porezna-eporezna",
    name: "Porezna uprava - ePorezna",
    url: "https://porezna-uprava.gov.hr/Stranice/ePorezna.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["obrasci"],
  },
  {
    slug: "porezna-obrasci",
    name: "Porezna uprava - Obrasci",
    url: "https://porezna-uprava.gov.hr/HR_obrasci/Stranice/Obrasci.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["obrasci"],
  },

  // ==========================================================================
  // PRIORITY 14: FINA Services
  // ==========================================================================
  {
    slug: "fina-eracun",
    name: "FINA - eRačun",
    url: "https://www.fina.hr/e-racun",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["fiskalizacija"],
  },
  {
    slug: "fina-bop",
    name: "FINA - Jedinstveni registar računa",
    url: "https://www.fina.hr/jedinstveni-registar-racuna",
    hierarchy: 5,
    fetchIntervalHours: 168,
    priority: "medium",
    domains: ["obrasci"],
  },
  {
    slug: "fina-oib",
    name: "FINA - OIB",
    url: "https://www.fina.hr/oib",
    hierarchy: 5,
    fetchIntervalHours: 168,
    priority: "medium",
    domains: ["obrasci"],
  },

  // ==========================================================================
  // PRIORITY 15: HNB (Croatian National Bank)
  // ==========================================================================
  {
    slug: "hnb-tecajevi",
    name: "HNB - Tečajna lista",
    url: "https://www.hnb.hr/temeljne-funkcije/monetarna-politika/tecajna-lista",
    hierarchy: 5,
    fetchIntervalHours: 4, // Every 4 hours for exchange rates
    priority: "critical",
    domains: ["pdv", "pausalni"],
  },
  {
    slug: "hnb-euro-konverzija",
    name: "HNB - Euro konverzija",
    url: "https://www.hnb.hr/o-nama/euro/konverzija",
    hierarchy: 5,
    fetchIntervalHours: 168,
    priority: "medium",
    domains: ["pdv", "pausalni"],
  },

  // ==========================================================================
  // PRIORITY 16: Ministry of Finance
  // ==========================================================================
  {
    slug: "mfin-porezni-sustav",
    name: "Ministarstvo financija - Porezni sustav",
    url: "https://mfin.gov.hr/istaknute-teme/porezi/porezni-sustav-128/128",
    hierarchy: 4,
    fetchIntervalHours: 168,
    priority: "medium",
    domains: ["pausalni", "pdv", "porez_dohodak"],
  },
  {
    slug: "mfin-proracun",
    name: "Ministarstvo financija - Državni proračun",
    url: "https://mfin.gov.hr/proracun-86/86",
    hierarchy: 4,
    fetchIntervalHours: 168,
    priority: "low",
    domains: ["rokovi"],
  },

  // ==========================================================================
  // PRIORITY 17: Chamber Sources (HOK, HGK)
  // ==========================================================================
  {
    slug: "hok-obrtnici",
    name: "HOK - Portal za obrtnike",
    url: "https://www.hok.hr/",
    hierarchy: 7,
    fetchIntervalHours: 168,
    priority: "medium",
    domains: ["pausalni"],
  },
  {
    slug: "hok-registar",
    name: "HOK - Obrtni registar",
    url: "https://www.hok.hr/obrtni-registar",
    hierarchy: 7,
    fetchIntervalHours: 168,
    priority: "medium",
    domains: ["pausalni"],
  },
  {
    slug: "hgk-pravni-okvir",
    name: "HGK - Pravni okvir",
    url: "https://www.hgk.hr/",
    hierarchy: 7,
    fetchIntervalHours: 168,
    priority: "low",
    domains: ["pausalni"],
  },

  // ==========================================================================
  // PRIORITY 18: DZS (Statistics)
  // ==========================================================================
  {
    slug: "dzs-place",
    name: "DZS - Prosječne plaće",
    url: "https://dzs.hr/hr/statistika/trziste-rada",
    hierarchy: 5,
    fetchIntervalHours: 168,
    priority: "medium",
    domains: ["doprinosi"],
  },
  {
    slug: "dzs-publikacije",
    name: "DZS - Statistički podaci i publikacije",
    url: "https://dzs.hr/hr/publikacije",
    hierarchy: 5,
    fetchIntervalHours: 168,
    priority: "medium",
    domains: ["doprinosi", "pausalni"],
  },

  // ==========================================================================
  // PRIORITY 19: Additional PDV Sources
  // ==========================================================================
  {
    slug: "porezna-pdv-prijava",
    name: "Porezna uprava - PDV prijava",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/pdv_prijava.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["pdv", "obrasci"],
  },
  {
    slug: "porezna-pdv-oslobodjenja",
    name: "Porezna uprava - PDV oslobođenja",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/pdv_oslobodjenja.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["pdv"],
  },
  {
    slug: "porezna-pdv-povrat",
    name: "Porezna uprava - Povrat PDV-a",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/povrat_pdv.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["pdv"],
  },

  // ==========================================================================
  // PRIORITY 20: Regulations (Pravilnici)
  // ==========================================================================
  {
    slug: "nn-pravilnik-pdv",
    name: "Narodne novine - Pravilnik o PDV-u",
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2013/79/1633",
    hierarchy: 4,
    fetchIntervalHours: 168,
    priority: "high",
    domains: ["pdv"],
  },
  {
    slug: "nn-pravilnik-dohodak",
    name: "Narodne novine - Pravilnik o porezu na dohodak",
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2017/10/247",
    hierarchy: 4,
    fetchIntervalHours: 168,
    priority: "high",
    domains: ["porez_dohodak", "pausalni"],
  },
  {
    slug: "nn-pravilnik-fiskalizacija",
    name: "Narodne novine - Pravilnik o fiskalizaciji",
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2012/146/3131",
    hierarchy: 4,
    fetchIntervalHours: 168,
    priority: "high",
    domains: ["fiskalizacija"],
  },
  {
    slug: "nn-pravilnik-doprinosi",
    name: "Narodne novine - Pravilnik o doprinosima",
    url: "https://narodne-novine.nn.hr/eli/sluzbeni/2009/2/44",
    hierarchy: 4,
    fetchIntervalHours: 168,
    priority: "high",
    domains: ["doprinosi"],
  },

  // ==========================================================================
  // PRIORITY 21: Official Interpretations
  // ==========================================================================
  {
    slug: "porezna-misljenja",
    name: "Porezna uprava - Mišljenja i upute",
    url: "https://porezna-uprava.gov.hr/HR_publikacije/Stranice/Misljenja_Upute.aspx",
    hierarchy: 6,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["pausalni", "pdv", "porez_dohodak"],
  },
  {
    slug: "porezna-tumacenja",
    name: "Porezna uprava - Tumačenja propisa",
    url: "https://porezna-uprava.gov.hr/HR_publikacije/Stranice/Tumacenja_propisa.aspx",
    hierarchy: 6,
    fetchIntervalHours: 24,
    priority: "medium",
    domains: ["pausalni", "pdv", "porez_dohodak"],
  },

  // ==========================================================================
  // PRIORITY 22: EU Sources (affecting Croatian law)
  // ==========================================================================
  {
    slug: "eu-vat-directive",
    name: "EU - VAT Directive 2006/112/EC",
    url: "https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX:32006L0112",
    hierarchy: 1, // EU law above national
    fetchIntervalHours: 336, // Bi-weekly
    priority: "medium",
    domains: ["pdv"],
  },

  // ==========================================================================
  // PRIORITY 23: Additional Contribution Sources
  // ==========================================================================
  {
    slug: "hzmo-osnovica",
    name: "HZMO - Osnovica za obračun doprinosa",
    url: "https://www.mirovinsko.hr/hr/osnovice-za-obracun-doprinosa/188",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "critical",
    domains: ["doprinosi"],
  },
  {
    slug: "hzmo-staze",
    name: "HZMO - Staž osiguranja",
    url: "https://www.mirovinsko.hr/hr/staz-osiguranja/60",
    hierarchy: 5,
    fetchIntervalHours: 168,
    priority: "medium",
    domains: ["doprinosi"],
  },
  {
    slug: "hzzo-osnovica",
    name: "HZZO - Osnovica za obračun doprinosa",
    url: "https://hzzo.hr/osnovica-za-obracun-doprinosa/",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "critical",
    domains: ["doprinosi"],
  },

  // ==========================================================================
  // PRIORITY 24: Deadlines and Calendar
  // ==========================================================================
  {
    slug: "porezna-kalendar",
    name: "Porezna uprava - Porezni kalendar",
    url: "https://porezna-uprava.gov.hr/HR_publikacije/Stranice/Porezni_kalendar.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "critical",
    domains: ["rokovi"],
  },
  {
    slug: "porezna-zatezne-kamate",
    name: "Porezna uprava - Zatezne kamate",
    url: "https://porezna-uprava.gov.hr/HR_Porezni_sustav/Stranice/zatezne_kamate.aspx",
    hierarchy: 5,
    fetchIntervalHours: 24,
    priority: "high",
    domains: ["rokovi"],
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
