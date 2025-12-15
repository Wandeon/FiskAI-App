# Feature: Contact Form (F095)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 8

## Purpose

Provides a public-facing contact page where visitors can view FiskAI company information, contact details, and submit demo requests. The page serves as the primary contact point for potential customers, offering both passive contact information (email, phone, address) and an interactive demo request form for lead generation.

## User Entry Points

| Type       | Path     | Evidence                                  |
| ---------- | -------- | ----------------------------------------- |
| Navigation | /contact | `src/app/(marketing)/layout.tsx:64`       |
| Page       | /contact | `src/app/(marketing)/contact/page.tsx:10` |
| Link       | /contact | `src/app/(marketing)/page.tsx:33-36`      |
| Footer     | /contact | `src/app/(marketing)/layout.tsx:105`      |
| Sitemap    | /contact | `src/app/sitemap.ts:13`                   |
| SEO        | /contact | `src/app/robots.ts:15`                    |

## Core Flow

### Page Access Flow

1. User navigates to /contact via marketing header, footer, or homepage CTA → `src/app/(marketing)/contact/page.tsx:10`
2. Marketing layout renders with header navigation including "Kontakt" link → `src/app/(marketing)/layout.tsx:64`
3. Page displays company information and demo request form in two-column layout → `src/app/(marketing)/contact/page.tsx:20-158`
4. SEO metadata loads with title "FiskAI — Kontakt" → `src/app/(marketing)/contact/page.tsx:5-8`

### Contact Information Display Flow

1. Left column displays contact details card → `src/app/(marketing)/contact/page.tsx:22-81`
2. Company address shown: Radnička cesta 80, 10000 Zagreb → `src/app/(marketing)/contact/page.tsx:31-32`
3. General contact email: kontakt@fiskai.hr (for demos) → `src/app/(marketing)/contact/page.tsx:40-43`
4. Support email: podrska@fiskai.hr (for technical issues) → `src/app/(marketing)/contact/page.tsx:64-67`
5. Phone numbers displayed with clickable tel: links → `src/app/(marketing)/contact/page.tsx:52-55`
6. Response time information: Within 24h on business days → `src/app/(marketing)/contact/page.tsx:76`
7. Company details card displays legal information (OIB, IBAN, VAT ID) → `src/app/(marketing)/contact/page.tsx:83-92`

### Demo Request Form Flow (Not Implemented)

1. Right column displays demo request form → `src/app/(marketing)/contact/page.tsx:96-141`
2. Form fields shown (client-side only, no submission):
   - Name and surname (required) → `src/app/(marketing)/contact/page.tsx:103-104`
   - Email (required) → `src/app/(marketing)/contact/page.tsx:107-108`
   - Business type dropdown: paušalni obrt, VAT obrt, d.o.o., knjigovođa → `src/app/(marketing)/contact/page.tsx:111-118`
   - Monthly invoice count: 1-10, 11-50, 51-200, 200+ → `src/app/(marketing)/contact/page.tsx:121-128`
   - Optional message textarea → `src/app/(marketing)/contact/page.tsx:131-132`
3. Submit button displayed but non-functional (no action handler) → `src/app/(marketing)/contact/page.tsx:134-136`
4. Expected behavior message shown: "Kontaktirat ćemo vas unutar 24h" → `src/app/(marketing)/contact/page.tsx:137-139`

### Quick Actions Flow

1. "Već imate račun?" section provides login/register links → `src/app/(marketing)/contact/page.tsx:143-156`
2. Login link navigates to /login → `src/app/(marketing)/contact/page.tsx:149-151`
3. Register link navigates to /register with CTA styling → `src/app/(marketing)/contact/page.tsx:152-154`

### Emergency Support Flow

1. Bottom section displays emergency support banner → `src/app/(marketing)/contact/page.tsx:160-172`
2. Critical issue hotline: +385 1 234 5679 → `src/app/(marketing)/contact/page.tsx:166-169`
3. Emergency hours: Business days 9-17h, Saturday 10-14h → `src/app/(marketing)/contact/page.tsx:170`

## Key Modules

| Module          | Purpose                         | Location                                |
| --------------- | ------------------------------- | --------------------------------------- |
| ContactPage     | Main contact page component     | `src/app/(marketing)/contact/page.tsx`  |
| MarketingLayout | Marketing header/footer wrapper | `src/app/(marketing)/layout.tsx`        |
| MarketingNav    | Navigation with contact link    | `src/app/(marketing)/layout.tsx:60-65`  |
| MarketingFooter | Footer with contact details     | `src/app/(marketing)/layout.tsx:78-145` |
| sitemap         | SEO sitemap generation          | `src/app/sitemap.ts`                    |
| robots          | Search engine indexing rules    | `src/app/robots.ts`                     |

## Data

### Static Content

#### Company Information

Contact page displays static company details → `src/app/(marketing)/contact/page.tsx:83-92`

- **Company name**: Metrica d.o.o.
- **OIB**: 12345678901 (Croatian tax number)
- **IBAN**: HR1234567890123456789 (ZABA bank)
- **VAT ID**: HR12345678901
- **Legal status**: Registered in Croatian Court Registry

#### Contact Details

Multiple contact channels provided → `src/app/(marketing)/contact/page.tsx:24-79`

- **General email**: kontakt@fiskai.hr (demos, general inquiries)
- **Support email**: podrska@fiskai.hr (technical issues, in-app help)
- **Phone**: +385 1 234 5678 (business days 9-17h)
- **Emergency**: +385 1 234 5679 (critical issues, weekdays 9-17h, Saturday 10-14h)
- **Address**: Radnička cesta 80, 10000 Zagreb

### Form Fields (Not Persisted)

Demo request form includes → `src/app/(marketing)/contact/page.tsx:101-133`

1. **Ime i prezime** (Name): Text input, required
2. **Email**: Email input, required
3. **Tip poslovanja** (Business type): Select dropdown
   - paušalni-obrt (Flat-rate craft business)
   - vat-obrt (VAT craft business)
   - doo (Limited liability company)
   - accountant (Accountant/bookkeeper)
4. **Broj računa mjesečno** (Monthly invoices): Select dropdown
   - 1-10
   - 11-50
   - 51-200
   - 200+
5. **Poruka** (Message): Textarea, optional

## Implementation Status

### Currently Implemented

✅ **Static Contact Information Display**

- Company details card with legal information
- Contact methods (email, phone, address)
- Clickable mailto and tel links
- Response time expectations

✅ **Visual Form Structure**

- All form fields rendered
- Proper input types and labels
- Required field indicators
- Submit button UI

✅ **SEO Optimization**

- Page metadata with Croatian title/description → `src/app/(marketing)/contact/page.tsx:5-8`
- Sitemap inclusion with weekly update frequency → `src/app/sitemap.ts:13`
- Robots.txt allows indexing → `src/app/robots.ts:15`

✅ **Navigation Integration**

- Marketing header navigation link → `src/app/(marketing)/layout.tsx:64`
- Footer contact link → `src/app/(marketing)/layout.tsx:105`
- Homepage demo CTA → `src/app/(marketing)/page.tsx:33-36`

### Not Yet Implemented

❌ **Form Submission Handler**

- No onSubmit event handler on form
- No client-side form state management
- No validation logic
- No server action for processing submissions

❌ **Backend Processing**

- No API route for demo requests
- No database table for storing leads
- No email notification system for new demos
- No CRM integration

❌ **Lead Tracking**

- No analytics event tracking for form interactions
- No conversion tracking (though marketing analytics prepared → `src/lib/marketing-analytics.ts:24-27,88-108`)
- No A/B testing capabilities

❌ **Form Validation**

- No email format validation
- No required field enforcement
- No error message display
- No success confirmation

## Dependencies

### Depends On

- **Marketing Layout**: Header and footer wrapper → `src/app/(marketing)/layout.tsx`
- **Next.js Metadata**: SEO title and description → `src/app/(marketing)/contact/page.tsx:5-8`
- **Lucide React Icons**: Mail, Phone, MapPin, Clock, MessageSquare → `src/app/(marketing)/contact/page.tsx:3`

### Prepared Integrations (Not Active)

- **Marketing Analytics**: Demo tracking functions exist but not wired → `src/lib/marketing-analytics.ts:24-27,88-108`
  - `DEMO_REQUEST_CLICKED` event defined
  - `DEMO_FORM_STARTED` event defined
  - `DEMO_FORM_COMPLETED` event defined
  - `trackDemoRequest()` function available
- **Contact Form Tracking**: Analytics event ready → `src/lib/marketing-analytics.ts:182-190`
  - `CONTACT_FORM_SUBMITTED` event defined
  - `trackContactFormSubmission()` function available

## Integrations

### Internal Integrations

#### Marketing Navigation

Contact page linked from multiple marketing locations:

1. **Header navigation** → `src/app/(marketing)/layout.tsx:64`

   ```tsx
   <NavLink href="/contact">Kontakt</NavLink>
   ```

2. **Footer navigation** → `src/app/(marketing)/layout.tsx:105`

   ```tsx
   <NavLink href="/contact">Kontakt</NavLink>
   ```

3. **Homepage CTA** → `src/app/(marketing)/page.tsx:32-37`

   ```tsx
   <Link href="/contact">Zatraži demo</Link>
   ```

4. **Footer company info** → `src/app/(marketing)/layout.tsx:88-96`
   - Displays same company details as contact page
   - Provides email and phone with clickable links

#### SEO Integration

Contact page optimized for search engines:

1. **Sitemap entry** → `src/app/sitemap.ts:13`
   - Included in routes array
   - Weekly change frequency
   - Priority: 0.7 (high for marketing page)

2. **Robots.txt allowlist** → `src/app/robots.ts:15`
   - Explicitly allowed for crawling
   - No disallow rules apply

3. **Metadata** → `src/app/(marketing)/contact/page.tsx:5-8`
   - Title: "FiskAI — Kontakt"
   - Description: "Kontaktirajte FiskAI tim za demo, beta program ili podršku."

### External Integrations

None currently implemented. When form submission is added, likely integrations:

- **Email service** (e.g., Resend, SendGrid) for demo notifications
- **CRM** (e.g., HubSpot, Pipedrive) for lead management
- **Analytics** (e.g., Google Analytics, Plausible) for conversion tracking
- **Slack/Discord** for internal team notifications

## Future Enhancements

### High Priority

1. **Form Submission Implementation**
   - Add server action to process demo requests
   - Create database table for lead storage
   - Implement email notifications to sales team
   - Add success/error feedback to users

2. **Form Validation**
   - Add Zod validation schema
   - Implement client-side validation with react-hook-form
   - Display field-level error messages
   - Prevent invalid submissions

3. **Analytics Integration**
   - Wire up marketing analytics events
   - Track form start, completion, abandonment
   - Monitor conversion rates by business type
   - Track demo request sources

### Medium Priority

4. **Lead Management**
   - CRM integration for automatic lead creation
   - Internal notification system (email/Slack)
   - Lead assignment workflow
   - Follow-up scheduling

5. **Enhanced UX**
   - Auto-save form progress to localStorage
   - Multi-step form with progress indicator
   - Calendar integration for demo scheduling
   - Instant confirmation email to requester

6. **Spam Prevention**
   - Add CAPTCHA or honeypot field
   - Rate limiting by IP address
   - Email verification for submissions
   - Disposable email detection

### Low Priority

7. **A/B Testing**
   - Test different form layouts
   - Experiment with field requirements
   - Compare CTA copy variations
   - Optimize conversion rates

8. **Localization**
   - English version of contact page
   - Multi-language demo request handling
   - International phone number support

## Verification Checklist

### Page Access

- [ ] User can access /contact from marketing header "Kontakt" link
- [ ] User can access /contact from footer navigation
- [ ] User can access /contact from homepage "Zatraži demo" button
- [ ] Page loads with correct metadata (title, description)
- [ ] Page is indexed by search engines (sitemap, robots.txt)

### Contact Information Display

- [ ] Company address displays correctly
- [ ] General email (kontakt@fiskai.hr) is clickable mailto link
- [ ] Support email (podrska@fiskai.hr) is clickable mailto link
- [ ] Phone number (+385 1 234 5678) is clickable tel link
- [ ] Emergency number (+385 1 234 5679) is clickable tel link
- [ ] Business hours displayed for each contact method
- [ ] Response time expectations shown (24h business days)
- [ ] Company details card shows OIB, IBAN, VAT ID
- [ ] Legal status information displayed

### Demo Request Form

- [ ] Form displays all required fields with labels
- [ ] Name field accepts text input
- [ ] Email field has email input type
- [ ] Business type dropdown shows all 4 options
- [ ] Invoice count dropdown shows all 4 ranges
- [ ] Message textarea accepts multi-line input
- [ ] Required fields marked with asterisk (\*)
- [ ] Submit button displays with correct styling
- [ ] Expected response message shown below button

### Quick Actions

- [ ] "Već imate račun?" section displays
- [ ] Login link navigates to /login
- [ ] Register link navigates to /register with CTA styling
- [ ] Links have appropriate hover states

### Emergency Support

- [ ] Emergency banner displays at bottom of page
- [ ] Emergency phone number is clickable
- [ ] Emergency hours displayed correctly
- [ ] Banner has distinctive styling (blue background)
- [ ] Critical issue criteria explained

### Responsive Design

- [ ] Two-column layout on desktop (md breakpoint)
- [ ] Single-column stack on mobile
- [ ] Form fields full-width and touch-friendly
- [ ] Clickable elements meet 44px minimum touch target
- [ ] Text remains readable at all breakpoints
- [ ] Icons scale appropriately

### SEO & Performance

- [ ] Page metadata matches content
- [ ] All links use semantic HTML (<a> tags)
- [ ] Images have alt text (if added in future)
- [ ] Page loads in under 2 seconds
- [ ] No console errors or warnings
- [ ] Lighthouse accessibility score >90

## Evidence Links

1. `src/app/(marketing)/contact/page.tsx:10-175` - Main contact page component with all content sections
2. `src/app/(marketing)/layout.tsx:64` - Marketing header navigation with "Kontakt" link
3. `src/app/(marketing)/layout.tsx:105` - Footer navigation with contact link
4. `src/app/(marketing)/page.tsx:32-37` - Homepage "Zatraži demo" CTA linking to contact
5. `src/app/sitemap.ts:13` - Sitemap entry for /contact route with SEO settings
6. `src/app/robots.ts:15` - Robots.txt allows indexing of /contact page
7. `src/lib/marketing-analytics.ts:24-27,88-108` - Prepared demo tracking analytics (not yet wired)
8. `docs/_meta/inventory/routes.json:126-130` - Route registry entry confirming /contact page exists
