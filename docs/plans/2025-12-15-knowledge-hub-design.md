# FiskAI Knowledge Hub - Design Document

**Date:** 2025-12-15
**Status:** Validated
**Author:** Claude (via brainstorming skill)

---

## Executive Summary

Transform FiskAI from a typical SaaS marketing site into **THE authoritative Croatian business knowledge hub**. When people ask "kako otvoriti paušalni obrt?" the answer becomes "go to FiskAI."

**Core Philosophy:** Provide genuine value first. Complete, verified, authoritative content with amazing UX that leads users to say "FiskAI does it all, I need this!"

---

## 1. Information Architecture

### Homepage Structure (Wizard-First)

```
┌─────────────────────────────────────────────────────────────┐
│  Hero: "Sve što trebate znati o poslovanju u Hrvatskoj"     │
│  CTA: "Pronađite svoj poslovni oblik" → Wizard              │
├─────────────────────────────────────────────────────────────┤
│  Problem Categories (quick entry below wizard)              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Želim   │ │ Imam    │ │ Trebam  │ │ Imam    │           │
│  │ početi  │ │ posao   │ │ pomoć   │ │ pitanje │           │
│  │ posao   │ │ uz      │ │ s       │ │ o       │           │
│  │         │ │ posao   │ │ porezima│ │ ...     │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
├─────────────────────────────────────────────────────────────┤
│  Free Tools Grid                                            │
│  [Kalkulator doprinosa] [PDV kalkulator] [Generator uplatnica]
├─────────────────────────────────────────────────────────────┤
│  Guide Categories                                           │
│  Fizičke osobe → Obrti → Društva → Udruge                  │
└─────────────────────────────────────────────────────────────┘
```

### URL Structure

| Path                  | Purpose                           |
| --------------------- | --------------------------------- |
| `/`                   | Homepage with wizard + categories |
| `/wizard`             | Full-page interactive wizard      |
| `/vodic/[slug]`       | Guide pages (20 scenarios)        |
| `/alati/[tool]`       | Standalone calculator tools       |
| `/postupci/[slug]`    | Step-by-step procedures           |
| `/baza-znanja/[slug]` | Reference articles                |

---

## 2. Wizard Flow & Logic

### Smart 5-6 Question Flow

The wizard uses conditional logic to navigate through 20 possible business scenarios with minimal questions.

```
Q1: Employment Status
├── "Zaposlen sam" → Q2
├── "Nezaposlen sam" → Q3
└── "Umirovljenik" → Special path

Q2: Business Intent (if employed)
├── "Dodatni prihod uz posao" → Q4
├── "Želim prijeći na vlastiti posao" → Q4
└── "Imam ideju, istražujem" → Q4

Q3: Business Intent (if unemployed)
├── "Pokrećem posao kao glavni izvor prihoda" → Q4
├── "Testiram ideju" → Q4
└── "Imam partnere/investitore" → Corporate path

Q4: Revenue Expectations
├── "< 12.000 EUR godišnje" → Paušal recommended
├── "12.000 - 40.000 EUR" → Paušal possible
├── "40.000 - 60.000 EUR" → Near PDV threshold
└── "> 60.000 EUR" → Standard obrt or d.o.o.

Q5: Cash Handling
├── "Samo kartice/virman" → No fiskalizacija needed
├── "Primam gotovinu" → Fiskalizacija required
└── "Nisam siguran" → Explain implications

Q6: Business Type (if applicable)
├── "Usluge (IT, konzalting...)" → NKD selection
├── "Trgovina" → Retail considerations
├── "Proizvodnja" → Manufacturing path
└── "Ugostiteljstvo" → Hospitality requirements
```

### Wizard Output

Wizard generates URL parameters that personalize the static guide page:

```
/vodic/pausalni-obrt?prihod=25000&gotovina=da&zaposlenje=da&nkd=62.01
```

The guide page reads these params and shows a **personalized summary section** at the top:

```
┌─────────────────────────────────────────────────────────────┐
│ 🎯 Vaš personalizirani pregled                              │
│                                                             │
│ Na temelju vaših odgovora:                                  │
│ • Očekivani godišnji prihod: 25.000 EUR                    │
│ • Paušalni porez: 137,70 EUR/kvartalno                     │
│ • Doprinosi: 262,51 EUR/mjesečno                           │
│ • Trebate fiskalizaciju: DA                                │
│                                                             │
│ [Spremi izračun] [Podijeli]                                │
└─────────────────────────────────────────────────────────────┘
│                                                             │
│ (Rest of static SEO-friendly guide content below)          │
```

---

## 3. Guide Page Structure

### 20 Business Scenarios (from COMPLETE_MODULE_MATRIX.md)

| #   | Scenario                      | Slug                          |
| --- | ----------------------------- | ----------------------------- |
| 1   | Paušalni obrt - osnovno       | `pausalni-obrt`               |
| 2   | Paušalni obrt uz zaposlenje   | `pausalni-obrt-uz-zaposlenje` |
| 3   | Paušalni obrt - umirovljenik  | `pausalni-obrt-umirovljenik`  |
| 4   | Obrt na dohodak               | `obrt-dohodak`                |
| 5   | Obrt na dohodak uz zaposlenje | `obrt-dohodak-uz-zaposlenje`  |
| 6   | Obrt na dobit                 | `obrt-dobit`                  |
| 7   | j.d.o.o.                      | `jdoo`                        |
| 8   | j.d.o.o. uz zaposlenje        | `jdoo-uz-zaposlenje`          |
| 9   | d.o.o. - jednočlano           | `doo-jednoclan`               |
| 10  | d.o.o. - višečlano            | `doo-viseclano`               |
| 11  | d.o.o. - direktor bez plaće   | `doo-direktor-bez-place`      |
| 12  | d.o.o. - direktor s plaćom    | `doo-direktor-s-placom`       |
| 13  | Slobodna profesija            | `slobodna-profesija`          |
| 14  | OPG                           | `opg`                         |
| 15  | Udruga                        | `udruga`                      |
| 16  | Zadruga                       | `zadruga`                     |
| 17  | Sezonski obrt                 | `sezonski-obrt`               |
| 18  | PDV obveznik (paušal)         | `pausalni-pdv`                |
| 19  | IT freelancer (paušal)        | `it-freelancer`               |
| 20  | Ugostiteljstvo                | `ugostiteljstvo`              |

### Guide Page Template

Each guide follows this structure:

```markdown
# [Business Type] - Kompletan vodič za 2025.

<PersonalizedSection params={urlParams} />

## Brzi pregled

- Tko može otvoriti
- Porezni tretman
- Mjesečni troškovi
- Ključni rokovi

## Detaljni troškovi

<ContributionCalculator embedded />
<TaxCalculator embedded />

## Pravila i ograničenja

- Limit prihoda
- PDV prag
- Gotovinski promet
- Posebni uvjeti

## Postupak registracije

1. Korak po korak
2. Potrebni dokumenti
3. Gdje predati
4. Očekivano trajanje

## Obveze tijekom poslovanja

### Mjesečne

### Kvartalne

### Godišnje

## Parafiskalne obveze

- HOK
- Turistička zajednica
- Druge naknade

## Plaćanja i IBAN-ovi

<PaymentSlipGenerator embedded />

## FAQ

<AccordionFAQ items={faqItems} />

## Povezani alati

[Grid of relevant tools]

---

Zadnje ažurirano: {lastUpdated}
Imate ispravak? [Prijavite grešku]
```

---

## 4. Standalone Tools

### 6 Core Tools

| Tool                 | Path                          | Purpose                          |
| -------------------- | ----------------------------- | -------------------------------- |
| Kalkulator doprinosa | `/alati/kalkulator-doprinosa` | Monthly contribution breakdown   |
| Kalkulator poreza    | `/alati/kalkulator-poreza`    | Tax calculation by business type |
| PDV prag kalkulator  | `/alati/pdv-prag-kalkulator`  | VAT threshold tracking           |
| Generator uplatnica  | `/alati/generator-uplatnica`  | Hub3 barcode generation          |
| Usporedba oblika     | `/alati/usporedba-oblika`     | Side-by-side comparison          |
| Kalendar rokova      | `/alati/kalendar-rokova`      | Deadline calendar                |

### Tool Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Tool Title + Description                                    │
├─────────────────────────────────────────────────────────────┤
│ [Interactive Calculator/Generator]                          │
│                                                             │
│ Input fields → Calculate → Results                         │
├─────────────────────────────────────────────────────────────┤
│ How to use this tool                                        │
│ What the numbers mean                                       │
│ Common questions                                            │
├─────────────────────────────────────────────────────────────┤
│ Related guides: [Paušalni obrt] [Obrt dohodak] [...]       │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Technical Implementation

### File Structure

```
src/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx                    # Homepage redesign
│   │   ├── wizard/
│   │   │   └── page.tsx                # Full wizard page
│   │   ├── vodic/
│   │   │   └── [slug]/
│   │   │       └── page.tsx            # MDX guide loader
│   │   ├── alati/
│   │   │   ├── page.tsx                # Tools index
│   │   │   ├── kalkulator-doprinosa/
│   │   │   │   └── page.tsx
│   │   │   ├── kalkulator-poreza/
│   │   │   │   └── page.tsx
│   │   │   ├── pdv-prag-kalkulator/
│   │   │   │   └── page.tsx
│   │   │   ├── generator-uplatnica/
│   │   │   │   └── page.tsx
│   │   │   ├── usporedba-oblika/
│   │   │   │   └── page.tsx
│   │   │   └── kalendar-rokova/
│   │   │       └── page.tsx
│   │   ├── postupci/
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   └── baza-znanja/
│   │       └── [slug]/
│   │           └── page.tsx
│
├── components/
│   ├── knowledge-hub/
│   │   ├── wizard/
│   │   │   ├── WizardContainer.tsx
│   │   │   ├── WizardQuestion.tsx
│   │   │   ├── WizardProgress.tsx
│   │   │   └── WizardResult.tsx
│   │   ├── guide/
│   │   │   ├── PersonalizedSection.tsx
│   │   │   ├── GuideHeader.tsx
│   │   │   ├── QuickOverview.tsx
│   │   │   ├── CostBreakdown.tsx
│   │   │   └── DeadlineCalendar.tsx
│   │   ├── calculators/
│   │   │   ├── ContributionCalculator.tsx
│   │   │   ├── TaxCalculator.tsx
│   │   │   ├── VATThresholdCalculator.tsx
│   │   │   ├── PaymentSlipGenerator.tsx
│   │   │   ├── BusinessComparison.tsx
│   │   │   └── Hub3Generator.tsx
│   │   └── mdx-components.tsx
│
├── content/                             # MDX files
│   ├── vodici/
│   │   ├── pausalni-obrt.mdx
│   │   ├── pausalni-obrt-uz-zaposlenje.mdx
│   │   ├── pausalni-obrt-umirovljenik.mdx
│   │   ├── obrt-dohodak.mdx
│   │   ├── obrt-dohodak-uz-zaposlenje.mdx
│   │   ├── obrt-dobit.mdx
│   │   ├── jdoo.mdx
│   │   ├── jdoo-uz-zaposlenje.mdx
│   │   ├── doo-jednoclan.mdx
│   │   ├── doo-viseclano.mdx
│   │   ├── doo-direktor-bez-place.mdx
│   │   ├── doo-direktor-s-placom.mdx
│   │   ├── slobodna-profesija.mdx
│   │   ├── opg.mdx
│   │   ├── udruga.mdx
│   │   ├── zadruga.mdx
│   │   ├── sezonski-obrt.mdx
│   │   ├── pausalni-pdv.mdx
│   │   ├── it-freelancer.mdx
│   │   └── ugostiteljstvo.mdx
│   ├── postupci/
│   │   ├── registracija-obrta.mdx
│   │   ├── registracija-doo.mdx
│   │   ├── prijava-u-pdv.mdx
│   │   └── ...
│   └── baza-znanja/
│       ├── fiskalizacija.mdx
│       ├── pdv-osnove.mdx
│       └── ...
│
└── lib/
    └── knowledge-hub/
        ├── constants.ts                # 2025 rates
        ├── calculations.ts             # Business logic
        ├── hub3.ts                     # Hub3 barcode generation
        ├── wizard-logic.ts             # Wizard state machine
        ├── mdx.ts                      # MDX loading utilities
        └── types.ts                    # TypeScript types
```

### MDX Configuration

Using `@next/mdx` or `next-mdx-remote` for:

- Custom components in MDX
- Frontmatter metadata
- Automatic TOC generation
- Code syntax highlighting

```typescript
// mdx-components.tsx
import { ContributionCalculator } from "./calculators/ContributionCalculator"
import { TaxCalculator } from "./calculators/TaxCalculator"
import { PaymentSlipGenerator } from "./calculators/PaymentSlipGenerator"
import { PersonalizedSection } from "./guide/PersonalizedSection"

export const mdxComponents = {
  ContributionCalculator,
  TaxCalculator,
  PaymentSlipGenerator,
  PersonalizedSection,
  // ... more components
}
```

---

## 6. Data & Constants (2025 Verified)

### Paušalni Obrt Tax Brackets 2025

| Revenue Range (EUR) | Tax Base (EUR) | Annual Tax (EUR) | Quarterly Tax (EUR) |
| ------------------- | -------------- | ---------------- | ------------------- |
| 0 - 11,300          | 1,695          | 203.40           | 50.85               |
| 11,300.01 - 15,300  | 2,295          | 275.40           | 68.85               |
| 15,300.01 - 19,900  | 2,985          | 358.20           | 89.55               |
| 19,900.01 - 30,600  | 4,590          | 550.80           | 137.70              |
| 30,600.01 - 40,000  | 6,000          | 720.00           | 180.00              |
| 40,000.01 - 50,000  | 7,500          | 900.00           | 225.00              |
| 50,000.01 - 60,000  | 9,000          | 1,080.00         | 270.00              |

**Tax rate:** 12% (local surtax not included)

### Monthly Contributions 2025

| Contribution              | Rate  | Monthly Amount (EUR) |
| ------------------------- | ----- | -------------------- |
| MIO I (pension pillar 1)  | 15%   | 107.88               |
| MIO II (pension pillar 2) | 5%    | 35.96                |
| HZZO (health insurance)   | 16.5% | 118.67               |
| **TOTAL**                 |       | **262.51**           |

**Contribution base (minimalna osnovica):** 719.20 EUR

### Key Thresholds 2025

| Threshold             | Amount          | Note                          |
| --------------------- | --------------- | ----------------------------- |
| PDV registration      | 60,000 EUR      | Increased from 40,000 in 2025 |
| Paušalni obrt max     | 60,000 EUR      | Same as PDV threshold         |
| Cash B2B limit        | 700 EUR         | Per transaction               |
| Asset capitalization  | 464.53 EUR      | Per item                      |
| Corporate tax (small) | < 1,000,000 EUR | 10% rate                      |
| Corporate tax (large) | ≥ 1,000,000 EUR | 18% rate                      |

### HOK (Hrvatska Obrtnička Komora) 2025

| Period    | Amount (EUR) |
| --------- | ------------ |
| Monthly   | 11.40        |
| Quarterly | 34.20        |

**Payment deadlines:** 27.2., 31.5., 31.8., 30.11.

### Turistička Zajednica Rates 2025

| Rate Group | Rate     | Typical Activities   |
| ---------- | -------- | -------------------- |
| Group 1    | 0.14212% | Tourism, hospitality |
| Group 2    | 0.11367% | Trade, transport     |
| Group 3    | 0.08527% | Services             |
| Group 4    | 0.02842% | Manufacturing        |
| Group 5    | 0.01705% | Agriculture, fishing |

### Income Tax Rates 2025 (Obrt dohodak / Employees)

| Income Bracket   | Rate  |
| ---------------- | ----- |
| Up to 50,400 EUR | 23.6% |
| Above 50,400 EUR | 35.4% |

Note: These include average local surtax (~10%)

### Corporate Tax 2025

| Revenue         | Rate |
| --------------- | ---- |
| < 1,000,000 EUR | 10%  |
| ≥ 1,000,000 EUR | 18%  |

### Payment IBANs

| Purpose                   | IBAN                  | Model |
| ------------------------- | --------------------- | ----- |
| State Budget (taxes)      | HR1210010051863000160 | HR68  |
| MIO II (pension pillar 2) | HR8724070001007120013 | HR68  |
| HZZO (health)             | HR6510010051550100001 | HR68  |
| HOK                       | HR1223400091100106237 | HR68  |

---

## 7. Content Verification Strategy

### Combination Approach for Launch

1. **Version Dating**
   - Every page shows "Ažurirano: [date]"
   - Content frontmatter tracks `lastVerified` date
   - Automated warnings for content older than 6 months

2. **Disclaimers**
   - Standard footer disclaimer on all pages
   - "Informativni sadržaj - konzultirajte stručnjaka za specifične situacije"

3. **Error Reporting**
   - "Prijavite grešku" button on every page
   - Links to simple feedback form
   - Community-driven corrections

### Content Update Process

```
1. Annual review (January) - All 2025 rates verified
2. Quarterly check - Major regulatory changes
3. User reports - Address within 48 hours
4. Source links - Maintain references to official sources
```

---

## 8. SEO Strategy

### Target Keywords per Guide

| Guide         | Primary Keywords                                              |
| ------------- | ------------------------------------------------------------- |
| pausalni-obrt | paušalni obrt, otvaranje paušalnog obrta, paušalni porez 2025 |
| obrt-dohodak  | obrt na dohodak, porez na dohodak obrtnika                    |
| jdoo          | j.d.o.o., jednostavno društvo, otvaranje jdoo                 |
| doo           | d.o.o. osnivanje, troškovi d.o.o.                             |

### Structured Data

- FAQ Schema on all guide pages
- HowTo Schema on procedure pages
- BreadcrumbList on all pages
- Organization Schema on homepage

### Meta Tags Template

```html
<title>{Guide Title} - Kompletan Vodič 2025 | FiskAI</title>
<meta name="description" content="{150 char summary with keywords}" />
<meta property="og:title" content="{Guide Title} | FiskAI Baza Znanja" />
<meta property="og:type" content="article" />
```

---

## 9. Success Metrics

### Launch Targets

- 20 complete guide pages
- 6 functional calculator tools
- Working wizard with all paths
- Mobile-responsive design
- < 3s page load time

### Post-Launch Tracking

- Organic search traffic per guide
- Wizard completion rate
- Tool usage frequency
- Error report submissions
- Conversion to FiskAI signup

---

## 10. Implementation Priority

### Phase 1: Foundation

1. Create file structure
2. Implement constants.ts with all 2025 data
3. Build MDX loading infrastructure
4. Create base component library

### Phase 2: Core Tools

1. ContributionCalculator
2. TaxCalculator (paušal)
3. PaymentSlipGenerator (Hub3)

### Phase 3: Wizard

1. Wizard state machine
2. Question components
3. Result routing
4. URL parameter generation

### Phase 4: Guide Pages

1. MDX template
2. PersonalizedSection component
3. First 5 guides (most popular)
4. Remaining 15 guides

### Phase 5: Polish

1. Homepage redesign
2. Navigation
3. SEO implementation
4. Mobile optimization

---

## Appendix: Source References

- HOK: https://www.hok.hr/
- Porezna uprava: https://www.porezna-uprava.hr/
- TEB: https://www.teb.hr/
- PWC Croatia: https://www.pwc.hr/
- Fiskalopedija: https://fiskalopedija.hr/

---

_This design document was created through the brainstorming skill process with user validation at each step._
