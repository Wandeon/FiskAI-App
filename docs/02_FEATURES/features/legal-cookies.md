# Feature: Cookie Policy Page (F099)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 10

## Purpose

Provides a comprehensive, GDPR-compliant cookie policy page at /cookies that informs users about the cookies and tracking technologies used by FiskAI. The page serves as a legal requirement under EU GDPR and ePrivacy Directive, ensuring transparency about data collection practices, cookie types, third-party services, and user control mechanisms. This document satisfies regulatory obligations for Croatian and EU users while maintaining trust through clear disclosure of all tracking activities.

## User Entry Points

| Type      | Path     | Evidence                           |
| --------- | -------- | ---------------------------------- |
| Page      | /cookies | Route to be created                |
| Footer    | /cookies | Link from marketing/app footer     |
| Banner    | /cookies | Link from cookie consent banner    |
| Legal Nav | /cookies | Legal documents navigation section |
| Sitemap   | /cookies | To be added to sitemap.ts          |

## Core Flow

### Page Access Flow

1. User navigates to /cookies via footer link, cookie banner "Learn more", or legal navigation
2. Page loads with complete cookie policy content and table of contents
3. User can scroll through sections or use jump links to navigate to specific topics
4. SEO metadata loads with appropriate title and description for search indexing

### Cookie Information Display Flow

1. Introduction section explains what cookies are and why FiskAI uses them
2. Cookie categories section breaks down types: Essential, Analytics, Functional, Marketing
3. Detailed cookie table lists each cookie with name, provider, purpose, duration, and type
4. Third-party services section discloses all external tracking tools (Google Analytics, Meta Pixel, etc.)
5. User control section explains how to manage cookie preferences via browser settings and consent banner

### Consent Management Integration Flow

1. Page includes link back to cookie consent settings/banner
2. Users can access consent preferences to modify previously given permissions
3. Instructions provided for withdrawing consent at any time
4. Browser-specific cookie management instructions included for all major browsers

## Key Modules

| Module              | Purpose                           | Location                           |
| ------------------- | --------------------------------- | ---------------------------------- |
| CookiePolicyPage    | Main cookie policy page component | `src/app/(legal)/cookies/page.tsx` |
| CookieTable         | Detailed cookie information table | Component within policy page       |
| LegalLayout         | Consistent legal page wrapper     | `src/app/(legal)/layout.tsx`       |
| CookieConsentBanner | Banner linking to policy page     | `src/components/cookie-banner.tsx` |
| sitemap             | SEO sitemap generation            | `src/app/sitemap.ts`               |
| robots              | Search engine indexing rules      | `src/app/robots.ts`                |

## Data

### Cookie Categories

Cookie policy must organize cookies into GDPR-compliant categories:

#### 1. Strictly Necessary Cookies

**Purpose**: Essential for website functionality, security, and navigation
**Consent Required**: No (legitimate interest under GDPR)
**Examples**:

- Session management cookies
- Authentication tokens
- CSRF protection tokens
- Load balancing cookies
- Security cookies

#### 2. Functional/Preference Cookies

**Purpose**: Remember user choices and preferences
**Consent Required**: Yes
**Examples**:

- Language preferences
- Currency selection
- UI customization settings
- Remember me functionality
- Theme preferences (light/dark mode)

#### 3. Analytics/Performance Cookies

**Purpose**: Collect anonymous statistics about website usage
**Consent Required**: Yes
**Examples**:

- Google Analytics cookies (\_ga, \_gid, \_gat)
- Page view tracking
- User journey analysis
- Performance monitoring
- Error tracking (Sentry)

#### 4. Marketing/Advertising Cookies

**Purpose**: Track users across websites for advertising purposes
**Consent Required**: Yes
**Examples**:

- Meta Pixel cookies (\_fbp, \_fbc)
- Google Ads conversion tracking
- Retargeting pixels
- Social media tracking
- Affiliate tracking cookies

### Cookie Details Table Structure

Each cookie must be documented with:

| Field          | Description                                         | Example                       |
| -------------- | --------------------------------------------------- | ----------------------------- |
| Cookie Name    | Technical identifier                                | \_ga                          |
| Provider       | Who sets the cookie                                 | Google Analytics              |
| Purpose        | Why the cookie is used                              | Distinguish unique users      |
| Type           | Category (Essential/Functional/Analytics/Marketing) | Analytics                     |
| Duration       | How long the cookie persists                        | 2 years                       |
| Data Collected | What information is stored                          | Anonymous user ID, timestamps |

### Third-Party Services Disclosure

FiskAI must disclose all third-party services that use cookies:

1. **Google Analytics**
   - Purpose: Website usage analytics
   - Cookies: _ga, \_gid, \_gat_gtag_\*
   - Data shared: Page views, user interactions, anonymous demographics
   - Privacy policy: https://policies.google.com/privacy

2. **Meta Pixel** (if implemented)
   - Purpose: Advertising conversion tracking
   - Cookies: \_fbp, \_fbc
   - Data shared: Page visits, conversion events
   - Privacy policy: https://www.facebook.com/privacy/policy/

3. **Authentication Services** (e.g., Clerk)
   - Purpose: User authentication and session management
   - Cookies: Session tokens, CSRF tokens
   - Data shared: Authentication status, user ID
   - Privacy policy: Vendor-specific

4. **Payment Processors** (e.g., Stripe)
   - Purpose: Secure payment processing
   - Cookies: Payment session management
   - Data shared: Transaction data (encrypted)
   - Privacy policy: https://stripe.com/privacy

5. **Error Tracking** (e.g., Sentry)
   - Purpose: Application error monitoring
   - Cookies: Session replay identifiers
   - Data shared: Error logs, stack traces, user actions
   - Privacy policy: Vendor-specific

## Implementation Status

### Currently Implemented

❌ **Cookie Policy Page**

- Page route /cookies not yet created
- Content structure to be defined
- Cookie inventory to be compiled

❌ **Cookie Consent Banner**

- No consent banner implemented
- No cookie preference storage
- No consent management system

❌ **Cookie Documentation**

- No comprehensive cookie audit completed
- Third-party services not fully documented
- Cookie durations not specified

### Required Implementation

✅ **Content Sections Required**

1. **Introduction**
   - What are cookies?
   - Why does FiskAI use cookies?
   - Legal basis (GDPR, ePrivacy Directive)

2. **Cookie Categories**
   - Essential cookies explanation
   - Functional cookies explanation
   - Analytics cookies explanation
   - Marketing cookies explanation

3. **Detailed Cookie Table**
   - All cookies listed with full details
   - First-party vs third-party distinction
   - Duration and data retention policies

4. **Third-Party Services**
   - Complete list of external services
   - Links to third-party privacy policies
   - Data sharing disclosure

5. **User Control**
   - How to manage cookie preferences
   - Browser-specific instructions (Chrome, Firefox, Safari, Edge)
   - How to withdraw consent
   - Link to consent management tool

6. **Contact Information**
   - Data protection officer contact (if applicable)
   - Privacy inquiry email
   - Link to main privacy policy

7. **Policy Updates**
   - Last updated date
   - How users are notified of changes
   - Policy version history

✅ **Technical Requirements**

- Responsive design for mobile/desktop
- Accessible navigation with table of contents
- Jump links to sections
- Print-friendly formatting
- Fast page load time (<2s)
- SEO optimized with appropriate metadata

✅ **Compliance Requirements**

- GDPR Article 13 disclosure requirements
- ePrivacy Directive cookie consent rules
- Croatian data protection law alignment
- Transparent language (plain Croatian)
- Complete and accurate information
- Easy to understand formatting

## Dependencies

### Depends On

- **Legal Layout**: Consistent legal document wrapper
- **Cookie Consent System**: Banner and preference management
- **Next.js Metadata**: SEO optimization
- **Marketing/App Layouts**: Footer links to policy page

### Integrations Required

- **Cookie Banner**: Must link to /cookies page with "Learn more" or "Manage preferences"
- **Footer Navigation**: Include /cookies in legal links section
- **Privacy Policy**: Cross-reference cookie policy
- **Terms of Service**: Mention cookie usage and consent requirements

## Integrations

### Internal Integrations

#### Cookie Consent Banner Integration

Cookie policy page must be accessible from consent banner:

1. **Banner "Learn More" Link**
   - Links to /cookies for full policy
   - Opens in new tab or expands inline
   - Accessible before consent given

2. **Manage Preferences Link**
   - Allows users to modify consent
   - Re-opens consent banner or settings modal
   - Saves new preferences immediately

3. **Consent Storage**
   - User consent preferences stored in cookie or localStorage
   - Preferences respected across all pages
   - Withdrawal triggers re-blocking of non-essential cookies

#### Footer Navigation Integration

Cookie policy linked from all page footers:

1. **Marketing Footer** → `src/app/(marketing)/layout.tsx`
   - "Cookie Policy" link in legal section
   - Grouped with Privacy Policy, Terms, GDPR info

2. **App Footer** → `src/app/(app)/layout.tsx`
   - Persistent access to legal documents
   - Quick access from any authenticated page

3. **Legal Page Layout**
   - Sidebar navigation between legal documents
   - Breadcrumb navigation

#### SEO Integration

Cookie policy must be indexable and discoverable:

1. **Sitemap Entry** → `src/app/sitemap.ts`
   - Add /cookies to routes array
   - Change frequency: monthly
   - Priority: 0.5 (legal document)

2. **Robots.txt** → `src/app/robots.ts`
   - Allow crawling of /cookies page
   - No disallow rules

3. **Metadata** → `src/app/(legal)/cookies/page.tsx`
   - Title: "FiskAI — Pravila o kolačićima (Cookie Policy)"
   - Description: "Saznajte kako FiskAI koristi kolačiće, koje vrste kolačića koristimo, i kako možete upravljati svojim postavkama."

### External Integrations

#### Third-Party Cookie Management Platforms

If using a Consent Management Platform (CMP):

1. **CookieYes / OneTrust / Cookiebot**
   - Automated cookie scanning
   - Consent banner generation
   - Preference center
   - Compliance reporting

2. **Google Consent Mode v2**
   - Integration with Google Analytics
   - Consent signal passing
   - Conversion modeling for denied consent

#### Analytics and Tracking Integration

1. **Google Analytics 4**
   - Respect consent preferences
   - Only load when analytics consent given
   - Document all GA4 cookies in policy

2. **Meta Pixel** (if used)
   - Respect marketing consent
   - Only fire events when consent given
   - Document Facebook cookies in policy

3. **Error Tracking** (Sentry, etc.)
   - May require functional consent
   - Anonymize user data when consent denied
   - Document tracking cookies

## Future Enhancements

### High Priority

1. **Cookie Consent Banner Implementation**
   - Design GDPR-compliant banner
   - Implement granular consent options (Essential/Analytics/Marketing)
   - Create consent preference storage system
   - Add "Accept All" / "Reject All" / "Customize" buttons
   - Ensure equal prominence of accept/reject options (no dark patterns)

2. **Automated Cookie Scanning**
   - Use cookie scanning tool to audit site
   - Automatically detect all cookies in use
   - Update cookie table dynamically
   - Alert when new cookies detected

3. **Consent Management Platform Integration**
   - Evaluate CMP solutions (CookieYes, OneTrust, Cookiebot)
   - Implement preference center
   - Add consent logging for compliance proof
   - Generate compliance reports

4. **Browser-Specific Instructions**
   - Add detailed guides for cookie management in Chrome, Firefox, Safari, Edge
   - Include screenshots or visual guides
   - Provide mobile browser instructions (iOS Safari, Chrome Mobile)

### Medium Priority

5. **Multi-Language Support**
   - Translate policy to English for international users
   - Ensure legal accuracy in both languages
   - Locale-specific regulatory requirements (GDPR vs CCPA)

6. **Cookie Policy Versioning**
   - Implement version history tracking
   - Show "last updated" date prominently
   - Notify users of material changes
   - Archive previous versions

7. **Interactive Cookie Preference Center**
   - Embedded widget on policy page
   - Toggle switches for each category
   - Real-time consent updates
   - Show active cookies for current session

8. **Analytics Integration**
   - Track policy page views
   - Monitor consent rates (accept/reject/customize)
   - Identify most common user paths
   - A/B test consent banner designs

### Low Priority

9. **Educational Content**
   - Add "What are cookies?" explainer video
   - Interactive cookie demo
   - FAQ section for common questions
   - Benefits of cookies explanation

10. **Accessibility Enhancements**
    - Screen reader optimization
    - Keyboard navigation for consent banner
    - High contrast mode for policy page
    - Text-to-speech compatibility

11. **API for Cookie Preferences**
    - Programmatic access to user consent
    - Sync preferences across devices (if logged in)
    - Export consent data for user download
    - Integration with GDPR data export requests

## Verification Checklist

### Page Structure & Content

- [ ] Cookie policy page accessible at /cookies
- [ ] Page loads within 2 seconds
- [ ] Table of contents with jump links to sections
- [ ] Introduction explains what cookies are and why they're used
- [ ] All four cookie categories explained (Essential, Functional, Analytics, Marketing)
- [ ] Detailed cookie table with all active cookies
- [ ] Each cookie lists: name, provider, purpose, type, duration
- [ ] Third-party services section lists all external tools
- [ ] Links to third-party privacy policies included
- [ ] User control section explains preference management
- [ ] Browser-specific cookie management instructions
- [ ] Contact information for privacy inquiries
- [ ] Last updated date displayed prominently
- [ ] Policy version number or changelog

### GDPR Compliance

- [ ] Clear distinction between essential and non-essential cookies
- [ ] Consent requirement stated for non-essential cookies
- [ ] Legal basis for each cookie category explained
- [ ] User rights regarding consent explained (withdraw, modify)
- [ ] Data retention periods specified for each cookie
- [ ] Cross-border data transfer disclosure (if applicable)
- [ ] Data processing purposes clearly stated
- [ ] Link to full privacy policy included
- [ ] Croatian data protection law references (if applicable)
- [ ] EU ePrivacy Directive compliance

### Cookie Consent Banner Integration

- [ ] Cookie banner displays on first visit
- [ ] Banner includes link to /cookies page
- [ ] "Learn More" or "Cookie Policy" link functional
- [ ] Granular consent options available (not just Accept/Reject)
- [ ] Essential cookies listed separately (no consent required)
- [ ] Analytics and Marketing toggles independent
- [ ] "Accept All" and "Reject All" buttons equally prominent
- [ ] No pre-ticked checkboxes (except essential)
- [ ] Consent preferences saved correctly
- [ ] Banner respects previously given consent
- [ ] "Manage Preferences" link available on all pages
- [ ] Consent can be withdrawn as easily as given

### Cookie Behavior

- [ ] Essential cookies set immediately (no consent required)
- [ ] Analytics cookies blocked until consent given
- [ ] Marketing cookies blocked until consent given
- [ ] Third-party scripts respect consent choices
- [ ] Google Analytics only loads after analytics consent
- [ ] Meta Pixel only loads after marketing consent
- [ ] Consent withdrawal immediately stops non-essential cookies
- [ ] Cookie durations match policy documentation
- [ ] Cookies expire according to stated retention periods

### Navigation & Discoverability

- [ ] /cookies link in marketing footer
- [ ] /cookies link in app footer (authenticated pages)
- [ ] Link from main privacy policy to cookie policy
- [ ] Link from terms of service to cookie policy
- [ ] Included in legal documents navigation menu
- [ ] Added to sitemap.xml
- [ ] Robots.txt allows indexing
- [ ] Page appears in site search results

### SEO & Metadata

- [ ] Page title: "FiskAI — Pravila o kolačićima (Cookie Policy)"
- [ ] Meta description present and descriptive
- [ ] Open Graph tags for social sharing
- [ ] Canonical URL set to /cookies
- [ ] Appropriate schema markup (if applicable)
- [ ] No duplicate content issues
- [ ] Internal links use descriptive anchor text
- [ ] Page indexed by Google within 7 days

### Accessibility

- [ ] WCAG 2.1 AA compliance
- [ ] Proper heading hierarchy (H1 → H2 → H3)
- [ ] All links have descriptive text (no "click here")
- [ ] Tables have proper headers and scope attributes
- [ ] Keyboard navigation functional (Tab, Enter, Escape)
- [ ] Screen reader tested (reads content logically)
- [ ] Focus indicators visible on interactive elements
- [ ] Color contrast ratios meet 4.5:1 minimum
- [ ] Text resizable to 200% without breaking layout
- [ ] No flashing content or animations

### Responsive Design

- [ ] Mobile layout (320px - 767px) displays correctly
- [ ] Tablet layout (768px - 1023px) displays correctly
- [ ] Desktop layout (1024px+) displays correctly
- [ ] Table of contents accessible on mobile
- [ ] Cookie table scrollable horizontally on small screens
- [ ] Touch targets minimum 44x44px
- [ ] Text remains readable without horizontal scrolling
- [ ] Images and icons scale appropriately

### Performance

- [ ] Page loads in under 2 seconds (3G connection)
- [ ] Lighthouse Performance score >90
- [ ] No render-blocking resources
- [ ] Images optimized and lazy-loaded (if present)
- [ ] CSS and JS minified
- [ ] No console errors or warnings
- [ ] Smooth scrolling with jump links

### Legal Review

- [ ] Content reviewed by legal counsel or DPO
- [ ] Accuracy verified for all technical details
- [ ] Cookie audit completed and up-to-date
- [ ] All third-party services documented
- [ ] Data retention periods accurate
- [ ] Compliance with Croatian law confirmed
- [ ] EU GDPR requirements met
- [ ] ePrivacy Directive requirements met

## Evidence Links

Research and compliance sources for cookie policy implementation:

1. [GDPR Cookie Consent Requirements for 2025](https://secureprivacy.ai/blog/gdpr-cookie-consent-requirements-2025) - Comprehensive overview of GDPR cookie consent rules, including prior consent enforcement, banner design requirements, and consent validity periods

2. [Navigating the GDPR and cookies: What you need to know for 2025](https://usercentrics.com/knowledge-hub/gdpr-cookies/) - Detailed guide on GDPR compliance for cookies, cookie categories, and user consent mechanisms

3. [Cookies, the GDPR, and the ePrivacy Directive - GDPR.eu](https://gdpr.eu/cookies/) - Official GDPR resource explaining the relationship between cookies, GDPR Article 13 requirements, and ePrivacy Directive

4. [Cookie Policy Checklist 2025: Is Yours Compliant? - CookieYes](https://www.cookieyes.com/blog/cookie-policy-checklist/) - Essential elements for a compliant cookie policy, including content requirements, cookie tables, and user control mechanisms

5. [Cookie Policy Template - Termly](https://termly.io/resources/templates/cookie-policy-template/) - Structured template for cookie policy pages with sections on cookie types, third-party disclosure, and consent management

6. [2025 Guide to a GDPR-compliant cookie banner - consentmanager](https://www.consentmanager.net/en/knowledge/gdpr-cookie-banner/) - Technical requirements for GDPR-compliant cookie consent banners, including granular consent options and withdrawal mechanisms

7. [Cookies and the GDPR: What's Really Required? - iubenda](https://www.iubenda.com/en/help/5525-cookies-gdpr-requirements) - Legal analysis of GDPR cookie requirements, lawful basis for processing, and essential vs non-essential cookie distinctions

8. [Guide to a GDPR Compliant Cookie Banner - CookieYes](https://www.cookieyes.com/blog/cookie-banner/) - Country-specific guidelines for cookie banner implementation, including design best practices and compliance tips

9. [Free Cookie Policy Template for GDPR & CCPA Compliance - CookieYes](https://www.cookieyes.com/blog/cookie-policy-template/) - Complete cookie policy template with sections on cookie categories, third-party services, and user rights

10. [Writing a cookie policy | The ultimate guide - Openli](https://openli.com/guides/cookie-policy) - Comprehensive guide to writing clear, compliant cookie policies with practical examples and best practices for transparency

## Croatian Legal Context

### Relevant Laws and Regulations

1. **EU General Data Protection Regulation (GDPR)**
   - Applies to all Croatian businesses processing EU resident data
   - Article 13: Transparency and information requirements
   - Article 7: Conditions for consent
   - Recital 32: Consent must be freely given, specific, informed, unambiguous

2. **ePrivacy Directive (2002/58/EC)**
   - Requires consent before storing/accessing cookies (except essential)
   - Croatia must implement via national law
   - Stricter than GDPR for cookie consent

3. **Croatian Personal Data Protection Act (ZZOP)**
   - National implementation of GDPR
   - Croatian Data Protection Agency (AZOP) enforcement
   - Harmonized with EU requirements

4. **Croatian Electronic Communications Act**
   - Implements ePrivacy Directive in Croatia
   - Cookie consent requirements
   - Electronic marketing rules

### AZOP (Croatian DPA) Guidance

The Croatian Data Protection Agency (Agencija za zaštitu osobnih podataka) provides guidance on:

- Cookie consent mechanisms
- Information requirements for users
- Record-keeping obligations
- Complaint procedures

### Language Requirements

- Primary cookie policy must be in Croatian (target audience)
- English version recommended for international users
- Legal terminology must be accurate in Croatian
- Plain language preferred over legalese

### Penalties for Non-Compliance

- GDPR fines: Up to €20 million or 4% of global annual turnover (whichever is higher)
- AZOP administrative fines for Croatian violations
- Reputational damage from non-compliance
- User complaints can trigger investigations

### Best Practices for Croatian Context

1. Use Croatian language for all user-facing consent mechanisms
2. Provide clear information about data transfers outside Croatia/EU
3. Include contact for Croatian Data Protection Officer (if required)
4. Reference both EU and Croatian legal framework
5. Make cookie policy easily accessible from all pages
6. Ensure consent banner displays before any non-essential cookies load
7. Keep detailed records of consent (proof of compliance)
8. Conduct regular cookie audits (minimum annually)
9. Update policy whenever cookie usage changes
10. Provide easy withdrawal of consent mechanism
