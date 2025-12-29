# Feature: Pricing Page

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 16

## Purpose

Displays transparent pricing information for all FiskAI subscription plans including Paušalni Obrt (39 EUR/month), D.O.O. Standard (99 EUR/month), and Enterprise (199 EUR/month), plus a special free plan for accountants. The page provides detailed feature comparisons, pricing tiers, add-ons, FAQ section, and trust signals. It serves as a key conversion point in the marketing funnel, helping potential customers understand which plan best fits their business type and needs.

## User Entry Points

| Type       | Path                  | Evidence                                   |
| ---------- | --------------------- | ------------------------------------------ |
| Page       | /pricing              | `src/app/(marketing)/pricing/page.tsx:1`   |
| Navigation | Header nav link       | `src/app/(marketing)/layout.tsx:62`        |
| Footer     | Footer link           | `src/app/(marketing)/layout.tsx:103`       |
| Sitemap    | /sitemap.xml entry    | `src/app/sitemap.ts:13`                    |
| Routes     | Marketing route group | `docs/_meta/inventory/routes.json:294-297` |

## Core Flow

### View Pricing Page

1. User navigates to /pricing from homepage, navigation, or footer -> `src/app/(marketing)/layout.tsx:62,103`
2. Page renders with SEO metadata (title, description) -> `src/app/(marketing)/pricing/page.tsx:5-8`
3. Hero section displays main value proposition and 14-day trial badge -> `src/app/(marketing)/pricing/page.tsx:14-25`
4. Three main pricing tiers displayed in grid layout -> `src/app/(marketing)/pricing/page.tsx:28-188`
5. D.O.O. Standard plan highlighted as "Najpopularnije" (most popular) -> `src/app/(marketing)/pricing/page.tsx:79-84`
6. Each plan card shows price, features list with checkmarks, and CTA button -> `src/app/(marketing)/pricing/page.tsx:30-187`
7. Special accountant section displayed below main tiers -> `src/app/(marketing)/pricing/page.tsx:191-238`
8. Add-ons section shows optional extras (additional invoices, users, advanced OCR) -> `src/app/(marketing)/pricing/page.tsx:241-269`
9. FAQ section answers common questions about trials, limits, cancellation -> `src/app/(marketing)/pricing/page.tsx:272-310`
10. Trust signals section reinforces security, GDPR compliance, Croatian support -> `src/app/(marketing)/pricing/page.tsx:313-349`

### Pricing Tier: Paušalni Obrt

1. Card displays 39 EUR/month pricing -> `src/app/(marketing)/pricing/page.tsx:38-39`
2. Target market: paušalni obrt up to 50 invoices/month -> `src/app/(marketing)/pricing/page.tsx:42`
3. Features listed with green checkmarks -> `src/app/(marketing)/pricing/page.tsx:45-66`
   - Up to 50 invoices per month
   - Unlimited expenses (OCR included)
   - Export for accountant (CSV/Excel/PDF)
   - 1 user (owner)
   - Email support within 24h
4. CTA button links to /register -> `src/app/(marketing)/pricing/page.tsx:67-72`
5. Trust messaging: no credit card required, cancel anytime -> `src/app/(marketing)/pricing/page.tsx:73-75`

### Pricing Tier: D.O.O. Standard (Most Popular)

1. Highlighted card with blue gradient border and badge -> `src/app/(marketing)/pricing/page.tsx:79-84`
2. Card displays 99 EUR/month pricing -> `src/app/(marketing)/pricing/page.tsx:92-93`
3. Target market: d.o.o. and VAT obrt up to 200 invoices/month -> `src/app/(marketing)/pricing/page.tsx:96`
4. Extended features with business functionality -> `src/app/(marketing)/pricing/page.tsx:99-124`
   - Up to 200 invoices per month
   - VAT processing and JOPPD preparation
   - E-invoices (send/receive)
   - Up to 3 users
   - General ledger and financial reports
   - Phone support within 4h
5. CTA button offers 30-day free trial -> `src/app/(marketing)/pricing/page.tsx:125-130`
6. Free data migration for d.o.o. companies -> `src/app/(marketing)/pricing/page.tsx:131-133`

### Pricing Tier: Enterprise

1. Purple-themed card for enterprise segment -> `src/app/(marketing)/pricing/page.tsx:137-187`
2. Card displays 199 EUR/month pricing -> `src/app/(marketing)/pricing/page.tsx:145-146`
3. Target market: larger d.o.o. and company groups -> `src/app/(marketing)/pricing/page.tsx:149`
4. Premium features for large organizations -> `src/app/(marketing)/pricing/page.tsx:152-177`
   - Unlimited invoices
   - Multiple companies in group
   - Up to 10 users
   - Advanced accounting
   - Dedicated account manager
   - 99.9% SLA uptime
5. CTA links to /contact for sales consultation -> `src/app/(marketing)/pricing/page.tsx:178-183`
6. Custom implementation and team training offered -> `src/app/(marketing)/pricing/page.tsx:184-186`

### Accountant Plan (Free)

1. Special section with blue gradient background -> `src/app/(marketing)/pricing/page.tsx:191-238`
2. Badge shows "Besplatno za knjigovođe" (Free for accountants) -> `src/app/(marketing)/pricing/page.tsx:194-196`
3. Value proposition: collaborate with clients in one place -> `src/app/(marketing)/pricing/page.tsx:198-201`
4. Three key benefits displayed with icons -> `src/app/(marketing)/pricing/page.tsx:203-225`
   - Clean exports (CSV/Excel with PDF attachments)
   - Client access (direct communication)
   - 70% less work (less manual entry)
5. CTA links to /for/accountants -> `src/app/(marketing)/pricing/page.tsx:227-232`
6. Verification required: OIB and certificate -> `src/app/(marketing)/pricing/page.tsx:233-235`

### Add-ons Section

1. Three optional add-ons displayed in bordered cards -> `src/app/(marketing)/pricing/page.tsx:241-269`
2. Additional invoices: 1 EUR per invoice over limit -> `src/app/(marketing)/pricing/page.tsx:244-251`
   - For paušalni plan exceeding 50 invoices
3. Additional users: 15 EUR per user per month -> `src/app/(marketing)/pricing/page.tsx:252-259`
   - Available for all plans
4. Advanced AI OCR: 30 EUR per month -> `src/app/(marketing)/pricing/page.tsx:260-267`
   - Higher accuracy for complex invoices

### FAQ Section

1. Five common questions with detailed answers -> `src/app/(marketing)/pricing/page.tsx:272-310`
2. How free trial works: 14 days for all plans -> `src/app/(marketing)/pricing/page.tsx:276-280`
3. Exceeding invoice limits: automatic notification and upgrade option -> `src/app/(marketing)/pricing/page.tsx:283-287`
4. Cancellation policy: cancel anytime, access until end of paid period -> `src/app/(marketing)/pricing/page.tsx:290-294`
5. Long-term commitment: monthly billing, 10% discount for annual payment -> `src/app/(marketing)/pricing/page.tsx:297-301`
6. Payment options: cards, PayPal, bank transfer for Croatian companies -> `src/app/(marketing)/pricing/page.tsx:303-308`

### Trust Signals

1. Three trust indicators with icons -> `src/app/(marketing)/pricing/page.tsx:314-336`
2. No risk: 14-day free trial -> `src/app/(marketing)/pricing/page.tsx:315-321`
3. Data in EU: GDPR compliant, data stored in Germany -> `src/app/(marketing)/pricing/page.tsx:322-328`
4. Croatian support: phone and email within 24h -> `src/app/(marketing)/pricing/page.tsx:329-335`
5. Contact information: link to /contact and phone number -> `src/app/(marketing)/pricing/page.tsx:337-348`

## Key Modules

| Module               | Purpose                                  | Location                                   |
| -------------------- | ---------------------------------------- | ------------------------------------------ |
| Pricing Page         | Main pricing page component              | `src/app/(marketing)/pricing/page.tsx`     |
| Marketing Layout     | Navigation and footer with pricing links | `src/app/(marketing)/layout.tsx`           |
| Sitemap              | SEO sitemap including pricing page       | `src/app/sitemap.ts`                       |
| Billing Plans Config | Server-side plan definitions and pricing | `src/lib/billing/stripe.ts:26-48`          |
| Routes Inventory     | Route registry for pricing page          | `docs/_meta/inventory/routes.json:294-297` |

## Data

### Pricing Plan Configuration

Pricing information is defined in both the marketing page (display) and the billing system (enforcement):

- **Paušalni Plan** -> `src/app/(marketing)/pricing/page.tsx:30-76`
  - Price: 39 EUR/month -> `src/app/(marketing)/pricing/page.tsx:38`
  - Invoice limit: 50/month -> `src/app/(marketing)/pricing/page.tsx:48`
  - User limit: 1 -> `src/app/(marketing)/pricing/page.tsx:60`
  - Server config: -> `src/lib/billing/stripe.ts:27-33`

- **D.O.O. Standard Plan** -> `src/app/(marketing)/pricing/page.tsx:78-134`
  - Price: 99 EUR/month -> `src/app/(marketing)/pricing/page.tsx:92`
  - Invoice limit: 200/month -> `src/app/(marketing)/pricing/page.tsx:102`
  - User limit: 3 -> `src/app/(marketing)/pricing/page.tsx:114`
  - Server config: -> `src/lib/billing/stripe.ts:34-40`

- **Enterprise Plan** -> `src/app/(marketing)/pricing/page.tsx:136-187`
  - Price: 199 EUR/month -> `src/app/(marketing)/pricing/page.tsx:145`
  - Invoice limit: unlimited -> `src/app/(marketing)/pricing/page.tsx:155`
  - User limit: 10 -> `src/app/(marketing)/pricing/page.tsx:163`
  - Server config (Pro): -> `src/lib/billing/stripe.ts:41-47`

- **Accountant Plan** -> `src/app/(marketing)/pricing/page.tsx:191-238`
  - Price: Free -> `src/app/(marketing)/for/accountants/page.tsx:266-267`
  - Unlimited clients -> `src/app/(marketing)/for/accountants/page.tsx:274`
  - Verification required -> `src/app/(marketing)/pricing/page.tsx:234`

### Add-on Pricing

- **Extra Invoices**: 1 EUR per invoice over plan limit -> `src/app/(marketing)/pricing/page.tsx:246`
  - For paušalni plan above 50 invoices -> `src/app/(marketing)/pricing/page.tsx:250`
  - D.O.O. plan: 0.50 EUR per invoice over 200 -> `src/app/(marketing)/pricing/page.tsx:286`

- **Extra Users**: 15 EUR per user/month -> `src/app/(marketing)/pricing/page.tsx:254`
  - Available for all plans -> `src/app/(marketing)/pricing/page.tsx:258`

- **Advanced AI OCR**: 30 EUR/month -> `src/app/(marketing)/pricing/page.tsx:262`
  - Higher accuracy for complex invoices -> `src/app/(marketing)/pricing/page.tsx:266`

### Metadata

- Title: "FiskAI — Cijene i paketi" -> `src/app/(marketing)/pricing/page.tsx:6`
- Description: "Transparentne cijene za paušalni obrt, VAT obrt/d.o.o. i knjigovođe. Besplatna proba, bez ugovorne obveze." -> `src/app/(marketing)/pricing/page.tsx:7`

## Navigation & SEO

### Internal Links

- Homepage CTA: /pricing link from "Pogledaj cijene" -> `src/app/(marketing)/page.tsx:244`
- Header navigation: "Cijene" link -> `src/app/(marketing)/layout.tsx:62`
- Footer navigation: "Cijene" link -> `src/app/(marketing)/layout.tsx:103`
- Register CTAs: Multiple /register links for trials -> `src/app/(marketing)/pricing/page.tsx:68,126`
- Contact CTAs: /contact for enterprise and questions -> `src/app/(marketing)/pricing/page.tsx:179,340`
- Accountant landing: /for/accountants -> `src/app/(marketing)/pricing/page.tsx:228`

### External Links

- Phone link: +385 1 234 5678 -> `src/app/(marketing)/pricing/page.tsx:344`
- Email link: kontakt@fiskai.hr (from footer) -> `src/app/(marketing)/layout.tsx:94`

### SEO

- Sitemap priority: 0.7 -> `src/app/sitemap.ts:18`
- Change frequency: weekly -> `src/app/sitemap.ts:18`
- Last modified: dynamic (current date) -> `src/app/sitemap.ts:11`
- Canonical URL: /pricing -> `src/app/sitemap.ts:13`

## Evidence Links

1. **Pricing Page Component**: `src/app/(marketing)/pricing/page.tsx:1-333`
   - Main pricing page with all tiers, features, and CTAs

2. **Marketing Layout Navigation**: `src/app/(marketing)/layout.tsx:62`
   - Header navigation link to pricing page

3. **Marketing Layout Footer**: `src/app/(marketing)/layout.tsx:103`
   - Footer navigation link to pricing page

4. **Sitemap Entry**: `src/app/sitemap.ts:13`
   - SEO sitemap includes /pricing route

5. **Route Registry**: `docs/_meta/inventory/routes.json:294-297`
   - Pricing page registered in routes inventory

6. **Billing Plan Configuration**: `src/lib/billing/stripe.ts:26-48`
   - Server-side plan definitions matching pricing page

7. **Homepage Pricing CTA**: `src/app/(marketing)/page.tsx:244`
   - Homepage links to pricing page

8. **Paušalni Plan Details**: `src/app/(marketing)/pricing/page.tsx:30-76`
   - 39 EUR/month plan for paušalni obrt

9. **D.O.O. Standard Plan Details**: `src/app/(marketing)/pricing/page.tsx:78-134`
   - 99 EUR/month plan highlighted as most popular

10. **Enterprise Plan Details**: `src/app/(marketing)/pricing/page.tsx:136-187`
    - 199 EUR/month plan for larger organizations

11. **Accountant Plan Section**: `src/app/(marketing)/pricing/page.tsx:191-238`
    - Free plan for certified accountants

12. **Add-ons Pricing**: `src/app/(marketing)/pricing/page.tsx:241-269`
    - Extra invoices, users, and advanced OCR pricing

13. **FAQ Section**: `src/app/(marketing)/pricing/page.tsx:272-310`
    - Common questions about trials, limits, cancellation

14. **Trust Signals**: `src/app/(marketing)/pricing/page.tsx:313-349`
    - GDPR compliance, Croatian support, no-risk trial

15. **Accountant Landing Page**: `src/app/(marketing)/for/accountants/page.tsx:255-303`
    - Detailed accountant plan benefits and 0 EUR pricing

16. **Billing Settings Page**: `src/app/(dashboard)/settings/billing/page.tsx:1-53`
    - Authenticated version showing actual subscription and usage
