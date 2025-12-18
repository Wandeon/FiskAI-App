// scripts/build-search-index.ts

import fs from "fs"
import path from "path"
import matter from "gray-matter"
import type { SearchEntry, SearchIndex } from "../src/lib/search/types"

const CONTENT_DIR = path.join(process.cwd(), "content")
const OUTPUT_PATH = path.join(process.cwd(), "public", "search-index.json")

// Quick actions - hardcoded for instant access
const QUICK_ACTIONS: SearchEntry[] = [
  {
    id: "action-calc-salary",
    type: "action",
    title: "Izračunaj neto plaću",
    description: "Bruto-neto kalkulator",
    keywords: ["plaća", "neto", "bruto", "kalkulator"],
    href: "/alati/bruto-neto",
    icon: "Calculator",
    shortcut: "⌘1",
  },
  {
    id: "action-check-pdv",
    type: "action",
    title: "Provjeri PDV prag",
    description: "Koliko ste blizu 60.000€ praga",
    keywords: ["pdv", "prag", "60000", "limit"],
    href: "/alati/pdv-kalkulator",
    icon: "TrendingUp",
    shortcut: "⌘2",
  },
  {
    id: "action-compare",
    type: "action",
    title: "Usporedi obrt vs d.o.o.",
    description: "Koja forma je bolja za vas",
    keywords: ["usporedba", "obrt", "doo", "firma"],
    href: "/usporedbe/firma",
    icon: "Scale",
    shortcut: "⌘3",
  },
  {
    id: "action-contributions",
    type: "action",
    title: "Izračunaj doprinose",
    description: "MIO, HZZO doprinosi",
    keywords: ["doprinosi", "mio", "hzzo", "kalkulator"],
    href: "/alati/kalkulator-doprinosa",
    icon: "Coins",
    shortcut: "⌘4",
  },
  {
    id: "action-posd",
    type: "action",
    title: "POSD kalkulator",
    description: "Porez na samostalnu djelatnost",
    keywords: ["posd", "porez", "dohodak", "kalkulator"],
    href: "/alati/posd-kalkulator",
    icon: "FileText",
    shortcut: "⌘5",
  },
]

// Tools from /alati page
const TOOLS: SearchEntry[] = [
  {
    id: "tool-doprinosi",
    type: "tool",
    title: "Kalkulator doprinosa",
    description: "Izračunajte mjesečne doprinose za MIO i HZZO",
    keywords: ["doprinosi", "mio", "hzzo", "kalkulator", "mjesečno"],
    href: "/alati/kalkulator-doprinosa",
    icon: "Calculator",
  },
  {
    id: "tool-porez",
    type: "tool",
    title: "Kalkulator poreza",
    description: "Izračunajte paušalni porez na temelju prihoda",
    keywords: ["porez", "paušal", "kalkulator", "prihod"],
    href: "/alati/kalkulator-poreza",
    icon: "BarChart3",
  },
  {
    id: "tool-pdv",
    type: "tool",
    title: "PDV prag (60.000€)",
    description: "Provjerite koliko ste blizu praga i kada postajete PDV obveznik",
    keywords: ["pdv", "prag", "60000", "obveznik", "limit"],
    href: "/alati/pdv-kalkulator",
    icon: "Scale",
  },
  {
    id: "tool-uplatnice",
    type: "tool",
    title: "Generator uplatnica",
    description: "Generirajte HUB3 barkod za uplate doprinosa i poreza",
    keywords: ["uplatnica", "hub3", "barkod", "uplata"],
    href: "/alati/uplatnice",
    icon: "CreditCard",
  },
  {
    id: "tool-kalendar",
    type: "tool",
    title: "Kalendar rokova",
    description: "Podsjetnik za važne rokove prijava i uplata",
    keywords: ["kalendar", "rok", "datum", "prijava", "uplata"],
    href: "/alati/kalendar",
    icon: "Calendar",
  },
  {
    id: "tool-oib",
    type: "tool",
    title: "OIB Validator",
    description: "Provjerite valjanost OIB-a",
    keywords: ["oib", "validator", "provjera", "identifikacijski"],
    href: "/alati/oib-validator",
    icon: "Shield",
  },
  {
    id: "tool-eracun",
    type: "tool",
    title: "E-Račun Generator",
    description: "Generirajte UBL 2.1 XML e-račune",
    keywords: ["e-račun", "eracun", "ubl", "xml", "faktura"],
    href: "/alati/e-racun",
    icon: "FileText",
  },
  {
    id: "tool-bruto-neto",
    type: "tool",
    title: "Bruto-neto kalkulator",
    description: "Izračunajte neto plaću iz bruto iznosa",
    keywords: ["bruto", "neto", "plaća", "kalkulator"],
    href: "/alati/bruto-neto",
    icon: "Calculator",
  },
  {
    id: "tool-posd",
    type: "tool",
    title: "POSD kalkulator",
    description: "Porez na samostalnu djelatnost za obrtnike",
    keywords: ["posd", "porez", "obrt", "dohodak"],
    href: "/alati/posd-kalkulator",
    icon: "FileText",
  },
]

// Navigation items (app sections)
const NAV_ITEMS: SearchEntry[] = [
  {
    id: "nav-dashboard",
    type: "nav",
    title: "Nadzorna ploča",
    description: "Pregled poslovanja",
    keywords: ["dashboard", "pregled", "nadzorna"],
    href: "/dashboard",
    icon: "LayoutDashboard",
  },
  {
    id: "nav-pos",
    type: "nav",
    title: "Blagajna",
    description: "POS sustav za izdavanje računa",
    keywords: ["blagajna", "pos", "račun", "kasa"],
    href: "/pos",
    icon: "ShoppingCart",
  },
  {
    id: "nav-documents",
    type: "nav",
    title: "Dokumenti",
    description: "Računi, e-računi, troškovi",
    keywords: ["dokumenti", "računi", "fakture", "troškovi"],
    href: "/documents",
    icon: "FileText",
  },
  {
    id: "nav-contacts",
    type: "nav",
    title: "Kontakti",
    description: "Kupci i dobavljači",
    keywords: ["kontakti", "kupci", "dobavljači", "partneri"],
    href: "/contacts",
    icon: "Users",
  },
  {
    id: "nav-products",
    type: "nav",
    title: "Proizvodi",
    description: "Katalog proizvoda i usluga",
    keywords: ["proizvodi", "usluge", "artikli", "katalog"],
    href: "/products",
    icon: "Package",
  },
  {
    id: "nav-settings",
    type: "nav",
    title: "Postavke",
    description: "Postavke računa i tvrtke",
    keywords: ["postavke", "settings", "konfiguracija"],
    href: "/settings",
    icon: "Settings",
  },
]

function scanMdxFiles(dir: string, type: SearchEntry["type"], hrefPrefix: string): SearchEntry[] {
  const entries: SearchEntry[] = []

  if (!fs.existsSync(dir)) {
    console.log(`[build-search-index] Directory not found: ${dir}`)
    return entries
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"))

  for (const file of files) {
    const filePath = path.join(dir, file)
    const content = fs.readFileSync(filePath, "utf-8")
    const { data: frontmatter } = matter(content)

    const slug = file.replace(".mdx", "")

    entries.push({
      id: `${type}-${slug}`,
      type,
      title: frontmatter.title || slug,
      description: frontmatter.description || "",
      keywords: [
        slug,
        ...(frontmatter.title?.toLowerCase().split(" ") || []),
        ...(frontmatter.keywords || []),
      ],
      href: `${hrefPrefix}/${slug}`,
      icon:
        type === "guide"
          ? "BookOpen"
          : type === "comparison"
            ? "Scale"
            : type === "how-to"
              ? "HelpCircle"
              : "FileText",
    })
  }

  return entries
}

async function buildIndex(): Promise<void> {
  console.log("[build-search-index] Building search index...")

  const entries: SearchEntry[] = [
    ...QUICK_ACTIONS,
    ...TOOLS,
    ...scanMdxFiles(path.join(CONTENT_DIR, "vodici"), "guide", "/vodic"),
    ...scanMdxFiles(path.join(CONTENT_DIR, "usporedbe"), "comparison", "/usporedbe"),
    ...scanMdxFiles(path.join(CONTENT_DIR, "kako-da"), "how-to", "/kako-da"),
    ...scanMdxFiles(path.join(CONTENT_DIR, "rjecnik"), "dictionary", "/rjecnik"),
    ...NAV_ITEMS,
  ]

  const index: SearchIndex = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    entries,
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2))

  console.log(`[build-search-index] Generated ${entries.length} entries`)
  console.log(`[build-search-index] Output: ${OUTPUT_PATH}`)
}

buildIndex().catch(console.error)
