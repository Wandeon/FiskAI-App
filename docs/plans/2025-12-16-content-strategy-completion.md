# Content Strategy Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete remaining items from FiskAI Content Strategy to achieve SEO and AI-search dominance

**Architecture:** News frontend displays AI-processed news from DB. Editorial pages are static MDX. llms.txt points crawlers to canonical content. WebApplication schema enhances tool discoverability.

**Tech Stack:** Next.js 15, MDX, Drizzle ORM, PostgreSQL, DeepSeek/Ollama AI, Schema.org JSON-LD

---

## Status Summary

### Already Completed (Phase 1-5)

- [x] 50 glossary terms (`/rjecnik`)
- [x] 6 guides with FAQ/Sources (`/vodic`)
- [x] 4 how-to guides (`/kako-da`)
- [x] 4 comparisons with FAQ/Sources (`/usporedba`)
- [x] Fiskalizacija hub page
- [x] FAQ component with schema
- [x] Sources component with E-E-A-T signals
- [x] News backend (API, DB schema, AI processor)

### Remaining Items (This Plan)

- [ ] Task 1: News frontend (`/vijesti`)
- [ ] Task 2: News infrastructure (migration + seed + cron)
- [ ] Task 3: Editorial policy pages
- [ ] Task 4: llms.txt file
- [ ] Task 5: WebApplication schema on tools
- [ ] Task 6: Hub/satellite internal linking audit

---

## Task 1: News Frontend Page

**Files:**

- Create: `src/app/(marketing)/vijesti/page.tsx`
- Create: `src/components/news/NewsList.tsx`
- Create: `src/components/news/NewsCard.tsx`

### Step 1: Create NewsCard component

```tsx
// src/components/news/NewsCard.tsx
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { hr } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface NewsCardProps {
  title: string
  summary: string
  categories: string[]
  publishedAt: Date
  sourceUrl: string
  relevanceScore?: number
}

const categoryLabels: Record<string, string> = {
  tax: "Porezi",
  vat: "PDV",
  payroll: "Plaće",
  compliance: "Usklađenost",
  reporting: "Izvještavanje",
  legislation: "Zakonodavstvo",
  business: "Poslovanje",
  finance: "Financije",
}

export function NewsCard({
  title,
  summary,
  categories,
  publishedAt,
  sourceUrl,
  relevanceScore,
}: NewsCardProps) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/5 p-6 transition-colors hover:bg-white/10">
      <div className="mb-3 flex flex-wrap gap-2">
        {categories.slice(0, 3).map((cat) => (
          <span
            key={cat}
            className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300"
          >
            {categoryLabels[cat] || cat}
          </span>
        ))}
        {relevanceScore && relevanceScore >= 70 && (
          <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-300">
            Važno
          </span>
        )}
      </div>

      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mb-4 text-sm text-white/70">{summary}</p>

      <div className="flex items-center justify-between text-xs text-white/50">
        <time dateTime={publishedAt.toISOString()}>
          {formatDistanceToNow(publishedAt, { addSuffix: true, locale: hr })}
        </time>
        <Link
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300"
        >
          Izvor →
        </Link>
      </div>
    </article>
  )
}
```

### Step 2: Create NewsList component

```tsx
// src/components/news/NewsList.tsx
"use client"

import { useState, useEffect } from "react"
import { NewsCard } from "./NewsCard"
import { Loader2 } from "lucide-react"

interface NewsItem {
  id: string
  title: string
  summaryHr: string
  categories: string[]
  publishedAt: string
  url: string
  relevanceScore: number
}

const categoryFilters = [
  { value: "", label: "Sve vijesti" },
  { value: "tax", label: "Porezi" },
  { value: "vat", label: "PDV" },
  { value: "legislation", label: "Zakonodavstvo" },
  { value: "compliance", label: "Usklađenost" },
]

export function NewsList() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState("")

  useEffect(() => {
    async function fetchNews() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ limit: "20" })
        if (category) params.set("category", category)

        const res = await fetch(`/api/news?${params}`)
        const data = await res.json()
        setNews(data.news || [])
      } catch (error) {
        console.error("Error fetching news:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [category])

  return (
    <div>
      {/* Category Filters */}
      <div className="mb-8 flex flex-wrap gap-2">
        {categoryFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setCategory(filter.value)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              category === filter.value
                ? "bg-blue-500 text-white"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* News Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : news.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-white/60">Nema vijesti za prikaz.</p>
          <p className="mt-2 text-sm text-white/40">
            Vijesti će biti dostupne uskoro nakon što se pokrene automatsko prikupljanje.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {news.map((item) => (
            <NewsCard
              key={item.id}
              title={item.title}
              summary={item.summaryHr || "Sažetak u pripremi..."}
              categories={item.categories as string[]}
              publishedAt={new Date(item.publishedAt)}
              sourceUrl={item.url}
              relevanceScore={item.relevanceScore}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
```

### Step 3: Create vijesti page

```tsx
// src/app/(marketing)/vijesti/page.tsx
import { Metadata } from "next"
import { NewsList } from "@/components/news/NewsList"
import { Newspaper } from "lucide-react"

export const metadata: Metadata = {
  title: "Porezne Vijesti | FiskAI",
  description:
    "Najnovije vijesti iz Porezne uprave, Narodnih novina i FINA-e za hrvatske poduzetnike. Automatizirani sažeci relevantni za vaše poslovanje.",
  keywords: ["porezne vijesti", "porezna uprava", "narodne novine", "FINA", "hrvatska"],
}

export default function VijestiPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
          <Newspaper className="h-4 w-4" />
          Automatizirano praćenje izvora
        </div>
        <h1 className="mb-4 text-4xl font-bold text-white">Porezne Vijesti</h1>
        <p className="mx-auto max-w-2xl text-lg text-white/60">
          Pratimo Poreznu upravu, Narodne novine, FINA-u i HGK. AI automatski filtrira i sažima
          vijesti relevantne za hrvatske poduzetnike.
        </p>
      </div>

      {/* News List */}
      <NewsList />

      {/* Sources Footer */}
      <div className="mt-12 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Izvori vijesti</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <SourceCard name="Porezna uprava" url="https://www.porezna-uprava.hr" />
          <SourceCard name="Narodne novine" url="https://narodne-novine.nn.hr" />
          <SourceCard name="FINA" url="https://www.fina.hr" />
          <SourceCard name="HGK" url="https://www.hgk.hr" />
        </div>
      </div>
    </div>
  )
}

function SourceCard({ name, url }: { name: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg bg-white/5 p-4 text-center transition-colors hover:bg-white/10"
    >
      <p className="font-medium text-white">{name}</p>
      <p className="text-xs text-white/50">{new URL(url).hostname}</p>
    </a>
  )
}
```

### Step 4: Export news components

```bash
mkdir -p /home/admin/FiskAI/src/components/news
# Components will be created in steps 1-2
```

### Step 5: Add vijesti to navigation

Modify `src/components/layout/Header.tsx` to add Vijesti link in nav.

### Step 6: Verify page renders

Run: `npm run dev`
Visit: `http://localhost:3000/vijesti`
Expected: Page loads with empty state or placeholder

### Step 7: Commit

```bash
git add src/app/\(marketing\)/vijesti src/components/news
git commit -m "feat: add vijesti (news) page with category filters"
```

---

## Task 2: News Infrastructure Setup

**Files:**

- Modify: `drizzle.config.ts` (verify)
- Run: Database migration
- Run: Seed script

### Step 1: Check if news tables exist in migration

```bash
grep -r "news_sources\|news_items" /home/admin/FiskAI/drizzle/
```

### Step 2: Generate migration if needed

Run: `npx drizzle-kit generate`

### Step 3: Run migration

Run: `npx drizzle-kit migrate`

### Step 4: Seed news sources

Run: `npx tsx scripts/seed-news-sources.ts`

### Step 5: Test API endpoint

```bash
curl http://localhost:3000/api/news/latest
```

Expected: JSON response (empty array is OK)

### Step 6: Document cron setup for Coolify

Create file documenting how to set up cron:

```markdown
# News Cron Setup (Coolify)

1. In Coolify, go to Settings > Scheduled Tasks
2. Add new task:
   - Name: fetch-news
   - Schedule: 0 _/6 _ \* \* (every 6 hours)
   - Command: curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/fetch-news
3. Ensure CRON_SECRET is set in environment variables
```

### Step 7: Commit

```bash
git add .
git commit -m "feat: news infrastructure - migration, seed, cron docs"
```

---

## Task 3: Editorial Policy Pages

**Files:**

- Create: `content/stranice/metodologija.mdx`
- Create: `content/stranice/urednicka-politika.mdx`
- Create: `content/stranice/izvori.mdx`
- Create: `src/app/(marketing)/metodologija/page.tsx`
- Create: `src/app/(marketing)/urednicka-politika/page.tsx`
- Create: `src/app/(marketing)/izvori/page.tsx`

### Step 1: Create metodologija page

```tsx
// src/app/(marketing)/metodologija/page.tsx
import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Metodologija | FiskAI",
  description:
    "Kako FiskAI izračunava poreze, doprinose i druge pokazatelje. Transparentne formule i pretpostavke.",
}

export default function MetodologijaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-4xl font-bold text-white">Metodologija</h1>

      <div className="prose prose-invert max-w-none">
        <p className="lead">
          Ovdje objašnjavamo kako FiskAI izračunava poreze, doprinose i druge financijske
          pokazatelje. Transparentnost je ključna za povjerenje.
        </p>

        <h2>Kalkulatori doprinosa</h2>
        <p>Kalkulatori koriste službene stope objavljene u Narodnim novinama. Za 2025. godinu:</p>
        <ul>
          <li>MIO I. stup: 15% na bruto</li>
          <li>MIO II. stup: 5% na bruto</li>
          <li>Zdravstveno (HZZO): 16,5% na bruto</li>
        </ul>
        <p>Minimalna osnovica za 2025. iznosi 700,00 EUR mjesečno.</p>

        <h2>Paušalni obrt</h2>
        <p>Izračuni za paušalni obrt temelje se na propisanim stopama:</p>
        <ul>
          <li>Porez na dohodak: 10% na paušalnu osnovicu</li>
          <li>Prirez: ovisi o općini/gradu prebivališta</li>
          <li>Doprinosi: fiksni iznos prema razredu prihoda</li>
        </ul>

        <h2>PDV kalkulator</h2>
        <p>PDV stope u Hrvatskoj (2025.):</p>
        <ul>
          <li>Opća stopa: 25%</li>
          <li>Snižena stopa: 13% (ugostiteljstvo, turizam)</li>
          <li>Najniža stopa: 5% (lijekovi, knjige)</li>
        </ul>

        <h2>Pretpostavke</h2>
        <p>Svi izračuni pretpostavljaju:</p>
        <ul>
          <li>Porezni rezident RH</li>
          <li>Standardni osobni odbitak (560 EUR/mj)</li>
          <li>Bez dodatnih olakšica osim ako su navedene</li>
        </ul>

        <h2>Ažuriranje</h2>
        <p>
          Kalkulatore ažuriramo unutar 7 dana od objave novih propisa u Narodnim novinama. Datum
          posljednjeg ažuriranja prikazan je na svakom alatu.
        </p>

        <div className="mt-8 rounded-lg bg-amber-500/10 p-4 text-amber-200">
          <strong>Napomena:</strong> FiskAI pruža informativne izračune. Za službene potrebe
          konzultirajte ovlaštenog poreznog savjetnika ili računovođu.
        </div>
      </div>

      <div className="mt-8">
        <Link href="/izvori" className="text-blue-400 hover:text-blue-300">
          Pogledaj sve službene izvore →
        </Link>
      </div>
    </div>
  )
}
```

### Step 2: Create urednicka-politika page

```tsx
// src/app/(marketing)/urednicka-politika/page.tsx
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Urednička politika | FiskAI",
  description: "Kako FiskAI održava točnost sadržaja, učestalost pregleda i proces ispravaka.",
}

export default function UrednickaPoltikaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-4xl font-bold text-white">Urednička politika</h1>

      <div className="prose prose-invert max-w-none">
        <p className="lead">
          FiskAI je posvećen pružanju točnih, ažurnih i pouzdanih informacija za hrvatske
          poduzetnike.
        </p>

        <h2>Učestalost pregleda</h2>
        <ul>
          <li>
            <strong>Hub stranice:</strong> Kvartalni pregled
          </li>
          <li>
            <strong>Satelitske stranice:</strong> Godišnji pregled
          </li>
          <li>
            <strong>Kalkulatori:</strong> Pregled pri svakoj promjeni propisa
          </li>
          <li>
            <strong>Rokovi:</strong> Mjesečno ažuriranje
          </li>
        </ul>

        <h2>Okidači za ažuriranje</h2>
        <p>Sadržaj se odmah ažurira kada:</p>
        <ul>
          <li>Narodne novine objave nove ili izmijenjene propise</li>
          <li>Porezna uprava objavi nove upute ili tumačenja</li>
          <li>Promijene se porezne stope ili pragovi</li>
          <li>Korisnik prijavi netočnost</li>
        </ul>

        <h2>Proces ispravaka</h2>
        <ol>
          <li>Korisnik ili tim identificira grešku</li>
          <li>Verificira se prema službenom izvoru</li>
          <li>Ispravak se objavljuje unutar 24 sata</li>
          <li>Značajne izmjene bilježe se u "Što se promijenilo"</li>
        </ol>

        <h2>Recenzenti</h2>
        <p>
          Sadržaj pregledavaju stručnjaci s relevantnim iskustvom u poreznom savjetovanju i
          računovodstvu. Svaka stranica navodi recenzenta.
        </p>

        <h2>Prijavite grešku</h2>
        <p>
          Uočili ste netočnost? Javite nam na{" "}
          <a href="mailto:info@fisk.ai" className="text-blue-400">
            info@fisk.ai
          </a>{" "}
          ili putem kontakt obrasca.
        </p>
      </div>
    </div>
  )
}
```

### Step 3: Create izvori page

```tsx
// src/app/(marketing)/izvori/page.tsx
import { Metadata } from "next"
import { ExternalLink } from "lucide-react"

export const metadata: Metadata = {
  title: "Službeni izvori | FiskAI",
  description: "Popis službenih izvora koje FiskAI koristi za ažuriranje sadržaja i kalkulatora.",
}

const sources = [
  {
    name: "Porezna uprava Republike Hrvatske",
    url: "https://www.porezna-uprava.hr",
    description: "Službene upute, obrasci, e-Porezna sustav",
    category: "Državna tijela",
  },
  {
    name: "Narodne novine",
    url: "https://narodne-novine.nn.hr",
    description: "Službeni glasnik - zakoni, pravilnici, uredbe",
    category: "Državna tijela",
  },
  {
    name: "Ministarstvo financija",
    url: "https://mfin.gov.hr",
    description: "Fiskalna politika, proračun, javni dug",
    category: "Državna tijela",
  },
  {
    name: "FINA",
    url: "https://www.fina.hr",
    description: "Registri, e-poslovanje, platni promet",
    category: "Agencije",
  },
  {
    name: "HZZO",
    url: "https://www.hzzo.hr",
    description: "Zdravstveno osiguranje, doprinosi",
    category: "Agencije",
  },
  {
    name: "HZMO",
    url: "https://www.mirovinsko.hr",
    description: "Mirovinsko osiguranje, MIO doprinosi",
    category: "Agencije",
  },
  {
    name: "Hrvatska gospodarska komora",
    url: "https://www.hgk.hr",
    description: "Poslovne informacije, registri, NKD",
    category: "Komore",
  },
  {
    name: "Hrvatska obrtnička komora",
    url: "https://www.hok.hr",
    description: "Obrtni registar, obrtnice, cehovi",
    category: "Komore",
  },
  {
    name: "e-Građani",
    url: "https://gov.hr",
    description: "Digitalne javne usluge, e-Obrt, e-Tvrtka",
    category: "e-Usluge",
  },
]

export default function IzvoriPage() {
  const categories = [...new Set(sources.map((s) => s.category))]

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-4 text-4xl font-bold text-white">Službeni izvori</h1>
      <p className="mb-12 text-lg text-white/60">
        FiskAI koristi isključivo službene izvore za ažuriranje sadržaja i kalkulatora. Ovdje je
        potpuni popis.
      </p>

      {categories.map((category) => (
        <div key={category} className="mb-10">
          <h2 className="mb-4 text-xl font-semibold text-white">{category}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {sources
              .filter((s) => s.category === category)
              .map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/10"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="font-semibold text-white">{source.name}</h3>
                    <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-blue-400" />
                  </div>
                  <p className="text-sm text-white/60">{source.description}</p>
                  <p className="mt-2 text-xs text-white/40">{new URL(source.url).hostname}</p>
                </a>
              ))}
          </div>
        </div>
      ))}

      <div className="mt-12 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-2 font-semibold text-white">Kako pratimo promjene?</h2>
        <p className="text-sm text-white/60">
          Automatizirano pratimo RSS feedove ključnih izvora. Svaka promjena propisa okida pregled
          relevantnog sadržaja. Pogledajte našu{" "}
          <a href="/urednicka-politika" className="text-blue-400 hover:underline">
            uredničku politiku
          </a>
          .
        </p>
      </div>
    </div>
  )
}
```

### Step 4: Add footer links

Modify footer component to include links to editorial pages.

### Step 5: Commit

```bash
git add src/app/\(marketing\)/metodologija src/app/\(marketing\)/urednicka-politika src/app/\(marketing\)/izvori
git commit -m "feat: add editorial policy pages (metodologija, urednicka-politika, izvori)"
```

---

## Task 4: llms.txt File

**Files:**

- Create: `public/llms.txt`
- Create: `public/.well-known/llms.txt` (symlink)

### Step 1: Create llms.txt

```txt
# FiskAI - Croatian Business & Tax Knowledge Base
# https://fisk.ai

# About
FiskAI is the authoritative resource for Croatian entrepreneurs on taxes,
business registration, and compliance. All content is in Croatian (HR).

# Main Sections
/rjecnik - Business glossary (50 terms): PDV, OIB, JOPPD, fiskalizacija...
/vodic - Guides: pausalni-obrt, doo, freelancer, obrt-dohodak
/kako-da - How-to guides: PO-SD, PDV registration, e-invoice setup
/usporedba - Business comparisons: obrt vs d.o.o., j.d.o.o. vs d.o.o.
/alati - Calculators: PDV, contributions, PO-SD, tax

# Key Facts (2025)
- VAT threshold: 60,000 EUR annual revenue
- Pausalni obrt max revenue: 60,000 EUR
- j.d.o.o. max capital: 2,650 EUR
- Contribution rates: MIO I 15%, MIO II 5%, HZZO 16.5%

# Canonical URLs
https://fisk.ai/rjecnik/pdv - What is PDV (VAT)
https://fisk.ai/rjecnik/oib - What is OIB (Personal ID Number)
https://fisk.ai/rjecnik/fiskalizacija - What is fiscalization
https://fisk.ai/vodic/pausalni-obrt - Guide to flat-rate sole proprietorship
https://fisk.ai/vodic/doo - Guide to d.o.o. (LLC)
https://fisk.ai/kako-da/ispuniti-po-sd - How to fill PO-SD form
https://fisk.ai/alati/pdv-kalkulator - VAT Calculator
https://fisk.ai/alati/kalkulator-doprinosa - Contribution Calculator

# Sources
All content verified against official Croatian government sources:
- porezna-uprava.hr (Tax Administration)
- narodne-novine.nn.hr (Official Gazette)
- fina.hr (Financial Agency)
- mfin.gov.hr (Ministry of Finance)

# Contact
info@fisk.ai
```

### Step 2: Create symlink for .well-known

```bash
mkdir -p public/.well-known
ln -s ../llms.txt public/.well-known/llms.txt
```

### Step 3: Verify accessibility

Run: `npm run dev`
Visit: `http://localhost:3000/llms.txt`
Expected: Text file renders

### Step 4: Commit

```bash
git add public/llms.txt public/.well-known
git commit -m "feat: add llms.txt for AI crawler discovery"
```

---

## Task 5: WebApplication Schema on Tools

**Files:**

- Create: `src/lib/schema/webApplication.ts`
- Modify: `src/app/(marketing)/alati/pdv-kalkulator/page.tsx`
- Modify: `src/app/(marketing)/alati/kalkulator-doprinosa/page.tsx`
- Modify: `src/app/(marketing)/alati/posd-kalkulator/page.tsx`
- Modify: Other tool pages (8 total)

### Step 1: Create WebApplication schema generator

```typescript
// src/lib/schema/webApplication.ts
export interface WebApplicationSchemaProps {
  name: string
  description: string
  url: string
  applicationCategory?: string
  operatingSystem?: string
  offers?: {
    price: string
    priceCurrency: string
  }
}

export function generateWebApplicationSchema({
  name,
  description,
  url,
  applicationCategory = "BusinessApplication",
  operatingSystem = "Web",
  offers = { price: "0", priceCurrency: "EUR" },
}: WebApplicationSchemaProps) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    url,
    applicationCategory,
    operatingSystem,
    offers: {
      "@type": "Offer",
      price: offers.price,
      priceCurrency: offers.priceCurrency,
    },
    provider: {
      "@type": "Organization",
      name: "FiskAI",
      url: "https://fisk.ai",
    },
  }
}
```

### Step 2: Add schema to PDV kalkulator

Add to existing page:

```tsx
import { generateWebApplicationSchema } from "@/lib/schema/webApplication"

// In component or generateMetadata:
const webAppSchema = generateWebApplicationSchema({
  name: "PDV Kalkulator",
  description: "Izračunajte PDV za svoje proizvode i usluge. Podržava sve hrvatske PDV stope.",
  url: "https://fisk.ai/alati/pdv-kalkulator",
})

// In JSX:
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
/>
```

### Step 3: Add schema to remaining tools

Repeat for:

- kalkulator-doprinosa
- posd-kalkulator
- kalkulator-poreza
- oib-validator
- uplatnice
- kalendar
- e-racun

### Step 4: Verify schemas with Google Rich Results Test

Visit: https://search.google.com/test/rich-results
Test each tool URL

### Step 5: Commit

```bash
git add src/lib/schema/webApplication.ts src/app/\(marketing\)/alati
git commit -m "feat: add WebApplication schema to all tool pages"
```

---

## Task 6: Hub/Satellite Internal Linking Audit

**Files:**

- Audit: All guide, glossary, and comparison pages
- Create: `docs/audit/internal-linking.md`

### Step 1: Document current linking structure

Create audit checklist:

```markdown
# Internal Linking Audit

## Hubs

### /vodic/pausalni-obrt

Links TO satellites:

- [ ] /rjecnik/pausal
- [ ] /rjecnik/po-sd
- [ ] /rjecnik/fiskalizacija
- [ ] /kako-da/ispuniti-po-sd
- [ ] /alati/posd-kalkulator

Links FROM satellites:

- [ ] All above link back

### /vodic/doo

Links TO satellites:

- [ ] /rjecnik/jdoo
- [ ] /rjecnik/temeljni-kapital
- [ ] /rjecnik/direktor
- [ ] /usporedba/firma

...continue for all hubs
```

### Step 2: Identify missing links

Run grep to check for cross-references:

```bash
grep -r "pausalni-obrt" content/ --include="*.mdx"
```

### Step 3: Add missing internal links

Update MDX files to include proper RelatedLinks components at bottom.

### Step 4: Verify navigation flow

Manual test: Can user navigate from any page to related content within 2 clicks?

### Step 5: Commit

```bash
git add content/ docs/audit/internal-linking.md
git commit -m "chore: complete internal linking audit and fixes"
```

---

## Execution Checklist

| Task | Description            | Est. Time |
| ---- | ---------------------- | --------- |
| 1    | News frontend page     | 15 min    |
| 2    | News infrastructure    | 10 min    |
| 3    | Editorial policy pages | 20 min    |
| 4    | llms.txt file          | 5 min     |
| 5    | WebApplication schema  | 15 min    |
| 6    | Internal linking audit | 20 min    |

**Total: ~85 min with subagent execution**

---

## Post-Implementation

After completing all tasks:

1. Run full build: `npm run build`
2. Run tests: `npm run test`
3. Verify all new pages accessible
4. Push to remote
5. Trigger Coolify redeploy
6. Set up cron job in Coolify for news fetching
