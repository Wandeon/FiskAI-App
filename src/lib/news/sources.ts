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
  // General news portals for broader coverage (kept inactive by default to avoid noise)
  {
    id: "n1info",
    name: "N1 Info Hrvatska",
    url: "https://n1info.hr",
    feedType: "rss",
    feedUrl: "https://n1info.hr/feed/",
    isActive: false,
    fetchIntervalHours: 6,
  },
  {
    id: "index-hr",
    name: "Index.hr - Vijesti",
    url: "https://www.index.hr",
    feedType: "rss",
    feedUrl: "https://www.index.hr/rss/vijesti",
    isActive: false,
    fetchIntervalHours: 12,
  },
  {
    id: "vecernji-list",
    name: "Vecernji list",
    url: "https://www.vecernji.hr",
    feedType: "rss",
    feedUrl: "https://www.vecernji.hr/feeds/latest",
    isActive: false,
    fetchIntervalHours: 12,
  },
  // Official sources - using web scraping (no RSS available)
  {
    id: "porezna-uprava",
    name: "Porezna uprava Republike Hrvatske",
    url: "https://porezna-uprava.gov.hr",
    feedType: "scrape",
    scrapeSelector: ".news.box-border",
    isActive: true,
    fetchIntervalHours: 12,
  },
  {
    id: "narodne-novine",
    name: "Narodne novine - Službeni glasnik",
    url: "https://narodne-novine.nn.hr",
    feedType: "scrape",
    scrapeSelector: ".document-item",
    isActive: true,
    fetchIntervalHours: 6,
  },
  {
    id: "hgk",
    name: "Hrvatska gospodarska komora (HGK)",
    url: "https://www.hgk.hr",
    feedType: "scrape",
    scrapeSelector: ".news-card",
    isActive: true,
    fetchIntervalHours: 24,
  },
  {
    id: "fina",
    name: "FINA - Financijska agencija",
    url: "https://www.fina.hr",
    feedType: "scrape",
    scrapeSelector: ".news-item",
    isActive: true,
    fetchIntervalHours: 24,
  },
]
