import type { NewNewsSource } from "@/lib/db/schema"

export const newsSources: NewNewsSource[] = [
  {
    id: "porezna-uprava",
    name: "Porezna uprava Republike Hrvatske",
    url: "https://www.porezna-uprava.hr",
    feedType: "rss",
    feedUrl: "https://www.porezna-uprava.hr/rss/HR_porezna_rss.xml",
    isActive: true,
    fetchIntervalHours: 12,
  },
  {
    id: "narodne-novine",
    name: "Narodne novine - Službeni glasnik",
    url: "https://narodne-novine.nn.hr",
    feedType: "rss",
    feedUrl: "https://narodne-novine.nn.hr/rss.aspx",
    isActive: true,
    fetchIntervalHours: 6,
  },
  {
    id: "fina",
    name: "FINA - Financijska agencija",
    url: "https://www.fina.hr",
    feedType: "scrape",
    scrapeSelector: ".news-list .news-item",
    isActive: true,
    fetchIntervalHours: 24,
  },
  {
    id: "hgk",
    name: "Hrvatska gospodarska komora (HGK)",
    url: "https://www.hgk.hr",
    feedType: "rss",
    feedUrl: "https://www.hgk.hr/rss",
    isActive: true,
    fetchIntervalHours: 24,
  },
]
