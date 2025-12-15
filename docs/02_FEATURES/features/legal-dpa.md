# Feature: DPA Page (Data Processing Agreement)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 8

## Purpose

The DPA (Data Processing Agreement) Page provides a legally compliant data processing agreement that outlines how FiskAI handles and processes user data as a data processor on behalf of users (data controllers). This low-complexity legal page establishes transparency around data processing activities, security measures, AI processing policies, and user rights in compliance with GDPR and Croatian data protection regulations.

## User Entry Points

| Type | Path     | Evidence                                         |
| ---- | -------- | ------------------------------------------------ |
| Page | /dpa     | Data Processing Agreement page                   |
| Link | Footer   | "DPA (Obrada podataka)" link in marketing footer |
| Link | Privacy  | Cross-referenced from Privacy Policy page        |
| Link | Terms    | Cross-referenced from Terms of Service page      |
| Link | Security | Cross-referenced from Security Trust Center      |
| SEO  | Sitemap  | Included in sitemap.xml for discoverability      |
| SEO  | Robots   | Allowed in robots.txt for search engine indexing |

## Core Flow

1. User navigates to /dpa from footer link, privacy policy, or direct URL
2. System renders DPA page with Croatian language content
3. User reads sections outlining:
   - Scope of data processing
   - Security measures
   - AI processing policies
   - User rights
4. User understands FiskAI's data processing obligations
5. User can reference DPA when evaluating GDPR compliance
6. User can navigate to related legal pages (privacy, terms, security)

## DPA Components

### Essential DPA Sections

1. **Processing Scope (Opseg obrade)**
   - What data FiskAI processes (invoices, expenses, contacts)
   - Purpose limitations (invoicing, bookkeeping, reporting only)
   - No use for other purposes without explicit consent
   - Reference: [GDPR Article 28 - Processor Obligations](https://gdpr-info.eu/art-28-gdpr/)

2. **Data Security (Sigurnost podataka)**
   - Encryption in transit and at rest
   - Access controls (authentication and authorization)
   - Regular security audits and system updates
   - Reference: [GDPR Article 32 - Security of Processing](https://gdpr-info.eu/art-32-gdpr/)

3. **AI Processing (AI obrada)**
   - Temporary data transmission to external AI providers for OCR
   - Time-limited processing
   - No secondary use of AI-processed content
   - Reference: [EU AI Act Data Processing Requirements](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)

4. **User Rights (Prava korisnika)**
   - Right to access personal data
   - Right to rectification of inaccurate data
   - Right to erasure (right to be forgotten)
   - Compliance with applicable regulations
   - Reference: [GDPR Chapter 3 - Rights of Data Subjects](https://gdpr-info.eu/chapter-3/)

### Page Metadata

- **Title**: "FiskAI — Sporazum o obradi podataka"
- **Description**: "Sporazum o obradi podataka (DPA) za FiskAI."
- **Language**: Croatian (hr-HR)
- **Legal Notice**: Draft disclaimer indicating need for legal review before commercial use

## GDPR Compliance Elements

### Data Processing Agreement Requirements

According to GDPR Article 28, a DPA must include:

1. **Subject Matter and Duration**
   - Processing activities: invoicing, expense tracking, report generation
   - Duration: for the term of service usage
   - Reference: [GDPR Art. 28(3) - Contract Requirements](https://gdpr-info.eu/art-28-gdpr/)

2. **Nature and Purpose**
   - Nature: automated and manual data processing
   - Purpose: business accounting, invoice management, tax reporting
   - Reference: [ICO Data Protection Contracts](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/contracts-and-liabilities-between-controllers-and-processors/)

3. **Types of Personal Data**
   - Business contact data (names, emails, addresses, OIB)
   - Financial data (invoice amounts, bank details)
   - Tax identification numbers
   - Reference: [What is a Data Processing Agreement?](https://termly.io/resources/articles/data-processing-agreement/)

4. **Categories of Data Subjects**
   - Business owners
   - Customers and suppliers
   - Accountants and bookkeepers
   - Reference: [DPA Templates and Examples](https://termly.io/resources/templates/data-processing-agreement-template/)

5. **Processor Obligations**
   - Process data only on documented instructions
   - Ensure confidentiality of persons authorized to process data
   - Implement appropriate technical and organizational measures
   - Assist controller with data subject rights requests
   - Reference: [Understanding DPAs Under GDPR](https://www.termsfeed.com/blog/data-processing-agreement/)

6. **Security Measures**
   - Encryption (TLS for transmission, AES-256 for storage)
   - Access controls (role-based, multi-tenant isolation)
   - Audit logging (complete change tracking)
   - Regular security assessments
   - Reference: [GDPR Security Requirements](https://iapp.org/news/a/top-10-operational-impacts-of-the-gdpr-part-7-data-security-requirements/)

### Sub-Processor Transparency

The AI processing section addresses GDPR Article 28(2) requirements for sub-processors:

- Disclosure that external AI/OCR providers are used
- Purpose limitation (OCR functionality only)
- Temporary processing (time-limited)
- No secondary use of data
- Reference: [Sub-Processor Management Under GDPR](https://www.privacypolicies.com/blog/gdpr-data-processing-agreement/)

## Croatian Legal Context

### Data Protection Authority

- **Regulatory Body**: Agencija za zaštitu osobnih podataka (AZOP)
- **Jurisdiction**: Croatian implementation of GDPR
- **Local Requirements**: Croatian language legal documents for local businesses
- Reference: [AZOP Official Website](https://azop.hr/)

### Croatian Business Requirements

1. **OIB Processing**
   - OIB (Osobni identifikacijski broj) is sensitive business identifier
   - Required for invoicing and tax compliance
   - Protected under Croatian data protection law
   - Reference: [OIB Regulations in Croatia](https://www.porezna-uprava.hr/en/Pages/oib.aspx)

2. **Fiscalization Compliance**
   - FiskAI processes data for Croatian fiscalization (fiskalizacija)
   - Data transmitted to Tax Administration (Porezna uprava)
   - DPA covers this specific use case
   - Reference: [Croatian Fiscalization Law](https://www.porezna-uprava.hr/en/Pages/Fiscalisation.aspx)

## Integration with Other Legal Pages

### Cross-References

1. **Privacy Policy** (`/privacy`)
   - Links to DPA for data processing details
   - Complements DPA with user data collection policies
   - Evidence: `/home/admin/FiskAI/src/app/(marketing)/privacy/page.tsx:140`

2. **Terms of Service** (`/terms`)
   - References DPA for data processing obligations
   - Defines contractual relationship
   - Evidence: `/home/admin/FiskAI/src/app/(marketing)/terms/page.tsx:169`

3. **Security Page** (`/security`)
   - Details technical security measures referenced in DPA
   - Trust Center for transparency
   - Evidence: `/home/admin/FiskAI/src/app/(marketing)/security/page.tsx:215`

4. **AI Data Policy** (`/ai-data-policy`)
   - Expands on AI processing section in DPA
   - Specific AI/ML data handling policies
   - Evidence: Cross-referenced in footer navigation

## Design and Layout

### Page Structure

1. **Header**
   - Marketing layout header with FiskAI branding
   - Beta badge indicator
   - Navigation to Features, Pricing, Security, Contact
   - Evidence: `/home/admin/FiskAI/src/app/(marketing)/layout.tsx`

2. **Content Container**
   - Maximum width: 768px (3xl)
   - Padding: 16px mobile, 24px desktop
   - Vertical spacing: 56px top/bottom

3. **Typography Hierarchy**
   - H1: "Sporazum o obradi podataka (DPA)" - 36px, semibold
   - Disclaimer text: 14px, muted color
   - H2: Section headers - 24px, semibold
   - Body text: 14px, muted color
   - List items: Disc bullets, 8px spacing

4. **Footer**
   - Legal links section includes "DPA (Obrada podataka)"
   - Company information (Metrica d.o.o.)
   - Support contact details
   - Evidence: `/home/admin/FiskAI/src/app/(marketing)/layout.tsx:115`

### Styling Best Practices

- **Legal Disclaimer**: Blue background alert box highlighting draft status
- **Accessibility**: High contrast text, semantic HTML headings
- **Readability**: Shorter line lengths (max-w-3xl), adequate spacing
- **Scannability**: Clear section headers, bullet points for key points
- Reference: [Legal Page Design Best Practices](https://www.termsfeed.com/blog/how-to-design-privacy-policy-page/)

## SEO and Discoverability

### Search Engine Optimization

1. **Sitemap Inclusion**
   - Listed in `/sitemap.xml` with weekly change frequency
   - Priority: 0.7 (standard for legal pages)
   - Evidence: `/home/admin/FiskAI/src/app/sitemap.ts:13`

2. **Robots.txt**
   - Explicitly allowed for crawling
   - Not disallowed like dashboard/admin pages
   - Evidence: `/home/admin/FiskAI/src/app/robots.ts:15`

3. **Metadata**
   - Descriptive title tag with brand and page purpose
   - Meta description for search results
   - Evidence: `/home/admin/FiskAI/src/app/(marketing)/dpa/page.tsx:3-6`

### Route Registry

- **Route**: `/dpa`
- **File**: `src/app/(marketing)/dpa/page.tsx`
- **Type**: Static page (no dynamic parameters)
- **Route Group**: `(marketing)` - uses marketing layout
- Evidence: `/home/admin/FiskAI/docs/_meta/inventory/routes.json:180-184`

## Dependencies

- **Depends on**:
  - Marketing layout (`src/app/(marketing)/layout.tsx`)
  - Root layout (`src/app/layout.tsx`)
  - CSS variables for theming
- **Depended by**:
  - Privacy Policy (cross-reference)
  - Terms of Service (cross-reference)
  - Security page (cross-reference)

## Integrations

None - This is a static legal documentation page with no external API integrations.

## Verification Checklist

- [ ] Page accessible at /dpa route
- [ ] Page title displays "FiskAI — Sporazum o obradi podataka"
- [ ] Draft disclaimer notice is prominent at page top
- [ ] All four main sections are present (Opseg obrade, Sigurnost podataka, AI obrada, Prava korisnika)
- [ ] Content is in Croatian language (hr-HR)
- [ ] Footer "DPA (Obrada podataka)" link navigates correctly
- [ ] Cross-references from Privacy and Terms pages work
- [ ] Page included in sitemap.xml
- [ ] Page allowed in robots.txt
- [ ] Mobile responsive design (max-w-3xl container)
- [ ] Typography hierarchy is clear and accessible
- [ ] Legal disclaimer box is visually distinct
- [ ] Page loads without errors in marketing layout

## Evidence Links

1. [GDPR Article 28 - Processor Obligations](https://gdpr-info.eu/art-28-gdpr/) - Legal requirements for Data Processing Agreements under GDPR, processor obligations, and contract requirements
2. [GDPR Article 32 - Security of Processing](https://gdpr-info.eu/art-32-gdpr/) - Technical and organizational security measures required for data processing
3. [What is a Data Processing Agreement? (DPA)](https://termly.io/resources/articles/data-processing-agreement/) - Comprehensive guide to DPA requirements, components, and GDPR compliance
4. [Data Processing Agreement Template](https://termly.io/resources/templates/data-processing-agreement-template/) - Standard DPA template with required clauses and categories of data subjects
5. [ICO Data Protection Contracts and Liabilities](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/contracts-and-liabilities-between-controllers-and-processors/) - Official guidance on controller-processor contracts from UK Information Commissioner's Office
6. [Understanding DPAs Under GDPR](https://www.termsfeed.com/blog/data-processing-agreement/) - Processor obligations, security measures, and sub-processor management
7. [IAPP Data Security Requirements Under GDPR](https://iapp.org/news/a/top-10-operational-impacts-of-the-gdpr-part-7-data-security-requirements/) - Security requirements and operational impacts of GDPR compliance
8. [GDPR Chapter 3 - Rights of Data Subjects](https://gdpr-info.eu/chapter-3/) - User rights including access, rectification, erasure, and data portability
