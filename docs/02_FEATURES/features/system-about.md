# Feature: About Page (F103)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 8

## Purpose

Provides a public-facing about page that communicates FiskAI's mission, vision, and core principles. The page serves as a transparency and trust-building tool for potential customers, explaining the company's AI-first approach to accounting, commitment to Croatian compliance, and user-centric philosophy. This low-complexity marketing page focuses on building credibility and establishing clear expectations about the product's development direction.

## User Entry Points

| Type    | Path   | Evidence                                      |
| ------- | ------ | --------------------------------------------- |
| Page    | /about | `src/app/(marketing)/about/page.tsx:8`        |
| Footer  | /about | Accessible through footer legal/company links |
| Sitemap | /about | `src/app/sitemap.ts:13`                       |
| SEO     | /about | `src/app/robots.ts:15`                        |

## Core Flow

### Page Access Flow

1. User navigates to /about via direct URL or internal site navigation → `src/app/(marketing)/about/page.tsx:8`
2. Marketing layout renders with header navigation → `src/app/(marketing)/layout.tsx:44-148`
3. Page displays company mission, principles, and vision in single-column layout → `src/app/(marketing)/about/page.tsx:10-29`
4. SEO metadata loads with Croatian title "FiskAI — O nama" → `src/app/(marketing)/about/page.tsx:3-6`

### Content Display Flow

1. Page header displays main heading "O nama" (About Us) → `src/app/(marketing)/about/page.tsx:11`
2. Introduction paragraph explains FiskAI as AI-first platform for Croatian market → `src/app/(marketing)/about/page.tsx:12-14`
3. Mission section describes goal to reduce administration through automation → `src/app/(marketing)/about/page.tsx:16-19`
4. Principles section lists four core commitments as bulleted list → `src/app/(marketing)/about/page.tsx:21-27`
5. Marketing footer displays with company information → `src/app/(marketing)/layout.tsx:78-145`

## Key Modules

| Module          | Purpose                         | Location                             |
| --------------- | ------------------------------- | ------------------------------------ |
| AboutPage       | Main about page component       | `src/app/(marketing)/about/page.tsx` |
| MarketingLayout | Marketing header/footer wrapper | `src/app/(marketing)/layout.tsx`     |
| sitemap         | SEO sitemap generation          | `src/app/sitemap.ts`                 |
| robots          | Search engine indexing rules    | `src/app/robots.ts`                  |

## Data

### Static Content

#### Page Metadata

Page uses Croatian language metadata → `src/app/(marketing)/about/page.tsx:3-6`

- **Title**: "FiskAI — O nama" (FiskAI — About Us)
- **Description**: "Vizija i smjer razvoja FiskAI platforme." (Vision and development direction of FiskAI platform)
- **Language**: Croatian (hr)

#### Company Introduction

Brief description of FiskAI platform → `src/app/(marketing)/about/page.tsx:12-14`

> "FiskAI je AI-first platforma za računovodstvo i ERP u nastajanju, fokusirana na hrvatsko tržište i nadolazeće zahtjeve (npr. Fiskalizacija 2.0)."

**Translation**: FiskAI is an AI-first platform for accounting and ERP in development, focused on the Croatian market and upcoming requirements (e.g., Fiscalization 2.0).

#### Mission Statement

Core mission of reducing administrative burden → `src/app/(marketing)/about/page.tsx:16-19`

> "Smanjiti administraciju i greške kroz automatizaciju, a da kontrola uvijek ostane kod klijenta: jasni izvještaji, audit trag i izvozi."

**Translation**: Reduce administration and errors through automation, while control always remains with the client: clear reports, audit trail, and exports.

**Key Principles**:

- Automation to reduce manual work
- Error reduction through AI assistance
- Client maintains full control
- Transparent reporting
- Complete audit trail
- Data portability through exports

#### Core Principles

Four fundamental commitments → `src/app/(marketing)/about/page.tsx:21-27`

1. **AI as Advisor, User Decides**
   - "AI predlaže, korisnik odlučuje (bez 'skrivenih' promjena)."
   - Translation: AI suggests, user decides (without "hidden" changes)
   - Philosophy: No automatic changes without explicit user approval
   - Transparency in all AI recommendations

2. **Modularity and Scalability**
   - "Modularnost: kreni jednostavno, skaliraj prema ERP-u."
   - Translation: Modularity: start simple, scale toward ERP
   - Approach: Begin with basic invoicing, expand to full ERP
   - Support businesses at all growth stages

3. **Compliance-First Development**
   - "Compliance-first: gradimo uz hrvatski regulatorni okvir."
   - Translation: Compliance-first: we build alongside Croatian regulatory framework
   - Focus: Croatian tax law, fiscalization requirements, e-invoicing standards
   - Regulatory awareness: Fiskalizacija 2.0, PDV (VAT), JOPPD, e-Račun

4. **Data Portability as Standard**
   - "Izvoz i prenosivost podataka kao standard."
   - Translation: Export and data portability as standard
   - Commitment: No vendor lock-in
   - Features: CSV/Excel/XML exports, accountant collaboration, backup capabilities

## Implementation Status

### Currently Implemented

✅ **Static Content Display**

- Company introduction and positioning
- Mission statement
- Four core principles with explanations
- Clean, readable typography

✅ **SEO Optimization**

- Croatian metadata with title and description → `src/app/(marketing)/about/page.tsx:3-6`
- Sitemap inclusion with weekly update frequency → `src/app/sitemap.ts:13`
- Robots.txt allows search engine indexing → `src/app/robots.ts:15`
- Priority: 0.7 (high for marketing page)

✅ **Responsive Layout**

- Single-column centered layout (max-width: 3xl)
- Mobile-responsive padding → `src/app/(marketing)/about/page.tsx:10`
- Proper heading hierarchy (H1, H2)
- Readable line length for extended text

✅ **Marketing Integration**

- Inherits marketing layout with header and footer → `src/app/(marketing)/layout.tsx:44-148`
- Footer displays complete company information → `src/app/(marketing)/layout.tsx:88-96`
- Consistent branding and navigation

### Not Yet Implemented

❌ **Direct Navigation Link**

- No explicit "About" or "O nama" link in marketing header navigation → `src/app/(marketing)/layout.tsx:60-65`
- Currently accessible only via direct URL or footer links
- Header shows: Mogućnosti, Cijene, Sigurnost, Kontakt (but not O nama)

❌ **Extended Content**

- No team member profiles or photos
- No company history or founding story
- No office photos or culture content
- No press mentions or media coverage

❌ **Interactive Elements**

- No embedded video about company mission
- No timeline of product development
- No interactive roadmap
- No "Meet the team" section

❌ **Analytics Tracking**

- No page view tracking beyond default analytics
- No engagement metrics for content sections
- No A/B testing capabilities

## Dependencies

### Depends On

- **Marketing Layout**: Header and footer wrapper → `src/app/(marketing)/layout.tsx`
- **Next.js Metadata**: SEO title and description → `src/app/(marketing)/about/page.tsx:3-6`
- **Global Styles**: Typography and color variables from CSS modules

### Related Pages

- **Contact Page**: Provides detailed company information and contact details → `src/app/(marketing)/contact/page.tsx`
- **Features Page**: Explains product capabilities aligned with principles → `src/app/(marketing)/features/page.tsx`
- **Landing Page**: References company values and mission → `src/app/(marketing)/page.tsx`
- **Security Page**: Expands on data protection and compliance principles → `src/app/(marketing)/security/page.tsx`

## Integrations

### Internal Integrations

#### Marketing Layout Integration

About page inherits marketing layout structure:

1. **Header Navigation** → `src/app/(marketing)/layout.tsx:51-74`
   - FiskAI logo with beta badge
   - Navigation links (Mogućnosti, Cijene, Sigurnost, Kontakt)
   - Login and Register CTAs
   - Note: "O nama" link not currently in header navigation

2. **Footer Company Information** → `src/app/(marketing)/layout.tsx:78-145`
   - Company name: Metrica d.o.o.
   - Address: Radnička cesta 80, 10000 Zagreb
   - OIB: 12345678901
   - IBAN: HR1234567890123456789 (ZABA)
   - Contact email: kontakt@fiskai.hr
   - Phone: +385 1 234 5678
   - Legal tagline: "AI-first računovodstveni asistent za Hrvatsku. Beta program."

#### SEO Integration

About page optimized for Croatian search queries:

1. **Sitemap Entry** → `src/app/sitemap.ts:13`
   - Included in routes array: `/about`
   - Weekly change frequency
   - Priority: 0.7 (high for marketing pages)
   - Dynamic base URL support

2. **Robots.txt Allowlist** → `src/app/robots.ts:15`
   - Explicitly allowed for crawling: `/about`
   - No disallow rules applied
   - Sitemap reference included

3. **Metadata Configuration** → `src/app/(marketing)/about/page.tsx:3-6`
   - Croatian title and description
   - Proper page title format with brand name
   - Descriptive meta description for search snippets

### External Integrations

None currently implemented. The about page is a static content page with no external API dependencies.

## Content Strategy

### Target Audience

The about page addresses three primary audience segments:

1. **Small Business Owners** (Paušalni obrt, VAT obrt)
   - Need reassurance about AI automation
   - Value transparency and control
   - Want to understand company philosophy

2. **Accountants and Bookkeepers** (Knjigovođa)
   - Need to understand compliance commitment
   - Value data portability and export capabilities
   - Want to verify regulatory alignment

3. **Decision Makers** (d.o.o. management)
   - Evaluating software vendors
   - Need to understand product roadmap
   - Value modularity for scalability

### Messaging Alignment

About page content aligns with broader marketing messaging:

1. **AI-First, User-Controlled**
   - Consistent with landing page emphasis on "AI predlaže, korisnik odlučuje" → `src/app/(marketing)/page.tsx:20-21`
   - Reinforces features page principle of visible, reversible AI → `src/app/(marketing)/features/page.tsx:74-79`

2. **Croatian Compliance Focus**
   - Matches landing page emphasis on "Fiskalizacija 2.0" → `src/app/(marketing)/page.tsx:44`
   - Supports features page e-invoice preparation messaging → `src/app/(marketing)/features/page.tsx:50-55`

3. **Data Portability**
   - Complements security page trust center philosophy → `src/app/(marketing)/security/page.tsx`
   - Aligns with accountant collaboration features → `src/app/(marketing)/features/page.tsx:61-67`

4. **Modular Scalability**
   - Consistent with "paušalni obrt to ERP" growth path → `src/app/(marketing)/page.tsx:238-249`
   - Matches features page modularity messaging → `src/app/(marketing)/features/page.tsx:17-18`

## Future Enhancements

### High Priority

1. **Add Navigation Link**
   - Include "O nama" link in marketing header navigation
   - Position after "Sigurnost" or in dropdown menu
   - Ensure consistent access across all marketing pages
   - Update navigation component → `src/app/(marketing)/layout.tsx:60-65`

2. **Expand Content Depth**
   - Add company founding story and motivation
   - Include team member profiles with photos
   - Display product development timeline
   - Add customer success stories specific to mission

3. **Visual Enhancements**
   - Add hero image or illustration
   - Include team photos or office imagery
   - Use infographics for principles section
   - Add video introduction from founder

### Medium Priority

4. **Regulatory Transparency**
   - Detail specific Croatian regulations supported
   - Link to compliance documentation
   - Display certification badges (if applicable)
   - Show roadmap for upcoming regulatory changes

5. **Social Proof Integration**
   - Feature customer testimonials about company values
   - Display press mentions and media coverage
   - Show awards or recognitions
   - Include partnership announcements

6. **Interactive Roadmap**
   - Public product roadmap showing feature development
   - Voting system for feature priorities
   - Transparency about beta status and timeline
   - Link to changelog and release notes

### Low Priority

7. **Localization**
   - English version of about page for international interest
   - Multi-language support for content sections
   - Maintain brand voice across translations

8. **Employee Spotlights**
   - Rotating "Meet the Team" section
   - Blog-style employee stories
   - Expertise areas and backgrounds
   - Company culture content

## Verification Checklist

### Page Access

- [ ] User can access /about via direct URL
- [ ] Page loads with correct Croatian metadata (title, description)
- [ ] Page is indexed by search engines (sitemap, robots.txt)
- [ ] Marketing layout renders with header and footer
- [ ] Page maintains consistent branding with other marketing pages

### Content Display

- [ ] Main heading "O nama" displays prominently
- [ ] Introduction paragraph explains FiskAI positioning clearly
- [ ] Mission statement is easily readable and understood
- [ ] Four core principles display as bulleted list
- [ ] All text content is in Croatian language
- [ ] Content hierarchy is clear (H1 > H2 > paragraph)

### Company Information Consistency

- [ ] Company mission aligns with landing page messaging
- [ ] Principles match features page AI-first philosophy
- [ ] Compliance focus consistent with security page
- [ ] Data portability messaging matches accountant features

### Responsive Design

- [ ] Single-column layout displays correctly on desktop
- [ ] Content remains readable on tablet devices
- [ ] Mobile view maintains proper padding and margins
- [ ] Text line length optimized for readability (max-width: 3xl)
- [ ] Heading sizes scale appropriately across breakpoints
- [ ] List formatting remains intact on all devices

### SEO & Performance

- [ ] Page metadata accurately describes content
- [ ] Proper heading hierarchy for accessibility
- [ ] Text contrast meets WCAG AA standards
- [ ] Page loads in under 2 seconds
- [ ] No console errors or warnings
- [ ] Lighthouse accessibility score >90

### Marketing Integration

- [ ] Footer company information matches about page content
- [ ] Brand voice consistent with other marketing pages
- [ ] No contradictions with landing page or features page
- [ ] Legal entity information consistent across site

## Evidence Links

1. `src/app/(marketing)/about/page.tsx:8-30` - Complete about page component with mission, principles, and vision content
2. `src/app/(marketing)/layout.tsx:44-148` - Marketing layout providing header, footer, and company information display
3. `src/app/(marketing)/layout.tsx:88-96` - Footer company information section with Metrica d.o.o. details
4. `src/app/sitemap.ts:13` - Sitemap entry for /about route with weekly update frequency and 0.7 priority
5. `src/app/robots.ts:15` - Robots.txt configuration allowing search engine indexing of /about page
6. `docs/_meta/inventory/routes.json:36-40` - Route registry confirming /about page exists at correct path
7. `README.md:1-53` - Project README explaining FiskAI as Croatian AI-first accounting platform with modular architecture
8. `src/app/(marketing)/page.tsx:20-21` - Landing page hero section reinforcing "AI ostaje u vašim rukama" (AI stays in your hands) messaging aligned with about page principles
