# Feature: Privacy Policy Page

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 10

## Purpose

The Privacy Policy Page provides comprehensive disclosure of how FiskAI collects, uses, shares, and protects user personal data in compliance with GDPR (General Data Protection Regulation) and Croatian data protection laws. This low-complexity legal page serves as a critical trust signal for potential customers and fulfills regulatory requirements for transparent data processing practices, particularly for a SaaS accounting platform handling sensitive business and financial information.

## User Entry Points

| Type | Path     | Evidence                                                             |
| ---- | -------- | -------------------------------------------------------------------- |
| Page | /privacy | Privacy policy page accessible from marketing footer and legal links |

## Core Flow

1. User accesses privacy policy page via footer link, direct URL, or from other legal pages
2. System displays comprehensive privacy policy in Croatian (Politika privatnosti)
3. User reviews policy sections covering data collection, usage, AI processing, and GDPR rights
4. System provides navigation to related legal policies (terms, cookies, DPA, AI policy)
5. User can contact GDPR contact email for data subject requests
6. System displays last modification date for transparency

## Key Sections

| Section             | Purpose                                      | GDPR Article Reference |
| ------------------- | -------------------------------------------- | ---------------------- |
| Introduction        | Identify data controller and policy scope    | Article 13             |
| Data Collection     | Disclosure of personal data collected        | Article 13(1)(c)       |
| Data Usage          | Lawful basis and purposes of processing      | Article 13(1)(c)       |
| AI & OCR Processing | Transparency about automated decision-making | Article 22             |
| Data Sharing        | Third-party data processors disclosure       | Article 13(1)(e)       |
| Data Security       | Security measures and retention periods      | Article 32             |
| User Rights (GDPR)  | Data subject rights and how to exercise them | Articles 15-22         |
| Contact Information | Data controller contact and DPA details      | Article 13(1)(a)       |

## Privacy Policy Content Structure

### 1. Introduction Section

**Implementation**: `src/app/(marketing)/privacy/page.tsx:12-23`

- **Data Controller**: Identifies FiskAI d.o.o. as data controller (voditelj obrade)
- **Scope**: Explains policy applies to fiskai.app services
- **Last Modified Date**: Dynamic date display using Croatian locale
- **Highlights**: Blue notice box for key controller information

### 2. Data Collection Disclosure

**Implementation**: `src/app/(marketing)/privacy/page.tsx:25-40`

**Data Provided Directly by Users**:

- Account data: name, surname, email, hashed password
- Company data: name, OIB (tax ID), address, contact details, IBAN
- Business documents: invoices, expenses, customer/supplier contacts
- Communications: support messages and contact forms

**Automatically Collected Data**:

- Usage data: access times, pages visited, actions performed
- Technical data: IP address, browser type, operating system, device
- Cookies: functional cookies required for application operation
- **Cross-reference**: Links to separate Cookie Policy page (`/cookies`)

### 3. Data Usage Purposes

**Implementation**: `src/app/(marketing)/privacy/page.tsx:42-50`

Legal bases for processing:

- **Service Provision**: Account creation, fiscalization, expense processing, report generation (Contract - GDPR Article 6(1)(b))
- **Communication**: Account notifications, news, technical issues (Legitimate Interest - Article 6(1)(f))
- **Service Improvement**: Usage analysis for UX enhancement (Legitimate Interest)
- **Legal Obligations**: Fiscalization compliance, 11-year invoice archiving (Legal Obligation - Article 6(1)(c))
- **Security**: Fraud prevention, system protection (Legitimate Interest)

### 4. AI and OCR Processing Transparency

**Implementation**: `src/app/(marketing)/privacy/page.tsx:52-62`

**Key Disclosures**:

- AI processing is **optional** and can be disabled in settings
- Processing via EU-based providers (OpenAI API, EU region)
- User data **not used for training AI models** without explicit consent
- AI suggestions always presented as recommendations - user makes final decision
- Cross-reference to separate AI Data Policy page (`/ai-data-policy`)

**GDPR Compliance**: Addresses Article 22 requirements for automated decision-making transparency

### 5. Third-Party Data Sharing

**Implementation**: `src/app/(marketing)/privacy/page.tsx:64-74`

**Disclosure Statement**: "We do not sell or share your data with third parties for marketing purposes"

**Permitted Sharing**:

- **Infrastructure Providers**: AWS EU hosting, database, email delivery (Resend)
- **Payment Processing**: Stripe for subscription processing (PCI-DSS compliant, no card storage)
- **Government Bodies**: Croatian Tax Authority (Porezna uprava) for fiscalization (legal obligation)
- **Legal Requirements**: Court orders or competent authorities when legally required

### 6. Data Storage and Security

**Implementation**: `src/app/(marketing)/privacy/page.tsx:76-82`

**Security Measures**:

- **Location**: All data stored in EU (Germany, AWS eu-central-1)
- **Encryption at Rest**: AES-256 encryption
- **Encryption in Transit**: TLS 1.3
- **Backups**: Daily backups with 30-day retention, stored in EU
- **Access Control**: Strict access controls, minimal privileges, audit trails

**Cross-reference**: Security page (`/security`) for detailed infrastructure security

### 7. Data Retention Periods

**Implementation**: `src/app/(marketing)/privacy/page.tsx:84-90`

**Retention Schedule**:

- **Account Data**: While account active + 30 days after closure
- **Business Documents**: Until user deletes or closes account
- **Fiscalized Invoices**: **11 years** (Croatian legal obligation for tax records)
- **Security Logs**: 90 days
- **Analytics Logs**: 30 days

**GDPR Compliance**: Addresses Article 13(2)(a) storage period disclosure

### 8. GDPR User Rights

**Implementation**: `src/app/(marketing)/privacy/page.tsx:92-107`

**Data Subject Rights** (Articles 15-22):

- **Right to Access**: Request copy of all personal data
- **Right to Rectification**: Correct inaccurate data
- **Right to Erasure**: Request data deletion (with legal exceptions)
- **Right to Data Portability**: Download data in CSV/JSON format
- **Right to Restriction**: Limit how data is used
- **Right to Object**: Object to certain processing types

**Exercise Rights**:

- Contact: `gdpr@fiskai.hr`
- Response time: Within 30 days (GDPR Article 12(3) requirement)

**Implementation Reference**: Export functionality in `src/lib/backup/export.ts:25` provides GDPR data portability

### 9. Cookie Disclosure

**Implementation**: `src/app/(marketing)/privacy/page.tsx:109-114`

- Only essential functional cookies used (session, authentication)
- No marketing or third-party analytics cookies
- Cross-reference to detailed Cookie Policy (`/cookies`)

### 10. Policy Changes

**Implementation**: `src/app/(marketing)/privacy/page.tsx:116-120`

- Periodic policy updates may occur
- Significant changes require 30-day advance notice via email or in-app notification
- Transparency commitment for user awareness

### 11. Contact Information

**Implementation**: `src/app/(marketing)/privacy/page.tsx:122-132`

**Data Controller**:

- Entity: FiskAI d.o.o.
- Role: Data controller (voditelj obrade)
- GDPR Contact: `gdpr@fiskai.hr`
- Address: Zagreb, Croatia

**Supervisory Authority**:

- Croatian Data Protection Agency (AZOP): https://azop.hr
- Right to lodge complaint if GDPR violation suspected

### 12. Related Policies Footer

**Implementation**: `src/app/(marketing)/privacy/page.tsx:134-143`

**Linked Policies**:

- Terms of Service (`/terms`)
- Cookie Policy (`/cookies`)
- AI Data Policy (`/ai-data-policy`)
- Data Processing Agreement (`/dpa`)
- Security Page (`/security`)

## Technical Implementation

### Page Metadata

**File**: `src/app/(marketing)/privacy/page.tsx:4-7`

```typescript
export const metadata: Metadata = {
  title: "FiskAI — Politika privatnosti",
  description:
    "Politika privatnosti za FiskAI - kako prikupljamo, koristimo i štitimo vaše podatke.",
}
```

- Croatian language title and description for local compliance
- SEO-optimized metadata for search visibility

### Layout and Navigation

**Marketing Layout**: `src/app/(marketing)/layout.tsx:113`

- Privacy link in footer under "Legal & Podrška" section
- Accessible from all marketing pages

**Sitemap**: `src/app/sitemap.ts:13`

- Included in XML sitemap for search engine indexing
- Weekly change frequency, 0.7 priority

**Robots.txt**: `src/app/robots.ts:15`

- Allowed for crawler indexing
- Public accessibility for transparency

### Styling and Accessibility

**Implementation**: `src/app/(marketing)/privacy/page.tsx:11`

- Maximum width: 3xl (48rem) for optimal readability
- Responsive padding: px-4 on mobile, md:px-6 on desktop
- Display font for headings, muted text for body content
- Semantic HTML structure (h1, h2, h3 hierarchy)
- List-based content for scannability
- Blue hyperlinks with hover states for related policies

## GDPR Compliance Requirements

### Article 13: Information to be Provided

**Requirements Met**:

- ✅ Identity and contact details of controller (Section 11)
- ✅ Contact details of DPO (gdpr@fiskai.hr)
- ✅ Purposes and legal basis for processing (Section 3)
- ✅ Legitimate interests pursued (Section 3)
- ✅ Recipients or categories of recipients (Section 5)
- ✅ Storage periods (Section 6)
- ✅ Data subject rights (Section 8)
- ✅ Right to withdraw consent (Section 8)
- ✅ Right to lodge complaint with AZOP (Section 11)

### Article 22: Automated Decision-Making

**Requirements Met**:

- ✅ Disclosure of AI/OCR processing (Section 4)
- ✅ Information about logic involved (OpenAI API)
- ✅ Significance and consequences explained
- ✅ Right to opt-out (can disable AI features)

### Article 32: Security of Processing

**Requirements Met**:

- ✅ Encryption of data (AES-256, TLS 1.3)
- ✅ Ability to ensure confidentiality (access controls)
- ✅ Regular testing and evaluation (security audits)

## Analytics and Trust Signals

### Marketing Analytics

**Implementation**: `src/lib/marketing-analytics.ts:43`

```typescript
TRUST_PAGE_VIEWED: "trust_page_viewed", // /security, /privacy, etc.
```

Tracks privacy page views as trust signal interaction for conversion funnel analysis.

### Trust Signal Impact

**Reference**: `src/components/marketing/marketing-analytics-init.tsx:78`

Privacy policy access tracked as trust-building behavior indicating serious prospect evaluation.

## Integration with Other Legal Pages

### Cross-Referenced Pages

1. **Terms of Service** (`/terms`): Privacy policy referenced in terms
   - `src/app/(marketing)/terms/page.tsx:166`
2. **Security Page** (`/security`): Technical security details
   - `src/app/(marketing)/security/page.tsx:141-147` - GDPR rights section
   - `src/app/(marketing)/security/page.tsx:213` - Privacy policy link
3. **Cookie Policy** (`/cookies`): Detailed cookie disclosure
   - `src/app/(marketing)/cookies/page.tsx`
4. **AI Data Policy** (`/ai-data-policy`): AI processing details
5. **Data Processing Agreement** (`/dpa`): B2B data processing terms

## Dependencies

- **Depends on**: None (standalone legal page)
- **Depended by**:
  - [[marketing-landing]] - Footer trust signals
  - [[auth-registration]] - Legal agreement requirement
  - [[settings-company]] - GDPR rights exercise
  - [[legal-terms]] - Cross-referenced in terms of service

## Integrations

- **GDPR Email**: `gdpr@fiskai.hr` for data subject access requests
- **AZOP**: Croatian Data Protection Agency (external supervisory authority)
- **Export System**: `src/lib/backup/export.ts` - Data portability implementation

## Verification Checklist

- [x] Privacy policy page accessible at `/privacy` route
- [x] Page displays in Croatian language (local compliance)
- [x] Last modification date shown dynamically
- [x] All GDPR Article 13 required information disclosed
- [x] Data controller contact information provided
- [x] GDPR rights (access, rectification, erasure, portability) explained
- [x] AI/OCR processing transparency section included
- [x] Third-party data sharing disclosed (AWS, Stripe, Tax Authority)
- [x] Data retention periods specified (11 years for fiscal invoices)
- [x] Security measures described (encryption, backups, access controls)
- [x] Cookie usage disclosed with link to cookie policy
- [x] Contact email for GDPR requests provided (gdpr@fiskai.hr)
- [x] Right to lodge complaint with AZOP mentioned
- [x] Related legal policies linked in footer
- [x] Mobile responsive layout tested
- [x] Accessibility standards met (semantic HTML, readable contrast)
- [x] Page included in sitemap.xml for SEO
- [x] Page allowed in robots.txt for public access

## Evidence Links

1. [GDPR Official Text - Article 13 Information Requirements](https://gdpr-info.eu/art-13-gdpr/) - Legal requirements for information to be provided when personal data is collected from data subject
2. [GDPR Official Text - Article 22 Automated Decision-Making](https://gdpr-info.eu/art-22-gdpr/) - Transparency requirements for automated decision-making and profiling
3. [Privacy Policy Best Practices for SaaS Companies](https://www.termsfeed.com/blog/privacy-policy-best-practices/) - Structure, required disclosures, and clarity recommendations for SaaS privacy policies
4. [GDPR Compliance Checklist for Privacy Policies](https://www.cookiebot.com/en/gdpr-privacy-policy/) - Comprehensive checklist ensuring privacy policy meets all GDPR requirements
5. [Croatian Data Protection Agency (AZOP) Guidelines](https://azop.hr) - Local supervisory authority guidance for GDPR compliance in Croatia
6. [Privacy Policy Generator and Requirements Guide](https://www.freeprivacypolicy.com/blog/privacy-policy-requirements/) - Common legal requirements across jurisdictions including EU GDPR
7. [GDPR Data Retention Periods and Legal Obligations](https://www.gdpreu.org/compliance/data-retention/) - Guidelines for setting appropriate data retention periods under GDPR
8. [How to Write a Privacy Policy for Your Business](https://www.termly.io/resources/articles/how-to-write-privacy-policy/) - Step-by-step guide for creating clear, compliant privacy policies
9. [GDPR Article 32: Security of Processing Requirements](https://gdpr-info.eu/art-32-gdpr/) - Technical and organizational security measures required under GDPR
10. [Privacy Policy Examples and Templates for SaaS](https://www.iubenda.com/en/privacy-policy-examples) - Real-world examples of effective privacy policy structures and language
