# FiskAI News System - Complete Design

**Date:** 2025-12-16
**Status:** Approved

## Overview

A professional news processing system that fetches Croatian news overnight, uses a 3-pass AI pipeline to ensure quality, and publishes to a magazine-style portal at 6 AM.

## Core Principles

- **Impact-based classification**: News is judged by direct business impact, not just relevance
- **Anti-AI-slop**: 3-pass pipeline with self-review catches generic content
- **Dynamic structure**: Articles adapt to content, no rigid templates
- **Full attribution**: Images and content always credit sources

---

## 1. Data Model

### news_categories

```sql
CREATE TABLE news_categories (
  id VARCHAR(50) PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name_hr VARCHAR(200) NOT NULL,
  parent_id VARCHAR(50) REFERENCES news_categories(id),
  icon VARCHAR(50),
  color VARCHAR(20),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### news_tags

```sql
CREATE TABLE news_tags (
  id VARCHAR(50) PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name_hr VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### news_posts

```sql
CREATE TABLE news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(300) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL, -- 'individual' | 'digest'
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL, -- markdown
  excerpt VARCHAR(500),

  -- Images with attribution
  featured_image_url VARCHAR(1000),
  featured_image_source VARCHAR(200),
  featured_image_caption VARCHAR(500),

  -- Classification
  category_id VARCHAR(50) REFERENCES news_categories(id),
  tags JSONB DEFAULT '[]',
  impact_level VARCHAR(20), -- 'high' | 'medium' | 'low'

  -- AI Processing
  ai_passes JSONB DEFAULT '{}', -- stores all 3 passes
  status VARCHAR(20) DEFAULT 'draft', -- 'draft' | 'reviewing' | 'published'

  -- Timestamps
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### news_post_sources (junction table)

```sql
CREATE TABLE news_post_sources (
  post_id UUID REFERENCES news_posts(id) ON DELETE CASCADE,
  news_item_id UUID REFERENCES news_items(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, news_item_id)
);
```

### news_items (additions to existing)

```sql
ALTER TABLE news_items ADD COLUMN impact_level VARCHAR(20);
ALTER TABLE news_items ADD COLUMN assigned_to_post_id UUID REFERENCES news_posts(id);
ALTER TABLE news_items ADD COLUMN image_url VARCHAR(1000);
ALTER TABLE news_items ADD COLUMN image_source VARCHAR(200);
```

### Seed Categories

```
Porezi (porezi)
├── PDV (pdv)
├── Porez na dobit (porez-na-dobit)
├── Porez na dohodak (porez-na-dohodak)
└── Doprinosi (doprinosi)

Propisi (propisi)
├── Zakoni (zakoni)
├── Pravilnici (pravilnici)
└── Rokovi (rokovi)

Poslovanje (poslovanje)
├── Financije (financije)
├── Računovodstvo (racunovodstvo)
└── Upravljanje (upravljanje)
```

---

## 2. AI Processing Pipeline

### Schedule

- **23:00** - Fetch & Classify (Cron 1)
- **23:30** - Review (Cron 2)
- **00:00** - Rewrite & Finalize (Cron 3)
- **06:00** - Posts become visible

### Pass 1: Classify & Write

**Classification Prompt:**

```
Ti si urednik FiskAI portala za hrvatske poduzetnike i računovođe.

Procijeni ovu vijest prema UTJECAJU na poslovanje:

VISOK UTJECAJ (individual post):
- Nova zakonska obveza
- Promjena porezne stope ili praga
- Novi rok za prijavu/plaćanje
- Značajna kazna ili kontrola
- Direktno utječe na svakodnevno poslovanje

SREDNJI UTJECAJ (digest):
- Informativno ali nije hitno
- Trendovi u industriji
- Najave budućih promjena
- Statistike i izvještaji

NIZAK UTJECAJ (skip):
- Nije relevantno za poduzetnike
- Previše općenito
- Zabava, sport, politika bez poslovnog konteksta

Vijest: {title}
{content}

Odgovori JSON: {"impact": "high|medium|low", "reasoning": "..."}
```

**Writing Prompt (High Impact):**

```
Napiši članak za FiskAI portal o ovoj vijesti.

PRAVILA:
1. NE koristi uvijek iste sekcije - struktura ovisi o sadržaju
2. NE počinji sa "U današnjem dinamičnom poslovnom okruženju..."
3. NE koristi fraze: "ključno je napomenuti", "važno je istaknuti", "u konačnici"
4. BUDI konkretan - brojke, datumi, iznosi
5. AKO ima rok - stavi ga prominentno
6. AKO zahtijeva akciju - objasni točno što napraviti
7. AKO je samo informativno - nemoj izmišljati akcije

Ton: Profesionalan ali pristupačan. Kao da kolega računovođa objašnjava.

Duljina: 400-600 riječi, ovisno o kompleksnosti.

Vijest: {title}
{content}
Izvor: {source_url}
```

### Pass 2: Review

**Review Prompt:**

```
Pregledaj ovaj članak kao strogi urednik. Budi kritičan.

PROVJERI:
□ Ima li generičkih fraza koje ništa ne znače?
□ Je li struktura logična za OVU konkretnu vijest?
□ Jesu li informacije točne prema izvoru?
□ Može li čitatelj razumjeti bez prethodnog znanja?
□ Ako ima rok/akcija - je li dovoljno istaknut?
□ Je li predugačko? Može li se skratiti bez gubitka?

FORMAT ODGOVORA:
{
  "score": 1-10,
  "problems": ["konkretni problemi"],
  "suggestions": ["konkretne izmjene"],
  "rewrite_focus": "što treba najviše popraviti"
}
```

### Pass 3: Rewrite

**Rewrite Prompt:**

```
Prepiši ovaj članak uzimajući u obzir feedback recenzenta.

ORIGINALNI ČLANAK:
{draft}

FEEDBACK RECENZENTA:
{review_feedback}

Zadržaj dobre dijelove, popravi probleme, implementiraj sugestije.
Vrati samo finalni članak, bez komentara.
```

### Digest Assembly

After individual posts, group medium-impact items by category theme:

```
{
  "intro": "Editorial paragraph tying together today's news",
  "sections": [
    {
      "theme": "PDV novosti",
      "items": [
        {"title": "...", "summary": "2-3 sentences", "source_url": "..."}
      ]
    }
  ]
}
```

---

## 3. Image Handling

### Extraction Priority

1. `<media:content>` or `<enclosure>` in RSS
2. `<img>` in `content:encoded`
3. `og:image` from source URL (fallback)
4. Category placeholder image

### Local Image Caching (Issue #299)

Images are cached locally to prevent hotlinking issues:

- **Location:** `public/images/news-cache/`
- **Naming:** SHA256 hash of URL (first 16 chars) + extension
- **Max size:** 5MB per image
- **Retention:** 30 days, auto-cleanup
- **Module:** `src/lib/news/image-cache.ts`

Database fields:
- `local_image_path` - Cached local path (preferred)
- `image_url` - Original URL (kept for reference/re-caching)

### Attribution Requirements

- Cache images locally (never hotlink from source)
- Keep original URL for reference and re-caching
- Visible credit overlay on images: "Foto: Index.hr"
- Fallback to category placeholder if cache fails
- Source section at article bottom:
  ```
  ---
  Izvor: Index.hr
  Originalni clanak: [Naslov](url)
  Fotografija: Index.hr
  ---
  ```

---

## 4. Frontend - Magazine Layout

### Homepage (`/vijesti`)

```
┌─────────────────────────────────────────────────────────────┐
│  HERO SECTION                                               │
│  ┌─────────────────────────────────┬──────────────────────┐ │
│  │      Featured Post              │  Secondary Post 1    │ │
│  │      (Highest impact today)     │  Secondary Post 2    │ │
│  │                                 │  Secondary Post 3    │ │
│  └─────────────────────────────────┴──────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  CATEGORY NAVIGATION                                        │
│  [Sve] [Porezi ▾] [Propisi ▾] [Poslovanje ▾] [Pretraži]    │
├─────────────────────────────────────────────────────────────┤
│  DAILY DIGEST BANNER                                        │
│  📰 Dnevni pregled - {date} → Pročitaj digest              │
├─────────────────────────────────────────────────────────────┤
│  CATEGORY SECTIONS (3-4 posts each, "Vidi sve →")          │
│  • Porezi                                                   │
│  • Propisi                                                  │
│  • Poslovanje                                               │
├─────────────────────────────────────────────────────────────┤
│  SIDEBAR: Popularno, Nadolazeći rokovi, Newsletter         │
└─────────────────────────────────────────────────────────────┘
```

### Post Detail (`/vijesti/[slug]`)

- Clean prose layout, max-width
- Featured image with attribution
- Related posts by category/tag
- Share buttons
- Source attribution footer

### Category Pages (`/vijesti/kategorija/[slug]`)

- Filtered grid with subcategory tabs
- Chronological with pagination

---

## 5. Admin Interface

### Dashboard (`/admin/vijesti`)

- Pipeline status cards (Pending/Draft/Reviewing/Published)
- Tonight's queue with run/skip controls
- Filterable post table with quick actions

### Post Editor (`/admin/vijesti/[id]`)

- Split view: Editor | AI Passes
- View all 3 AI passes
- Edit content with markdown
- Change category/tags
- Override publish time
- Re-run individual passes

---

## 6. API Endpoints

### Cron Jobs

- `GET /api/cron/news/fetch-classify` - Pass 1 (auth: CRON_SECRET)
- `GET /api/cron/news/review` - Pass 2 (auth: CRON_SECRET)
- `GET /api/cron/news/publish` - Pass 3 (auth: CRON_SECRET)

### Public API

- `GET /api/news/posts` - List published posts
- `GET /api/news/posts/[slug]` - Single post
- `GET /api/news/categories` - Category tree
- `GET /api/news/digest/[date]` - Daily digest

### Admin API

- `GET /api/admin/news/posts` - All posts (any status)
- `PATCH /api/admin/news/posts/[id]` - Update post
- `POST /api/admin/news/posts/[id]/reprocess` - Re-run AI
- `POST /api/admin/news/posts/[id]/publish` - Force publish

---

## 7. Environment Variables

```env
# DeepSeek
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat

# Cron
CRON_SECRET=xxx

# Config
NEWS_PUBLISH_HOUR=6
NEWS_FETCH_HOUR=23
```

---

## 8. Implementation Order

1. **Database**: Schema migrations, seed categories
2. **AI Pipeline**: classifier.ts, writer.ts, reviewer.ts, rewriter.ts
3. **Cron Jobs**: 3 endpoints with DeepSeek integration
4. **Frontend**: Magazine layout, post detail, category pages
5. **Admin**: Dashboard and editor
6. **Test**: Process yesterday's news, verify output

---

## Files to Create

| Category   | Files                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema     | `src/lib/db/schema/news.ts` (extend), migration                                                                                                |
| AI         | `src/lib/news/pipeline/classifier.ts`, `writer.ts`, `reviewer.ts`, `rewriter.ts`, `digest-assembler.ts`                                        |
| Cron       | `src/app/api/cron/news/fetch-classify/route.ts`, `review/route.ts`, `publish/route.ts`                                                         |
| Frontend   | `src/app/(marketing)/vijesti/page.tsx`, `[slug]/page.tsx`, `kategorija/[slug]/page.tsx`                                                        |
| Components | `src/components/news/HeroSection.tsx`, `CategorySection.tsx`, `DigestBanner.tsx`, `PostCard.tsx`, `PostDetail.tsx`, `ImageWithAttribution.tsx` |
| Admin      | `src/app/admin/vijesti/page.tsx`, `[id]/page.tsx`                                                                                              |
| Scripts    | `scripts/seed-news-categories.ts`, `scripts/process-news-manual.ts`                                                                            |
