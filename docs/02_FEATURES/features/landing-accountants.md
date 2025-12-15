# Feature: Accountants Landing Page (F106)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 11

## Purpose

The Accountants Landing Page is a targeted marketing page designed to attract and convert Croatian accountants (knjigovođe i računovode) to use FiskAI for client collaboration. The page communicates FiskAI's value proposition specifically for accounting professionals, emphasizing how it streamlines client data collection, reduces manual data entry by 70%, and enables accountants to scale their practice without hiring additional staff. This is a low-complexity marketing feature with a clear call-to-action for free accountant registration.

## User Entry Points

| Type | Path             | Evidence                                                                |
| ---- | ---------------- | ----------------------------------------------------------------------- |
| Page | /for/accountants | `src/app/(marketing)/for/accountants/page.tsx:1`                        |
| Link | /pricing         | Accountant section with link `src/app/(marketing)/pricing/page.tsx:228` |

## Core Flow

### Landing Page Visit Flow

1. Accountant discovers FiskAI through:
   - Direct marketing campaigns targeting accounting professionals
   - Referral from existing clients or other accountants
   - Link from pricing page accountant section
   - SEO: Searches for "accounting software Croatia" or similar
2. User navigates to /for/accountants route
3. Next.js renders page from `src/app/(marketing)/for/accountants/page.tsx:10`
4. System displays Croatian-language content optimized for accountants
5. Page includes hero section with problem/solution messaging
6. Value proposition section highlights time savings and data quality
7. Features grid showcases accountant-specific capabilities
8. Pricing section emphasizes free access for accountants
9. Case study demonstrates real-world results
10. Multiple CTAs guide to registration or demo booking

### Conversion Flow

1. Accountant views landing page content
2. System presents clear value proposition: "Suradnja s klijentima bez 'donosim fascikl'"
3. Accountant reads benefits:
   - 70% less processing time
   - Clean exports instead of receipt photos
   - Verified data with AI OCR checks
4. Accountant sees free pricing tier (0€ forever)
5. Accountant clicks primary CTA: "Registrirajte se za besplatni pristup"
6. System redirects to /register with accountant context
7. Alternative: Accountant clicks "Dogovori demo za ured" for larger firms
8. System redirects to /contact for demo booking

## Key Sections

### Hero Section

**Location**: `src/app/(marketing)/for/accountants/page.tsx:14-39`

**Components**:

- Badge: "Posebno prilagođeno za knjigovođe" with Users icon
- Headline: "Suradnja s klijentima bez 'donosim fascikl'"
  - Uses emotional language addressing accountant pain point
  - References common problem: clients bringing messy folders of receipts
- Subheadline: "Vaši klijenti šalju uredne izvozne pakete, vi dobivate točne podatke i smanjujete vrijeme obrade za 70%"
  - Quantifies value: 70% time reduction
  - Emphasizes clean data exports
- Primary CTA: "Registrirajte se za besplatni pristup" → /register
- Secondary CTA: "Dogovori demo za ured" → /contact
  - Lower friction option for larger accounting firms

### Value Proposition Section

**Location**: `src/app/(marketing)/for/accountants/page.tsx:42-79`

**Design**: Blue background card with 3-column grid

**Value Props**:

1. **70% less processing time**
   - Icon: Clock (blue)
   - Description: "Uredni izvozi umjesto fotografija računa"
   - Addresses: Manual data entry burden

2. **Accurate and verified data**
   - Icon: Shield (blue)
   - Description: "AI OCR provjera, automatska numeracija računa"
   - Addresses: Data quality and accuracy concerns

3. **Client retention**
   - Icon: TrendingUp (blue)
   - Description: "Olakšavate im administraciju, oni ostaju kod vas"
   - Addresses: Client churn and competitive advantage

**Reference**: [Value Proposition Best Practices](https://unbounce.com/landing-page-articles/the-anatomy-of-a-landing-page/)

### Features Grid

**Location**: `src/app/(marketing)/for/accountants/page.tsx:82-253`

**Layout**: 3-column grid (responsive 2-column on tablet, 1-column on mobile)

**Feature Cards**:

1. **Uredni izvozi** (Clean Exports)
   - Icon: Download
   - Benefits: CSV/Excel exports with attachments, PDF copies, filtering by month/quarter, automated email delivery
   - Evidence: `src/lib/reports/accountant-export.ts:72-238`

2. **Pristup klijentima** (Client Access)
   - Icon: Users
   - Benefits: Free access for accountants, view all clients in one place, platform communication, change notifications
   - Evidence: `src/app/(dashboard)/accountant/page.tsx:46-456`

3. **Izvještaji i analize** (Reports and Analytics)
   - Icon: BarChart
   - Benefits: Cumulative client overview, data completeness checks, audit trail of changes, missing data alerts
   - Evidence: `src/app/(dashboard)/reports/page.tsx:1`

4. **Sigurnost i kontrola** (Security and Control)
   - Icon: Shield
   - Benefits: Multi-tenant data isolation, accounting standards compliance, 11+ year archiving, least privilege access
   - Evidence: GDPR compliance, tenant isolation in database schema

5. **E-računi i fiskalizacija** (E-Invoices and Fiscalization)
   - Icon: FileText
   - Benefits: E-invoice support (EN 16931), Fiscalization 2.0 integration, XML export for tax authority, invoice compliance checks
   - Evidence: `src/app/(dashboard)/e-invoices/page.tsx:1`

6. **Efikasnost ureda** (Office Efficiency)
   - Icon: TrendingUp
   - Benefits: Process multiple clients simultaneously, automated workflows, integrations with systems, API for custom applications
   - Evidence: API architecture and automation features

**Design Pattern**: Feature-benefit cards with icon, title, description, and 4 checkmark bullets each

### Pricing Section for Accountants

**Location**: `src/app/(marketing)/for/accountants/page.tsx:256-303`

**Layout**: Centered card with gradient blue background

**Pricing Details**:

- Title: "Besplatno za knjigovođe" (Free for accountants)
- Price: **0€ / zauvijek** (forever)
- Badge: "Knjigovođa plan"
- Description: "Besplatni pristup za sve certificirane knjigovođe"

**Included Features**:

- Unlimited number of clients
- Access to all exports and reports
- Client communication
- Cumulative overviews
- Dedicated account manager for offices

**CTA**: "Registrirajte se kao knjigovođa" → /register

**Verification Note**: "Potrebna verifikacija OIB-a i certifikata • Za registrirane računovodstvene uredove"

**Business Model**: Accountants get free access; their clients pay for subscriptions

- Alignment: Accountants recommend FiskAI to clients
- Network effect: More clients → more value for accountants
- Revenue source: Client subscriptions, not accountant fees

### Client Onboarding Process

**Location**: `src/app/(marketing)/for/accountants/page.tsx:306-330`

**Layout**: 4-step process with numbered icons

**Steps**:

1. **Registracija** - Free accountant account
2. **Poziv klijenata** - Send invitations from app
3. **Klijent koristi FiskAI** - Clients issue invoices, scan expenses
4. **Vi dobivate izvoz** - Automatic or on-demand exports

**Purpose**: Clarifies onboarding process, reduces friction for accountants hesitant about setup complexity

### Case Study Section

**Location**: `src/app/(marketing)/for/accountants/page.tsx:333-389`

**Subject**: Ana K. - Accounting office owner with 15 clients

**Before FiskAI**:

- Receipt photos on WhatsApp
- Manual transcription to Excel (3-5h per client monthly)
- Errors in transcription (5-10% of invoices)

**After FiskAI**:

- Clean CSV/Excel exports with PDF attachments
- Automatic data entry (30min per client)
- Errors < 1% (AI verification)

**Results**: 70% time reduction, errors nearly eliminated

**Design**: Two-column layout with testimonial quote and before/after comparison

**Social Proof Elements**:

- Real name with initials (Ana K.)
- Avatar with initials in circle
- Specific metrics (not vague claims)
- Problem-solution narrative structure

**Reference**: [Landing Page Social Proof](https://www.justinmind.com/ui-design/landing-page-examples)

### Final CTA Section

**Location**: `src/app/(marketing)/for/accountants/page.tsx:392-414`

**Headline**: "Spremni za modernu suradnju s klijentima?"

**Description**: "Pridružite se računovodstvenim uredima koji su digitalizirali suradnju s klijentima i povećali kapacitet bez zapošljavanja"

**CTAs**:

- Primary: "Besplatna registracija za knjigovođe" → /register
- Secondary: "Demo za računovodstvene uredove" → /contact

**Additional Value**: "Za veće uredove nudimo besplatnu obuku i podršku pri implementaciji"

## Page Metadata

**Location**: `src/app/(marketing)/for/accountants/page.tsx:5-8`

**SEO Optimization**:

- Title: "FiskAI — Za knjigovođe i računovode"
- Description: "Suradnja s klijentima na jednom mjestu: uredni izvozi, audit tragovi i automatizirani prenos podataka."
- Language: Croatian (target market)
- Keywords implied: knjigovođe, računovode, izvozi, audit, automatizacija

**Meta Tags Best Practices**:

- Title length: 42 characters (optimal for Google)
- Description: 104 characters (within 150-160 character limit)
- Action-oriented language
- Key benefits mentioned

**Reference**: [SEO Meta Tags Best Practices](https://www.fermatcommerce.com/post/landing-page-design)

## Design Elements

### Icons Used

**Library**: lucide-react

**Icons** (from `src/app/(marketing)/for/accountants/page.tsx:3`):

- CheckCircle2: Feature checkmarks (green)
- Users: Accountant badge, client management
- FileText: Documents and reports
- Download: Export functionality
- Shield: Security features
- BarChart: Analytics and reports
- Clock: Time savings
- TrendingUp: Growth and efficiency

**Color System**:

- Primary CTA: bg-blue-600 (high contrast)
- Secondary CTA: border-gray-300 (lower emphasis)
- Success indicators: text-green-600 (positive outcomes)
- Trust signals: bg-blue-100 (light blue backgrounds)

### Typography

**Hierarchy**:

- H1: text-4xl md:text-5xl (Hero headline)
- H2: text-2xl to text-3xl (Section headings)
- H3: text-xl (Feature card titles)
- Body: text-lg for main value prop, text-sm for descriptions
- Small: text-xs for supporting text

**Font Weight**:

- Headlines: font-semibold to font-bold
- Feature titles: font-semibold
- Body: regular (default)

**Color Variables**:

- Primary text: default text color
- Muted text: var(--muted)
- Emphasis: text-blue-700 (links and highlights)

### Spacing and Layout

**Container**: mx-auto max-w-6xl px-4 py-14 md:px-6

- Max width: 1152px (6xl)
- Horizontal padding: 16px mobile, 24px desktop
- Vertical padding: 56px (py-14)

**Section Spacing**: mb-12 to mb-16 (48-64px between sections)

**Grid Systems**:

- Features: grid-cols-2 lg:grid-cols-3 (responsive)
- Value props: grid-cols-3 (3 columns on desktop)
- Onboarding: grid-cols-4 (4-step process)

**Responsive Breakpoints**:

- Mobile: base (< 768px)
- Tablet: md (≥ 768px)
- Desktop: lg (≥ 1024px)

## Related Features

### Client-Facing Features Referenced

1. **Reports Export** → `docs/02_FEATURES/features/reports-accountant-export.md`
   - CSV/Excel exports with PDF attachments
   - Date range filtering
   - Tax season pack generation

2. **Accountant Dashboard** → `src/app/(dashboard)/accountant/page.tsx:46`
   - Client overview
   - Pending actions
   - Quick reports access

3. **E-Invoicing** → `src/app/(dashboard)/e-invoices/page.tsx:1`
   - EN 16931 compliance
   - UBL format support
   - Invoice validation

4. **KPR Report** → `docs/02_FEATURES/features/reports-kpr.md`
   - Croatian accounting book (Knjiga Primitaka i Izdataka)
   - Required for paušalni obrt clients

### Pricing Integration

**Link to Pricing Page**: The pricing page has a dedicated accountant section

- Location: `src/app/(marketing)/pricing/page.tsx:191-238`
- Features: Same 0€ pricing, feature highlights
- CTA links back to /for/accountants: `src/app/(marketing)/pricing/page.tsx:228`
- Creates circular reference for discovery

## Target Audience

### Primary Persona: Small Accounting Office Owner

**Profile**:

- 3-20 clients (small businesses, paušalni obrt)
- Currently uses Excel or basic accounting software
- Receives client data via WhatsApp, email, or physical folders
- Spends 3-5 hours monthly per client on data entry
- Pain point: Manual transcription errors and time consumption

**Value Props**:

- Free access (no software cost)
- 70% time savings (primary quantified benefit)
- Reduced errors (quality improvement)
- Professional client service (competitive advantage)

### Secondary Persona: Medium Accounting Firm

**Profile**:

- 20-100 clients across multiple staff members
- Uses traditional accounting software (e.g., Pantheon)
- Needs standardized client data collection
- Pain point: Client data inconsistency, onboarding complexity

**Value Props**:

- Dedicated account manager
- Free training and implementation support
- Standardized workflows across all clients
- Scalability without hiring

**CTA**: "Dogovori demo za ured" - Demo call for larger implementations

## Conversion Optimization

### Multiple CTA Placements

**CTA Count**: 6 conversion opportunities

1. Hero section - Primary and secondary buttons
2. Pricing section - "Registrirajte se kao knjigovođa"
3. Final section - "Besplatna registracija za knjigovođe"
4. Final section - "Demo za računovodstvene uredove" (alternative)

**CTA Text Analysis**:

- Action-oriented verbs: "Registrirajte se", "Dogovori"
- Benefit-focused: "besplatni pristup", "besplatna proba"
- Urgency: None (low-pressure approach appropriate for B2B)

**Reference**: [CTA Best Practices](https://moosend.com/blog/landing-page-best-practices/)

### Trust Signals

**Explicit Trust Signals**:

- "Besplatni pristup za sve certificirane knjigovođe" (verification required)
- "Dedicated account manager za uredove" (personalized support)
- Case study with real name and metrics (social proof)
- 11+ year archiving (compliance)
- GDPR compliance mentioned

**Implicit Trust Signals**:

- Professional Croatian language (native market understanding)
- Specific accounting terminology (domain expertise)
- EN 16931 and Fiscalization 2.0 mentioned (regulatory knowledge)
- Croatian accounting book (KPR) support (local compliance)

**Missing Trust Signals** (opportunities):

- No client logos (could add accounting firm logos)
- No certification badges (could add relevant certifications)
- No testimonial photos (uses initials only)

**Reference**: [Trust Signal Impact](https://www.site123.com/learn/integrating-trust-signals-on-your-landing-page-to-boost-credibility)

## Croatian Market Specific Features

### Language and Localization

**Language**: 100% Croatian (no English fallbacks)

**Cultural Adaptations**:

- "donosim fascikl" - Common phrase accountants hear from clients (bringing folders)
- Paušalni obrt focus - Dominant business structure in Croatia
- PDV (VAT) terminology - Croatian tax system
- OIB verification - Croatian tax ID system

**Regulatory References**:

- Knjiga Primitaka i Izdataka (KPR) - Required accounting book
- Fiscalization 2.0 - Croatian tax authority system
- EN 16931 - European e-invoicing standard
- 11+ year archiving - Croatian accounting retention requirement

### Competitive Positioning

**Traditional Competitors**: Pantheon, SAP, Excel-based workflows

**FiskAI Differentiation**:

- Modern cloud-based solution (vs. installed software)
- Mobile-first for clients (vs. desktop-only)
- Free for accountants (vs. per-user licensing)
- AI-powered data extraction (vs. manual entry)
- Built for Croatian market (vs. international tools requiring adaptation)

## Performance Considerations

### Page Weight

**Estimated Load Time**: < 2 seconds on 3G

**Assets**:

- Icons: Loaded from lucide-react (tree-shaken, minimal bundle)
- No images on page (icon-only design)
- No custom fonts (system fonts via Tailwind)
- No video embeds

**Optimization Techniques**:

- Server-side rendering (Next.js page component)
- Static generation at build time (no API calls)
- Minimal JavaScript (mostly static content)

**Reference**: [Landing Page Performance](https://www.fermatcommerce.com/post/landing-page-design)

### Mobile Responsiveness

**Breakpoints Used**:

- sm: 640px (mobile landscape)
- md: 768px (tablet)
- lg: 1024px (desktop)

**Mobile-Specific Adjustments**:

- Hero text: text-4xl (mobile) → text-5xl (desktop)
- Grid layouts: cols-1 (mobile) → cols-2/3 (desktop)
- CTA buttons: flex-col (mobile) → flex-row (desktop)
- Padding: px-4 (mobile) → px-6 (desktop)

**Touch-Friendly Design**:

- Button height: py-3 (48px recommended for touch targets)
- Adequate spacing between interactive elements
- No hover-only interactions

**Reference**: [Mobile-First Best Practices](https://landingi.com/landing-page/41-best-practices/)

## A/B Testing Opportunities

### Potential Test Variations

1. **Headline Testing**:
   - Current: "Suradnja s klijentima bez 'donosim fascikl'"
   - Alternative: "Smanjite obradu podataka za 70%"
   - Hypothesis: Quantified benefit may convert better than emotional appeal

2. **CTA Text**:
   - Current: "Registrirajte se za besplatni pristup"
   - Alternative: "Počnite besplatno danas"
   - Hypothesis: Shorter, more action-oriented may increase clicks

3. **Social Proof Placement**:
   - Current: Case study near bottom
   - Alternative: Move case study to hero section
   - Hypothesis: Early social proof may reduce bounce rate

4. **Pricing Visibility**:
   - Current: 0€ pricing midway down page
   - Alternative: "Besplatno za knjigovođe" badge in hero
   - Hypothesis: Addressing price objection earlier may improve engagement

**Reference**: [A/B Testing Landing Pages](https://wpforms.com/best-landing-page-best-practices-that-convert/)

## Dependencies

**Depends on**:

- [[auth-registration]] - Registration flow endpoint → `src/app/(auth)/register/page.tsx:1`
- [[marketing-contact]] - Contact form for demo requests → `src/app/(marketing)/contact/page.tsx:1`
- [[reports-accountant-export]] - Export features referenced → `docs/02_FEATURES/features/reports-accountant-export.md`
- [[accountant-dashboard]] - Accountant workspace referenced → `src/app/(dashboard)/accountant/page.tsx:46`

**Depended by**:

- [[marketing-pricing]] - Pricing page links to accountant landing → `src/app/(marketing)/pricing/page.tsx:228`
- [[marketing-landing]] - Main landing may reference accountant solution

## Integrations

### External Integrations

None - This is a static marketing page with no external API calls.

### Internal Links

**Navigation Targets**:

- /register - Primary conversion path (6 links)
- /contact - Secondary conversion path (3 links)

**Navigation Sources**:

- /pricing - Accountant section link
- Direct marketing campaigns
- SEO organic traffic

## Verification Checklist

- [ ] Page loads at /for/accountants route
- [ ] Meta title and description are correct for SEO
- [ ] Hero section displays clear value proposition
- [ ] Primary CTA links to /register
- [ ] Secondary CTA links to /contact
- [ ] All 6 feature cards display with icons and checkmarks
- [ ] Pricing section shows 0€ with feature list
- [ ] Case study displays with before/after comparison
- [ ] Final CTA section provides alternative conversion paths
- [ ] Mobile responsive design works on all screen sizes
- [ ] All icons render correctly from lucide-react
- [ ] Croatian language content is grammatically correct
- [ ] No broken links to /register or /contact
- [ ] Page loads in < 2 seconds on 3G
- [ ] Accessibility standards met (WCAG 2.1 Level AA)
- [ ] Touch targets are at least 44x44px on mobile

## Evidence Links

1. Main page component → `src/app/(marketing)/for/accountants/page.tsx:10`
2. Page metadata → `src/app/(marketing)/for/accountants/page.tsx:5-8`
3. Hero section → `src/app/(marketing)/for/accountants/page.tsx:14-39`
4. Value proposition section → `src/app/(marketing)/for/accountants/page.tsx:42-79`
5. Features grid → `src/app/(marketing)/for/accountants/page.tsx:82-253`
6. Accountant pricing → `src/app/(marketing)/for/accountants/page.tsx:256-303`
7. Client onboarding process → `src/app/(marketing)/for/accountants/page.tsx:306-330`
8. Case study section → `src/app/(marketing)/for/accountants/page.tsx:333-389`
9. Final CTA section → `src/app/(marketing)/for/accountants/page.tsx:392-414`
10. Pricing page accountant section → `src/app/(marketing)/pricing/page.tsx:191-238`
11. Routes inventory → `docs/_meta/inventory/routes.json:234-238`
