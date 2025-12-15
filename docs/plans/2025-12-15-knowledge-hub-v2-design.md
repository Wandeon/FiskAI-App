# Knowledge Hub v2 - Redesigned Content Architecture

**Date:** 2025-12-15
**Status:** Validated
**Author:** Claude (via brainstorming skill)

---

## Executive Summary

Consolidate 20 fragmented guides into **5 comprehensive deep-dive guides** + **4 decision-point comparison pages**. PDV integrated as contextual callouts + dedicated section (not separate pages). Wizard routes to comparison pages for decision support.

**Key insight:** Visitors need to compare options side-by-side to make decisions, not jump between 20 separate pages.

---

## 1. Content Architecture

### 5 Deep-Dive Guides (`/vodic/[slug]`)

| Slug             | Title             | Key Sections                                                      |
| ---------------- | ----------------- | ----------------------------------------------------------------- |
| `pausalni-obrt`  | Paušalni obrt     | Osnove, Uz zaposlenje, Umirovljenici, Blizu PDV praga             |
| `obrt-dohodak`   | Obrt na dohodak   | Osnove, Uz zaposlenje, Prijelaz na dobit, PDV obveze              |
| `doo`            | D.O.O. i J.D.O.O. | J.D.O.O. vs D.O.O., Jednočlano/Višečlano, Direktor s/bez plaće    |
| `freelancer`     | Freelancer        | IT/Kreativci, Inozemni klijenti, Paušal vs Obrt, PDV za EU usluge |
| `posebni-oblici` | Posebni oblici    | OPG, Slobodna profesija, Udruga, Zadruga                          |

### 4 Comparison Pages (`/usporedba/[slug]`)

| Slug             | Title                            | Compares                                           |
| ---------------- | -------------------------------- | -------------------------------------------------- |
| `pocinjem-solo`  | Želim početi sam/a               | Paušalni vs Obrt dohodak vs j.d.o.o. vs Freelancer |
| `firma`          | Želim osnovati firmu             | j.d.o.o. vs d.o.o. (tipovi)                        |
| `dodatni-prihod` | Imam posao, želim dodatni prihod | Paušalni uz zaposlenje vs j.d.o.o.                 |
| `preko-praga`    | Prelazim 60.000€                 | PDV obveza, opcije, što se mijenja                 |

### Flow

```
Wizard → Comparison Page (with personalization) → Deep-Dive Guide
```

---

## 2. Page Templates

### Deep-Dive Guide Template

```
┌─────────────────────────────────────────────────────────────┐
│ Hero: Title + "Kompletan vodič za 2025."                    │
│ Breadcrumb: Početna > Vodiči > [Guide Name]                 │
├─────────────────────────────────────────────────────────────┤
│ Quick Stats Bar (sticky on scroll)                          │
│ [Max prihod: 60k€] [Doprinosi: 262€/mj] [PDV: Ne]          │
├─────────────────────────────────────────────────────────────┤
│ Table of Contents (left sidebar on desktop)                 │
├─────────────────────────────────────────────────────────────┤
│ Content Sections:                                           │
│  1. Brzi pregled (calculator embedded)                      │
│  2. Tko može / Tko ne može                                  │
│  3. Troškovi i porezi (TaxCalculator embedded)             │
│  4. Varijante (tabs: Osnovni | Uz zaposlenje | ...)        │
│  5. Registracija korak-po-korak                            │
│  6. Obveze (mjesečne/kvartalne/godišnje)                   │
│  7. PDV i vi (dedicated section)                           │
│  8. Česta pitanja (FAQ accordion)                          │
│  9. Povezane usporedbe (links to comparison pages)         │
├─────────────────────────────────────────────────────────────┤
│ [PDV Callout boxes appear contextually throughout]          │
└─────────────────────────────────────────────────────────────┘
```

### Comparison Page Template

```
┌─────────────────────────────────────────────────────────────┐
│ Hero: "Koja opcija je za vas?" + decision context           │
├─────────────────────────────────────────────────────────────┤
│ Side-by-side comparison table                               │
│ [Paušalni] vs [Obrt dohodak] vs [j.d.o.o.] vs [Freelancer] │
│ - Max prihod, Doprinosi, Porez, PDV, Fiskalizacija...      │
├─────────────────────────────────────────────────────────────┤
│ ComparisonCalculator (interactive)                          │
│ Enter revenue → See costs for each option                   │
├─────────────────────────────────────────────────────────────┤
│ "Najbolje za..." recommendations                            │
│ 🎯 Paušalni: Male prihode, jednostavnost                   │
│ 🎯 Obrt dohodak: Veći troškovi, odbitak PDV-a              │
├─────────────────────────────────────────────────────────────┤
│ Deep-dive links: "Saznaj više o [opciji] →"                │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Wizard Flow (Updated)

Simplified from 6 questions to 4 max. Routes to comparison pages.

```
Q1: Radni status?
├── Zaposlen/a → Q2
├── Nezaposlen/a → Q2
├── Umirovljenik → /vodic/pausalni-obrt?varijanta=umirovljenik
└── Student → /vodic/pausalni-obrt?varijanta=student

Q2: Što želite?
├── Dodatni prihod uz posao → /usporedba/dodatni-prihod
├── Primarni izvor prihoda → Q3
└── Osnovati firmu s partnerima → /usporedba/firma?tip=viseclano

Q3: Očekivani godišnji prihod?
├── Do 40.000€ → /usporedba/pocinjem-solo?prihod=low
├── 40.000 - 60.000€ → /usporedba/pocinjem-solo?prihod=medium
└── Preko 60.000€ → /usporedba/preko-praga

Q4 (optional, if solo path): Vrsta djelatnosti?
├── IT / Programiranje → adds ?djelatnost=it
├── Kreativne usluge → adds ?djelatnost=kreativa
├── Trgovina → adds ?djelatnost=trgovina
└── Ostalo → no param
```

---

## 4. Calculator Integration

### Embedded Calculators

| Calculator               | Where It Appears                         | Purpose                      |
| ------------------------ | ---------------------------------------- | ---------------------------- |
| `ContributionCalculator` | All guides, comparison tables            | Monthly MIO/HZZO breakdown   |
| `TaxCalculator`          | Paušalni, Obrt dohodak guides            | Annual costs by revenue      |
| `ComparisonCalculator`   | Comparison pages                         | Side-by-side cost simulation |
| `PaymentSlipGenerator`   | All guides (PDV section, Obveze section) | Hub3 barcodes for payments   |

### ComparisonCalculator Design

```
┌─────────────────────────────────────────────────────────────┐
│ Unesite očekivani godišnji prihod: [____35.000____] EUR    │
├─────────────────────────────────────────────────────────────┤
│              │ Paušalni  │ Obrt doh. │ J.D.O.O.  │ Freelance│
│ Doprinosi    │ 3.150€    │ 3.150€    │ 5.400€*   │ 3.150€   │
│ Porez        │ 551€      │ ~2.800€   │ ~1.200€   │ 551€     │
│ HOK/Članarine│ 137€      │ 137€      │ 0€        │ 137€     │
│ Knjigovodstvo│ 0€        │ ~600€     │ ~1.200€   │ 0€       │
├─────────────────────────────────────────────────────────────┤
│ UKUPNO GOD.  │ 3.838€ ✓  │ ~6.687€   │ ~7.800€   │ 3.838€ ✓ │
│ NETO OSTAT.  │ 31.162€   │ 28.313€   │ 27.200€   │ 31.162€  │
└─────────────────────────────────────────────────────────────┘
  * Minimalna plaća direktora ako nema drugo zaposlenje
  ✓ = Preporučeno za vaš prihod
```

---

## 5. PDV Integration

### Contextual Callouts

Three types appear throughout guides where relevant:

```tsx
<PDVCallout type="warning" threshold={60000}>
  ⚠️ Ako prihod prijeđe 60.000€, automatski postajete PDV obveznik
  od 1. sljedećeg mjeseca.
</PDVCallout>

<PDVCallout type="info" context="eu-services">
  💡 Usluge za klijente u EU? PDV pravila su drugačija -
  primjenjuje se "reverse charge".
</PDVCallout>

<PDVCallout type="tip" context="voluntary">
  💰 Možete dobrovoljno ući u PDV sustav i prije praga -
  isplativo ako imate velike ulazne troškove.
</PDVCallout>
```

### Dedicated PDV Section (in every guide)

```markdown
## PDV i vi

### Kada postajete obveznik?

- Prag: 60.000€ godišnje (od 2025.)
- Automatski od 1. sljedećeg mjeseca po prelasku

### Što se mijenja?

- Morate obračunavati 25% PDV na račune
- Možete odbiti ulazni PDV (troškovi)
- Mjesečne/kvartalne PDV prijave
- Novi IBAN-ovi za uplate

### Dobrovoljni ulazak

[Kada se isplati, postupak]

### PDV za EU usluge

[B2B reverse charge, B2C pravila]
```

---

## 6. File Structure

```
content/
├── vodici/                          # 5 deep-dive guides
│   ├── pausalni-obrt.mdx           # ~800-1000 lines comprehensive
│   ├── obrt-dohodak.mdx
│   ├── doo.mdx                     # Covers j.d.o.o. + d.o.o.
│   ├── freelancer.mdx
│   └── posebni-oblici.mdx
│
├── usporedbe/                       # 4 comparison pages
│   ├── pocinjem-solo.mdx
│   ├── firma.mdx
│   ├── dodatni-prihod.mdx
│   └── preko-praga.mdx

src/
├── app/(marketing)/
│   ├── vodic/[slug]/page.tsx       # Deep-dive route (exists)
│   ├── usporedba/[slug]/page.tsx   # NEW: Comparison route
│   └── wizard/page.tsx             # Updated wizard
│
├── components/knowledge-hub/
│   ├── guide/
│   │   ├── VariantTabs.tsx         # NEW: Tabs for variations
│   │   ├── PDVCallout.tsx          # NEW: Contextual callouts
│   │   ├── QuickStatsBar.tsx       # NEW: Sticky stats
│   │   └── TableOfContents.tsx     # NEW: Sidebar TOC
│   ├── comparison/
│   │   ├── ComparisonTable.tsx     # NEW: Side-by-side table
│   │   ├── ComparisonCalculator.tsx # NEW: Interactive compare
│   │   └── RecommendationCard.tsx  # NEW: "Best for..." cards
│   └── calculators/                # Existing (keep)
│
├── lib/knowledge-hub/
│   ├── constants.ts                # Existing (keep)
│   ├── calculations.ts             # Existing (extend for comparisons)
│   ├── types.ts                    # Existing (extend)
│   ├── wizard-logic.ts             # UPDATE: New question flow
│   └── mdx.ts                      # UPDATE: Handle usporedbe/
```

---

## 7. Implementation Priority

### Phase 1: Core Infrastructure

1. Create comparison page route (`/usporedba/[slug]`)
2. Build `ComparisonTable` component
3. Build `ComparisonCalculator` component
4. Update MDX loader to handle `usporedbe/` directory

### Phase 2: Guide Components

1. Build `VariantTabs` component
2. Build `PDVCallout` component
3. Build `QuickStatsBar` component
4. Build `TableOfContents` component

### Phase 3: Content

1. Expand `pausalni-obrt.mdx` with all variations
2. Write `obrt-dohodak.mdx`
3. Write `doo.mdx` (j.d.o.o. + d.o.o.)
4. Write `freelancer.mdx`
5. Write `posebni-oblici.mdx`
6. Write 4 comparison MDX files

### Phase 4: Wizard Update

1. Simplify wizard questions (6 → 4)
2. Update routing to comparison pages
3. Add personalization params handling

### Phase 5: Polish

1. Mobile responsiveness for comparison tables
2. SEO metadata
3. Internal linking

---

## Changes from v1

| Aspect           | v1 (Original)      | v2 (Redesigned)               |
| ---------------- | ------------------ | ----------------------------- |
| Guides           | 20 separate pages  | 5 comprehensive guides        |
| Comparisons      | None               | 4 decision-point pages        |
| PDV              | Separate scenarios | Integrated callouts + section |
| Wizard output    | Individual guide   | Comparison page               |
| Wizard questions | 6                  | 4 max                         |

---

_This design document was created through the brainstorming skill process with user validation at each section._
