# Feature: Pausalni Obrt Landing Page (F108)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 10

## Purpose

The Pausalni Obrt Landing Page serves as a specialized, targeted entry point for Croatian flat-rate sole proprietors (paušalni obrtnici), communicating FiskAI's unique value proposition for this specific business structure. This low-complexity marketing feature addresses the distinct pain points, administrative challenges, and bookkeeping requirements faced by paušalni obrt businesses, converting visitors into registered users through niche-specific messaging, pricing transparency, and simplified feature presentation.

## User Entry Points

| Type | Path                 | Evidence                                            |
| ---- | -------------------- | --------------------------------------------------- |
| Page | /for/pausalni-obrt   | `src/app/(marketing)/for/pausalni-obrt/page.tsx:10` |
| Link | Marketing navigation | Landing page accessible from marketing header       |
| Link | Registration CTAs    | Multiple links to /register throughout page         |
| Link | Contact form         | Secondary CTA linking to /contact                   |

## Core Flow

1. Visitor lands on /for/pausalni-obrt from marketing campaigns, organic search, or referral links
2. System displays hero section with paušalni obrt-specific value proposition and badge
3. Visitor views "Why paušalni obrt loves FiskAI" section highlighting time savings, accuracy, and export simplicity
4. System presents 4 feature cards tailored to paušalni obrt needs:
   - Izdavanje računa (Invoice issuance)
   - Praćenje troškova (Expense tracking)
   - Izvoz za knjigovođu (Accountant export)
   - Suradnja s knjigovođom (Accountant collaboration)
5. Visitor scrolls through monthly workflow visualization (4-step process)
6. System displays transparent pricing section with "Paušalni plan" at 39 EUR/month
7. Visitor reviews FAQ section addressing common paušalni obrt concerns
8. System presents final CTA with trial offer and no credit card requirement
9. Visitor clicks primary CTA → redirects to /register
10. Alternative: Visitor clicks secondary CTA → redirects to /contact for demo request

## Key Sections

| Section          | Purpose                                        | Implementation Location                                  |
| ---------------- | ---------------------------------------------- | -------------------------------------------------------- |
| Hero Section     | Above-the-fold value proposition with badge    | `src/app/(marketing)/for/pausalni-obrt/page.tsx:14-39`   |
| Why Section      | 3-column benefit grid (time, accuracy, export) | `src/app/(marketing)/for/pausalni-obrt/page.tsx:42-79`   |
| Features Grid    | 4 detailed feature cards with checkmarks       | `src/app/(marketing)/for/pausalni-obrt/page.tsx:82-197`  |
| Monthly Workflow | 4-step visual process timeline                 | `src/app/(marketing)/for/pausalni-obrt/page.tsx:200-224` |
| Pricing Section  | Single plan with 39 EUR/month pricing          | `src/app/(marketing)/for/pausalni-obrt/page.tsx:227-274` |
| FAQ Section      | 4 common questions with detailed answers       | `src/app/(marketing)/for/pausalni-obrt/page.tsx:277-321` |
| Final CTA        | Repeated trial offer with reassurance          | `src/app/(marketing)/for/pausalni-obrt/page.tsx:324-338` |

## Target Audience Analysis

### Who is a Paušalni Obrtnik?

A paušalni obrtnik is a Croatian flat-rate sole proprietor operating under simplified taxation rules (paušalno oporezivanje). This business structure is designed for small businesses with:

- **Annual Income Limit**: Revenue not exceeding 60,000 EUR (increased from 40,000 EUR in 2025)
- **VAT Status**: Not required to register for VAT if below threshold
- **Tax Structure**: Flat-rate income tax of 12% paid quarterly
- **Social Contributions**: Fixed monthly payments (~262.51 EUR in 2025)
- **Bookkeeping Requirement**: Simplified - only KPR (Knjiga Prometa/Book of Turnover) required
- **No Full Accountant**: Can manage bookkeeping without professional accountant

Reference: [How to open and close an obrt in Croatia: Guide for 2025](https://www.expatincroatia.com/open-close-obrt-croatia/)

### Primary Pain Points

Based on research and FiskAI's value proposition, paušalni obrt businesses face these challenges:

1. **Time-Intensive Administration** (5-10 hours monthly)
   - Manual invoice creation and tracking
   - Expense receipt collection and organization
   - Preparing data for quarterly accountant meetings
   - The "donosim fascikl" (bringing folder) burden

2. **Bookkeeping Errors**
   - Manual calculation mistakes in VAT and totals
   - Incorrect invoice numbering (serija, godina)
   - Missing or incomplete OIB validation
   - Lost receipts and missing expense documentation

3. **Accountant Communication Friction**
   - Email chains with attachments
   - Physical meetings with paper folders
   - Data format mismatches (PDFs, spreadsheets, photos)
   - Lack of real-time access to financial status

4. **VAT Threshold Anxiety**
   - Fear of accidentally exceeding 60,000 EUR threshold
   - Uncertainty about current revenue status
   - Manual tracking of yearly revenue progress
   - Risk of mandatory VAT registration without warning

5. **Bureaucratic Overhead**
   - Croatian-language fiscal requirements (Fiskalizacija 2.0 starting 2026)
   - KPR maintenance and quarterly reporting
   - PO-SD annual form preparation
   - Receipt and invoice retention (11-year requirement)

Reference: [Opening a Croatian Obrt: A Foreigner's 3-Month Battle with Bureaucracy](https://total-croatia-news.com/lifestyle/opening-a-croatian-obrt-a-foreigner-s-3-month-battle-with-bureaucracy/)

### FiskAI's Value Proposition for Paušalni Obrt

**Primary Headline**: "Računovodstvo za paušalni obrt koje štedi sati mjesečno"
(Accounting for flat-rate businesses that saves hours monthly)

**Core Promise**: Reduce monthly administration from 5-10 hours to 1-2 hours

**Key Differentiators**:

- AI-powered OCR receipt scanning (expense automation)
- One-click accountant export packages (CSV/Excel/PDF)
- Automatic OIB validation and invoice numbering
- Real-time VAT threshold monitoring (60,000 EUR)
- Croatian fiscal compliance (JIR, ZKI, Fiskalizacija 2.0 ready)

## Hero Section Components

### Essential Elements

Located at: `src/app/(marketing)/for/pausalni-obrt/page.tsx:14-39`

1. **Badge** (Trust Indicator)
   - Icon: Shield
   - Text: "Posebno prilagođeno za paušalni obrt" (Specially adapted for flat-rate businesses)
   - Style: Blue background, blue text, rounded pill shape
   - Purpose: Immediate niche recognition and relevance signal

2. **Primary Headline**
   - Text: "Računovodstvo za paušalni obrt koje **štedi sate** mjesečno"
   - Word Count: 7 words (optimal for scannability)
   - Emphasis: "štedi sate" (saves hours) in blue color for attention
   - Structure: Benefit-driven, not feature-focused

3. **Subheadline**
   - Text: "Izradite račune, pratite troškove i pripremite podatke za knjigovođu bez slanja mailova i 'donosim fascikl'."
   - Purpose: Elaborates on primary benefit and addresses specific pain point
   - Emotional Hook: References the dreaded "donosim fascikl" (bringing folder) scenario

4. **Primary CTA**
   - Text: "Započni besplatno" (Start for free)
   - Action: Links to /register
   - Style: Blue button, prominent positioning
   - Risk Reduction: No credit card mentioned in button

5. **Secondary CTA**
   - Text: "Zatraži demo" (Request demo)
   - Action: Links to /contact
   - Style: Ghost button (white with border)
   - Purpose: Alternative for visitors wanting more information before committing

Reference: [Framer Blog: 9 landing page best practices for 2025](https://www.framer.com/blog/landing-page-best-practices/)

## Why Section (Benefits Highlight)

Located at: `src/app/(marketing)/for/pausalni-obrt/page.tsx:42-79`

### Structure

Rounded, bordered container with blue background serving as immediate value communication. 3-column grid layout (responsive to single column on mobile).

### 3 Core Benefits

1. **Štedi vrijeme** (Saves Time)
   - Icon: Clock (blue)
   - Quantified Promise: "5-10h → 1-2h mjesečno" (monthly)
   - Impact: 80% reduction in administrative time
   - Why it Matters: Time is the most precious resource for solo entrepreneurs

2. **Manje grešaka** (Fewer Errors)
   - Icon: Calculator (blue)
   - Features: Automatic invoice numbering, OIB validation, accurate VAT calculations
   - Why it Matters: Errors can trigger tax authority audits and penalties

3. **Jednostavan izvoz** (Simple Export)
   - Icon: Download (blue)
   - Format: CSV/Excel export with date filtering
   - Why it Matters: Eliminates "donosim fascikl" burden - a culturally resonant pain point

### Design Rationale

- Blue background creates visual separation from rest of page
- Icons provide visual scanning anchors
- Quantified benefits (5-10h → 1-2h) are more persuasive than vague claims
- Short, scannable text blocks for quick comprehension

Reference: [14 SaaS Landing Page Best Practices to Boost Conversion](https://landingi.com/landing-page/saas-best-practices/)

## Features Grid Section

Located at: `src/app/(marketing)/for/pausalni-obrt/page.tsx:82-197`

### Design Pattern

4 feature cards in 2x2 grid (responsive to single column on mobile). Each card includes:

- Icon (lucide-react, blue color)
- Title (large, bold)
- Subtitle (muted, descriptive)
- 4 checkmark bullets with specific features

### Feature Card 1: Izdavanje računa (Invoice Issuance)

**Icon**: FileText

**Key Features**:

- Automatska numeracija računa (serija, godina) - Automatic invoice numbering with series and year
- Hrvatski predlošci s potrebnim elementima - Croatian templates with required elements
- Slanje računa putem emaila (PDF) - Email sending with PDF
- Praćenje plaćenih/neplaćenih računa - Paid/unpaid tracking

**Why These Features Matter**: Paušalni obrt businesses must maintain KPR (Book of Turnover) with proper numbering and Croatian fiscal compliance. Manual invoice creation is time-consuming and error-prone.

### Feature Card 2: Praćenje troškova (Expense Tracking)

**Icon**: TrendingUp

**Key Features**:

- AI OCR skeniranje računa (fotografija → podaci) - AI OCR receipt scanning (photo → data)
- Automatska kategorizacija troškova - Automatic expense categorization
- Ručni unos troškova za papirnate račune - Manual entry for paper receipts
- Pregled po mjesecima/kvartalima - Monthly/quarterly view

**Why These Features Matter**: Expense documentation is critical for tax deductions. OCR eliminates manual data entry, while categorization simplifies quarterly reporting.

### Feature Card 3: Izvoz za knjigovođu (Accountant Export)

**Icon**: Download

**Key Features**:

- Kompletan izvoz u CSV/Excel formatu - Complete CSV/Excel export
- Filtriranje po datumu (mjesečno, kvartalno, godišnje) - Date filtering (monthly, quarterly, yearly)
- PDF računi kao prilozi - PDF invoices as attachments
- Pregled povezanih računa i troškova - Overview of linked invoices and expenses

**Why These Features Matter**: This directly addresses the "donosim fascikl" pain point. Digital, structured export eliminates physical folder delivery and email attachment chaos.

### Feature Card 4: Suradnja s knjigovođom (Accountant Collaboration)

**Icon**: Users

**Key Features**:

- Pozivnica za knjigovođu (besplatni pristup) - Accountant invitation (free access)
- Izrada "accountant package" za slanje - Creating accountant package for sending
- Audit trag: tko je što promijenio - Audit trail: who changed what
- Komunikacija kroz platformu - Platform-based communication

**Why These Features Matter**: Accountants need ongoing access to financial data. Collaboration features eliminate back-and-forth communication and ensure both parties see the same data.

## Monthly Workflow Section

Located at: `src/app/(marketing)/for/pausalni-obrt/page.tsx:200-224`

### Purpose

Visualizes the simplified 4-step monthly process that paušalni obrt users follow with FiskAI. Reduces cognitive load by breaking complex bookkeeping into digestible steps.

### 4-Step Process

1. **Izdajte račune** (Issue Invoices)
   - Icon: Numbered circle (1)
   - Sub-text: "Klijentima preko emaila" (To clients via email)

2. **Skenirajte troškove** (Scan Expenses)
   - Icon: Numbered circle (2)
   - Sub-text: "AI prepoznavanje podataka" (AI data recognition)

3. **Označite plaćeno** (Mark as Paid)
   - Icon: Numbered circle (3)
   - Sub-text: "Kada stigne uplata" (When payment arrives)

4. **Izvezite za knjigovođu** (Export for Accountant)
   - Icon: Numbered circle (4)
   - Sub-text: "Jedan klik za izvoz" (One click for export)

### Design Elements

- 4 equal-width columns (responsive to stacked layout on mobile)
- Blue circular badges with white numbers (visual progression)
- Centered text for symmetry and visual balance
- Muted sub-text provides context without overwhelming

### Psychological Impact

- Linear progression creates sense of simplicity
- Numbered steps reduce perceived complexity
- Each step has clear outcome, reducing anxiety about "what's next"

Reference: [How do you create a SaaS landing page that converts in 2025?](https://www.agence-synqro.fr/en/blog/saas-landing-page)

## Pricing Section

Located at: `src/app/(marketing)/for/pausalni-obrt/page.tsx:227-274`

### Design Strategy

Single pricing plan (not tiered comparison) to reduce decision paralysis for niche audience. Gradient background (blue-to-white) creates visual emphasis.

### Pricing Structure

**Plan Name**: Paušalni plan (Flat-rate plan)
**Price**: 39€ / mjesečno (monthly)
**Billing**: Monthly, no annual lock-in

### Price Positioning Rationale

- 39 EUR is psychologically below "40 EUR threshold" (anchoring effect)
- Monthly accountant fees in Croatia range 50-150 EUR for full service
- FiskAI at 39 EUR is positioned as "accounting assistant," not replacement
- ROI messaging: Save 8-9 hours monthly at ~5-10 EUR/hour value = 40-90 EUR saved

### Plan Features (5 Key Items)

1. **Do 50 računa mjesečno** (Up to 50 invoices monthly)
   - Sufficient for most paušalni obrt businesses (typical range: 10-30 monthly)
   - Overage handling mentioned in FAQ (1€ per invoice over 50)

2. **Neograničeno troškova (OCR uključen)** (Unlimited expenses with OCR)
   - High-value feature since expense tracking is time-intensive
   - OCR alone often costs 0.10-0.50 EUR per scan with competitors

3. **Izvoz za knjigovođu (CSV/Excel/PDF)** (Accountant export)
   - Core differentiator addressing "donosim fascikl" pain
   - No per-export fees unlike some competitors

4. **Email podrška unutar 24h** (Email support within 24 hours)
   - Trust signal: we're here to help
   - Realistic timeline (not "instant" overpromise)

5. **Besplatna 14-dnevna proba** (Free 14-day trial)
   - Risk reduction: try before committing
   - Standard SaaS trial length (not too short, not excessively long)

### Trust Signals

- "Bez ugovorne obveze" (No contractual obligation)
- "Možete otkazati bilo kada" (Can cancel anytime)
- "Nema kreditne kartice potrebne" (No credit card needed)

Reference: [51 High-Converting SaaS Landing Pages Experts Love [2025]](https://www.klientboost.com/landing-pages/saas-landing-page/)

## FAQ Section

Located at: `src/app/(marketing)/for/pausalni-obrt/page.tsx:277-321`

### Purpose

Address objections and concerns specific to paušalni obrt audience before they become conversion blockers. Questions chosen based on common pain points and hesitations.

### 4 FAQ Items

#### 1. Može li moj knjigovođa koristiti FiskAI? (Can my accountant use FiskAI?)

**Answer Summary**: Yes, free accountant invitation with read access, reporting, and platform communication.

**Why This Matters**: Paušalni obrt owners fear their accountant won't adopt new tools. Offering free accountant access removes this barrier.

**Objection Addressed**: "My accountant won't want to use this."

#### 2. Što ako premašim 50 računa mjesečno? (What if I exceed 50 invoices monthly?)

**Answer Summary**: Automatic notification and upgrade offer. Overage charge: 1€ per invoice up to 200 invoices max.

**Why This Matters**: Transparency builds trust. Users want to know costs won't explode unexpectedly.

**Objection Addressed**: "What if my business grows? Will I be penalized?"

#### 3. Kako izgleda izvoz za knjigovođu? (What does the accountant export look like?)

**Answer Summary**: ZIP file containing: CSV with invoices (number, date, client, amount, VAT), CSV with expenses, PDF copies of all invoices, monthly/quarterly summary table.

**Why This Matters**: Specificity reduces uncertainty. Users can visualize exactly what they're getting.

**Objection Addressed**: "Will my accountant accept this format?"

Reference: Implementation matches [reports-pausalni-obrt.md](reports-pausalni-obrt.md) export packages (00-SAZETAK.csv, 01-RACUNI.csv, 02-TROSKOVI.csv, 03-KPR.csv)

#### 4. Je li potrebna dugoročna obveza? (Is long-term commitment required?)

**Answer Summary**: No. Monthly subscription, cancel anytime without penalty. 14-day free trial included.

**Why This Matters**: Reduces perceived risk and commitment anxiety.

**Objection Addressed**: "What if I don't like it? Am I locked in?"

### Footer Contact Information

- Link to /contact page
- Phone number: +385 1 234 5678 (placeholder in current implementation)
- Purpose: Provides human touchpoint for users who prefer direct communication

Reference: [The Ultimate Guide to Landing Pages for Tax and Accounting Firms](https://www.countingworkspro.com/blog/the-ultimate-guide-to-landing-pages-for-tax-and-accounting-firms)

## Final CTA Section

Located at: `src/app/(marketing)/for/pausalni-obrt/page.tsx:324-338`

### Structure

Repeated call-to-action at bottom of page to capture visitors who scrolled through all content and are now ready to convert.

### Components

1. **Headline**: "Spremni za probu?" (Ready for a trial?)
2. **Social Proof**: "Pridružite se drugim paušalnim obrtnicima koji su već smanjili vrijeme potrošeno na računovodstvo za 80%."
   - Uses peer comparison (join others like you)
   - Repeats 80% time savings claim from earlier
3. **CTA Button**: "Započni besplatnu 14-dnevnu probu" (Start free 14-day trial)
4. **Trust Signals**: "Nema kreditne kartice potrebne • Možete otkazati bilo kada"

### Psychological Principles

- **Social Proof**: "others like you" creates FOMO (fear of missing out)
- **Repetition**: Reinforces key message (time savings) seen earlier in page
- **Risk Reversal**: No credit card + cancel anytime removes commitment fear
- **Action-Oriented**: "Spremni?" (Ready?) creates decision moment

## Design and Performance Considerations

### Responsive Design

- **Mobile-First**: All sections adapt to single-column layout on mobile
- **Touch Targets**: Buttons sized appropriately for touch interaction
- **Typography**: Font sizes scale appropriately across breakpoints

Reference: `src/app/(marketing)/for/pausalni-obrt/page.tsx` uses Tailwind responsive classes (`md:` prefixes)

### Performance Optimization

- **No Heavy Images**: Page relies on Lucide icons (SVG) for visual elements
- **Minimal Dependencies**: Only lucide-react and Next.js Link imported
- **Static Generation**: Next.js page can be pre-rendered at build time
- **No External API Calls**: Fully static content, no loading states

### Accessibility

- **Semantic HTML**: Proper heading hierarchy (h1, h2, h3)
- **Icon-Text Pairing**: Icons always accompanied by text labels
- **Color Contrast**: Blue-600 and blue-700 meet WCAG AA standards
- **Focus States**: Default Tailwind focus states maintained on interactive elements

### SEO Optimization

**Metadata** (`src/app/(marketing)/for/pausalni-obrt/page.tsx:5-8`):

- **Title**: "FiskAI — Za paušalni obrt"
- **Description**: "AI-first računovodstveni asistent posebno prilagođen za paušalni obrt u Hrvatskoj. Izdavanje računa, praćenje troškova i izvozi za knjigovođu."
- **Keywords**: Paušalni obrt, računovodstvo, Hrvatska, računi, troškovi

**Content Optimization**:

- Primary keyword "paušalni obrt" appears in title, headers, and body
- Croatian language content for local search
- Clear structure for search engine crawling

Reference: [Top SaaS Landing Page Optimization Trends Of 2025 Explained](https://www.wildnettechnologies.com/blogs/top-saas-landing-page-optimization-trends)

## Conversion Optimization Strategies

### Niche Targeting

Unlike generic accounting software landing pages, this page speaks exclusively to paušalni obrt businesses:

- Uses specific terminology (KPR, OIB, Fiskalizacija)
- Addresses unique pain points (donosim fascikl, 60,000 EUR threshold)
- References Croatian context (Hrvatska obrtnička komora, Porezna uprava)

**Expected Impact**: Niche landing pages convert 2-3x better than generic pages due to perceived relevance.

Reference: [27 best SaaS landing page examples (+ tips from the pros)](https://unbounce.com/conversion-rate-optimization/the-state-of-saas-landing-pages/)

### Social Proof Elements

While current implementation doesn't include testimonials or customer logos, page uses other trust signals:

- "Pridružite se drugim paušalnim obrtnicima" (Join other flat-rate entrepreneurs)
- Specific, quantified benefits (5-10h → 1-2h, 80% reduction)
- Croatian fiscal compliance mentions (builds trust with local audience)

**Future Enhancement Opportunity**: Add 2-3 testimonials from real paušalni obrt users near pricing section.

Reference: Testimonials can increase conversions by 34% - [Landing Page Conversion Rates — 40 Statistics](https://genesysgrowth.com/blog/landing-page-conversion-stats-for-marketing-leaders)

### Friction Reduction

Page minimizes conversion friction through:

- **No Credit Card Required**: Mentioned 3 times throughout page
- **14-Day Free Trial**: Low-risk entry point
- **Cancel Anytime**: No lock-in commitment
- **Secondary CTA**: "Zatraži demo" for visitors not ready to sign up
- **Transparent Pricing**: Single plan, clear feature list, no hidden fees

### A/B Testing Opportunities

Potential elements to test for conversion optimization:

1. **Headline Variations**:
   - Current: "Računovodstvo za paušalni obrt koje štedi sati mjesečno"
   - Test: "Paušalni obrt bez administracije i stresa"
   - Test: "Od 10 sati do 1 sata mjesečno"

2. **CTA Button Text**:
   - Current: "Započni besplatno"
   - Test: "Započni 14-dnevnu probu"
   - Test: "Kreiraj besplatni račun"

3. **Pricing Display**:
   - Current: 39€ / mjesečno
   - Test: Add annual option (12 months for price of 10)
   - Test: Show cost per day (1.30€ / dan)

4. **Hero Section**:
   - Current: Text-only with badge
   - Test: Add product screenshot or demo video
   - Test: Add animated GIF showing workflow

Reference: Only 17% of marketers actively A/B test despite 37% conversion gains - [Top SaaS Landing Page Optimization Trends Of 2025](https://www.wildnettechnologies.com/blogs/top-saas-landing-page-optimization-trends)

## Integration with FiskAI Ecosystem

### Entry Points to This Landing Page

1. **Marketing Website**: Main navigation → "Za paušalni obrt"
2. **Google Ads**: Targeted campaigns for keywords like "računovodstvo paušalni obrt"
3. **Content Marketing**: Blog posts about paušalni obrt → CTA to landing page
4. **Email Campaigns**: Nurture sequences to paušalni obrt lead list
5. **Social Media**: Facebook/LinkedIn ads targeting Croatian entrepreneurs

### Exit Points from This Landing Page

1. **Primary**: /register (registration page)
2. **Secondary**: /contact (contact form for demo requests)
3. **Header Navigation**: Access to main site navigation (features, pricing, etc.)

### Connection to Reports Feature

This landing page directly connects to [[reports-pausalni-obrt]] feature:

- **Landing Page Promise**: "Izvoz za knjigovođu u CSV/Excel formatu"
- **Feature Delivery**: Tax season pack export (00-SAZETAK.csv, 01-RACUNI.csv, 02-TROSKOVI.csv, 03-KPR.csv)
- **Landing Page Promise**: "VAT threshold monitoring"
- **Feature Delivery**: Real-time tracking of 60,000 EUR threshold with warning at 90%

This alignment ensures no "expectation vs. reality" gap that damages conversion and retention.

Reference: `/reports/pausalni-obrt` page → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:33`

## Competitive Positioning

### Croatian Market Context

Most accounting software in Croatia targets either:

- **Large Businesses**: Complex ERP systems (e.g., PANTHEON, MESOFT)
- **Generic Small Business**: Not specialized for paušalni obrt

**FiskAI's Niche**: Paušalni obrt-specific features and messaging create defensible market position.

### Key Differentiators Emphasized

1. **AI-Powered OCR**: Automates expense entry (most competitors require manual input)
2. **One-Click Export**: Eliminates "donosim fascikl" burden
3. **VAT Threshold Monitoring**: Proactive alerting at 90% of 60,000 EUR limit
4. **Accountant Collaboration**: Free accountant access (competitors charge per user)
5. **Croatian Compliance**: Fiskalizacija 2.0 ready, KPR generation, OIB validation

## Performance Metrics and KPIs

### Key Metrics to Track

1. **Conversion Rate**: Visitors → Trial Signups
   - **Target**: 6-10% (SaaS median is 3.8%, specialized pages perform better)
   - **Measurement**: Google Analytics goal tracking on /register confirmation

2. **Bounce Rate**: % of visitors leaving without interaction
   - **Target**: <40% (good for landing pages)
   - **Measurement**: Google Analytics bounce rate

3. **Time on Page**: Average session duration
   - **Target**: 2-3 minutes (indicates full page read-through)
   - **Measurement**: Google Analytics avg. session duration

4. **CTA Click Rate**: % clicking "Započni besplatno" or "Zatraži demo"
   - **Target**: 15-25% (includes non-converting clicks)
   - **Measurement**: Google Analytics event tracking on CTA buttons

5. **Scroll Depth**: % reaching pricing and FAQ sections
   - **Target**: 60%+ reach pricing, 40%+ reach FAQ
   - **Measurement**: Google Analytics scroll tracking

Reference: Benchmarks from [Landing Page Conversion Rates — 40 Statistics](https://genesysgrowth.com/blog/landing-page-conversion-stats-for-marketing-leaders)

### Success Indicators

- **20+ trial signups monthly** from this landing page alone
- **Conversion rate 2x higher** than generic marketing landing page
- **Low trial-to-paid churn** (indicates accurate expectation-setting)
- **Positive user feedback** mentioning "tai­lored for paušalni obrt"

## Dependencies

- **Depends on**:
  - [[auth-registration]] - Primary conversion destination → /register
  - [[marketing-contact]] - Secondary conversion destination → /contact
  - [[reports-pausalni-obrt]] - Feature delivery matching landing page promises
  - **Next.js**: Static page generation and routing → `src/app/(marketing)/for/pausalni-obrt/page.tsx`
  - **Lucide React**: Icon library for visual elements → Import from `lucide-react`
  - **Tailwind CSS**: Styling framework for responsive design

- **Depended by**:
  - **Marketing campaigns**: Google Ads, Facebook Ads, email campaigns
  - **Content marketing**: Blog posts and guides about paušalni obrt
  - **SEO strategy**: Organic traffic for "paušalni obrt" keywords

## Verification Checklist

- [ ] Landing page renders correctly at /for/pausalni-obrt
- [ ] Hero section displays badge, headline, subheadline, and CTAs
- [ ] "Why paušalni obrt loves FiskAI" section shows 3 benefits in grid layout
- [ ] 4 feature cards display with icons, titles, and checkmark lists
- [ ] Monthly workflow shows 4 numbered steps with descriptions
- [ ] Pricing section displays 39€/month with 5 feature bullets
- [ ] FAQ section shows 4 questions with detailed answers
- [ ] Final CTA section includes headline, social proof, button, and trust signals
- [ ] Primary CTA buttons link to /register
- [ ] Secondary CTA button links to /contact
- [ ] Page is fully responsive (mobile, tablet, desktop)
- [ ] All icons render correctly (lucide-react imports)
- [ ] No console errors or warnings in browser
- [ ] Page metadata includes correct title and description
- [ ] Color contrast meets WCAG AA standards
- [ ] All text is in Croatian language
- [ ] Phone number in FAQ footer is correct (update placeholder)
- [ ] Analytics tracking configured (Google Analytics, conversion events)
- [ ] Page loads in under 3 seconds on 3G connection
- [ ] No horizontal scroll on mobile devices
- [ ] Touch targets are minimum 44x44px for mobile
- [ ] Focus states visible for keyboard navigation

## Evidence Links

1. Pausalni Obrt landing page implementation → `src/app/(marketing)/for/pausalni-obrt/page.tsx:10`
2. Hero section with badge and CTAs → `src/app/(marketing)/for/pausalni-obrt/page.tsx:14-39`
3. Why section with 3 benefits → `src/app/(marketing)/for/pausalni-obrt/page.tsx:42-79`
4. Features grid with 4 cards → `src/app/(marketing)/for/pausalni-obrt/page.tsx:82-197`
5. Monthly workflow timeline → `src/app/(marketing)/for/pausalni-obrt/page.tsx:200-224`
6. Pricing section → `src/app/(marketing)/for/pausalni-obrt/page.tsx:227-274`
7. FAQ section → `src/app/(marketing)/for/pausalni-obrt/page.tsx:277-321`
8. Final CTA section → `src/app/(marketing)/for/pausalni-obrt/page.tsx:324-338`
9. Pausalni Obrt reports feature (linked feature) → `src/app/(dashboard)/reports/pausalni-obrt/page.tsx:33`
10. Page metadata configuration → `src/app/(marketing)/for/pausalni-obrt/page.tsx:5-8`

## External References

### Paušalni Obrt Context

1. [How to open and close an obrt in Croatia: Guide for 2025](https://www.expatincroatia.com/open-close-obrt-croatia/) - Comprehensive guide to paušalni obrt setup, requirements, and thresholds
2. [Opening a Croatian Obrt: A Foreigner's 3-Month Battle with Bureaucracy](https://total-croatia-news.com/lifestyle/opening-a-croatian-obrt-a-foreigner-s-3-month-battle-with-bureaucracy/) - Real-world pain points and challenges faced by paušalni obrt owners
3. [How to Register a Sole Proprietorship (Obrt) in Croatia](https://www.deel.com/blog/sole-proprietorship-croatia/) - Official requirements for KPR bookkeeping and tax obligations

### Landing Page Best Practices

4. [Framer Blog: 9 landing page best practices for 2025](https://www.framer.com/blog/landing-page-best-practices/) - Modern landing page design principles including hero sections and CTA optimization
5. [51 High-Converting SaaS Landing Pages Experts Love [2025]](https://www.klientboost.com/landing-pages/saas-landing-page/) - SaaS-specific conversion strategies with real examples and pricing section best practices
6. [27 best SaaS landing page examples (+ tips from the pros)](https://unbounce.com/conversion-rate-optimization/the-state-of-saas-landing-pages/) - Analysis of high-performing SaaS landing pages showing 2-3x conversion lift from niche targeting
7. [The Ultimate Guide to Landing Pages for Tax and Accounting Firms](https://www.countingworkspro.com/blog/the-ultimate-guide-to-landing-pages-for-tax-and-accounting-firms) - Industry-specific guidance for accounting software landing pages including FAQ best practices

### Conversion Optimization Research

8. [Top SaaS Landing Page Optimization Trends Of 2025 Explained](https://www.wildnettechnologies.com/blogs/top-saas-landing-page-optimization-trends) - 2025 trends including AI personalization (40% conversion increase) and A/B testing impact (37% gains)
9. [Landing Page Conversion Rates — 40 Statistics Every Marketing Leader Should Know in 2025](https://genesysgrowth.com/blog/landing-page-conversion-stats-for-marketing-leaders) - Benchmark data showing SaaS median of 3.8% conversion rate and testimonial impact (34% increase)
10. [14 SaaS Landing Page Best Practices to Boost Conversion](https://landingi.com/landing-page/saas-best-practices/) - Comprehensive best practices for benefit-driven messaging and social proof placement
