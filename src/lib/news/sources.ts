import type { NewNewsSource } from "@/lib/db/schema"

export const newsSources: NewNewsSource[] = [
  // Government sources - most relevant for fiscal policy
  {
    id: "vlada-rh",
    name: "Vlada Republike Hrvatske",
    url: "https://vlada.gov.hr",
    feedType: "rss",
    feedUrl: "https://vlada.gov.hr/rss.aspx?ID=8",
    isActive: true,
    fetchIntervalHours: 6,
  },
  // Business/Finance news - highly relevant for tax topics
  {
    id: "poslovni-dnevnik",
    name: "Poslovni Dnevnik",
    url: "https://www.poslovni.hr",
    feedType: "rss",
    feedUrl: "https://www.poslovni.hr/feed",
    isActive: true,
    fetchIntervalHours: 6,
  },
  // General news portals for broader coverage
  {
    id: "n1info",
    name: "N1 Info Hrvatska",
    url: "https://n1info.hr",
    feedType: "rss",
    feedUrl: "https://n1info.hr/feed/",
    isActive: true,
    fetchIntervalHours: 6,
  },
  {
    id: "index-hr",
    name: "Index.hr - Vijesti",
    url: "https://www.index.hr",
    feedType: "rss",
    feedUrl: "https://www.index.hr/rss/vijesti",
    isActive: true,
    fetchIntervalHours: 12,
  },
  {
    id: "vecernji-list",
    name: "Vecernji list",
    url: "https://www.vecernji.hr",
    feedType: "rss",
    feedUrl: "https://www.vecernji.hr/feeds/latest",
    isActive: true,
    fetchIntervalHours: 12,
  },
  // Original sources - kept inactive until feeds are fixed
  {
    id: "porezna-uprava",
    name: "Porezna uprava Republike Hrvatske",
    url: "https://www.porezna-uprava.hr",
    feedType: "rss",
    feedUrl: "https://www.porezna-uprava.hr/rss/HR_porezna_rss.xml",
    isActive: false, // Feed has invalid XML
    fetchIntervalHours: 12,
  },
  {
    id: "narodne-novine",
    name: "Narodne novine - Sluzbeni glasnik",
    url: "https://narodne-novine.nn.hr",
    feedType: "rss",
    feedUrl: "https://narodne-novine.nn.hr/rss.aspx",
    isActive: false, // Returns 404
    fetchIntervalHours: 6,
  },
  {
    id: "hgk",
    name: "Hrvatska gospodarska komora (HGK)",
    url: "https://www.hgk.hr",
    feedType: "rss",
    feedUrl: "https://www.hgk.hr/rss",
    isActive: false, // Atom format not supported
    fetchIntervalHours: 24,
  },
  {
    id: "fina",
    name: "FINA - Financijska agencija",
    url: "https://www.fina.hr",
    feedType: "scrape",
    scrapeSelector: ".news-list .news-item",
    isActive: false, // Web scraping not implemented
    fetchIntervalHours: 24,
  },
]
