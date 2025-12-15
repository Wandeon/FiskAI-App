# Feature: Terms of Service Page

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 11

## Purpose

The Terms of Service (ToS) page serves as the legally binding agreement between FiskAI and its users, establishing the rules, responsibilities, and limitations governing the use of the platform. This low-complexity feature protects both the business and users by clearly defining acceptable use, intellectual property rights, liability limitations, data handling practices, and dispute resolution procedures. The ToS is essential for legal compliance, risk mitigation, and building user trust.

## User Entry Points

| Type | Path   | Evidence                                                    |
| ---- | ------ | ----------------------------------------------------------- |
| Page | /terms | Dedicated route for Terms of Service display and acceptance |

## Core Flow

1. User accesses /terms directly via footer link or during registration process
2. System displays comprehensive Terms of Service document in readable format
3. User can scroll through all sections to review complete agreement
4. During registration, system requires affirmative acceptance (checkbox or button)
5. System records acceptance timestamp, IP address, and ToS version for legal record
6. User can return to review terms at any time via footer or legal links
7. System notifies users of material changes to terms via email or in-app notification

## Essential Sections

| Section                          | Purpose                                                 | Best Practice Reference                                                                                                             |
| -------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Introduction and Acceptance      | Define agreement scope and acceptance mechanism         | [Terms of Service Guide](https://usercentrics.com/guides/terms-of-service/)                                                         |
| Definitions                      | Clarify key terms used throughout agreement             | [Service Agreements Overview](https://www.sirion.ai/library/contracts/service-agreements/)                                          |
| Service Description              | Detail what services are provided and limitations       | [ToS Agreement Benefits](https://www.partnero.com/articles/terms-of-service-agreements-101-benefits-example--template)              |
| User Rights and Responsibilities | Outline permitted use and prohibited activities         | [Termly ToS Template](https://termly.io/resources/templates/terms-of-service-template/)                                             |
| Intellectual Property Rights     | Specify ownership of platform and user content          | [SaaS IP in Agreements](https://www.aipla.org/list/innovate-articles/incorporating-intellectual-property-rights-in-saas-agreements) |
| Payment Terms                    | Define billing, pricing, refunds, and payment schedules | [Legal Requirements for SaaS](https://www.termsfeed.com/blog/legal-requirements-saas/)                                              |
| Privacy and Data Protection      | Reference privacy policy and data handling practices    | [AI Personal Data Protection](https://secureprivacy.ai/blog/ai-personal-data-protection-gdpr-ccpa-compliance)                       |
| AI-Specific Terms                | Address AI-generated content and training data usage    | [AI Terms of Service Best Practices](https://www.humai.blog/ai-chatbot-terms-of-service-comparison-2025-privacy-rights/)            |
| Disclaimers and Liability        | Limit provider liability and set warranty disclaimers   | [SaaS Legal Requirements](https://www.njbusiness-attorney.com/how-to-handle-saas-legal-requirements-a-step-by-step-guide/)          |
| Termination Conditions           | Specify how and when agreement can be terminated        | [Service Agreements](https://www.sirion.ai/library/contracts/service-agreements/)                                                   |
| Dispute Resolution               | Define procedures for resolving conflicts               | [ToS Essential Sections](https://usercentrics.com/guides/terms-of-service/)                                                         |

## Introduction and Acceptance Section

### Essential Elements

1. **Clear Statement of Agreement**
   - Begin with explicit statement: "By accessing or using FiskAI, you agree to be bound by these Terms of Service"
   - Specify effective date of current terms
   - Include last updated date for version tracking
   - Reference: [Terms of Service Guide](https://usercentrics.com/guides/terms-of-service/)

2. **Acceptance Mechanism**
   - Clickwrap agreement (most legally enforceable): Requires active "I agree" checkbox or button click
   - Cannot proceed with registration without affirmative acceptance
   - Document acceptance with timestamp, IP address, and version number
   - Reference: [Service Agreements Overview](https://www.sirion.ai/library/contracts/service-agreements/)

3. **Age Requirements**
   - Specify minimum age for using service (commonly 13 or 18 years)
   - For AI platforms in 2025: Google Gemini and Adobe Firefly use 13 as minimum age
   - Include parental consent requirements for minors if applicable
   - Reference: [AI Terms of Service Comparison 2025](https://www.humai.blog/ai-chatbot-terms-of-service-comparison-2025-privacy-rights/)

4. **Changes to Terms**
   - Reserve right to modify terms at any time
   - Specify how users will be notified (email, in-app notification, banner)
   - Indicate whether continued use constitutes acceptance of changes
   - Provide option to review previous versions

### Best Practices for Enforceability

- Place ToS link prominently during registration (directly above "Sign Up" button)
- Use clear, unambiguous acceptance language: "I have read and agree to the Terms of Service"
- Provide ability to save, print, or download terms for user records
- Maintain audit trail of all acceptance events
- Display terms in readable format with appropriate font size and contrast

## Definitions Section

### Key Terms to Define

1. **Service-Related Terms**
   - "Service" or "Platform": The FiskAI application and related services
   - "User," "You," or "Customer": The individual or entity using the service
   - "Account": User's registered access to the platform
   - "Subscription": Paid access plan (Starter, Professional, Enterprise)

2. **Content Definitions**
   - "User Content": Data, files, documents, invoices, expenses uploaded by user
   - "Generated Content": Outputs produced by AI features (receipt extraction, categorization)
   - "Platform Content": FiskAI's software, documentation, interfaces, and branding
   - "Third-Party Content": Content from integrated services (banking APIs, payment processors)

3. **Technical Terms**
   - "Downtime": Periods when service is unavailable
   - "API": Application Programming Interface for integrations
   - "Fiscalization": Croatian tax authority compliance process
   - "E-invoicing": Electronic invoice generation and transmission

4. **Legal Terms**
   - "Intellectual Property Rights": Copyrights, trademarks, patents, trade secrets
   - "Personal Data": Information covered by GDPR/CCPA regulations
   - "Confidential Information": Non-public business or technical data

Reference: [Service Agreements Overview](https://www.sirion.ai/library/contracts/service-agreements/)

## Service Description Section

### What to Include

1. **Core Services Provided**
   - Invoice and expense management functionality
   - AI-powered receipt scanning and categorization
   - Bank account integration and reconciliation
   - Croatian fiscalization (FINA CIS integration)
   - E-invoicing compliance
   - Financial reporting and analytics
   - Document storage and management

2. **Service Availability**
   - Uptime commitments (e.g., 99.9% availability)
   - Scheduled maintenance windows and notification procedures
   - Emergency maintenance right without advance notice
   - Backup and disaster recovery commitments

3. **Technical Requirements**
   - Supported browsers and devices
   - Internet connectivity requirements
   - Mobile app compatibility (iOS/Android versions)
   - Third-party service dependencies (banking APIs, payment processors)

4. **Service Limitations**
   - Feature limitations by subscription tier
   - Storage limits for documents and data
   - API rate limits for integrations
   - Geographic restrictions (if applicable)
   - Beta features disclaimer (provided "as-is" without warranty)

5. **Modifications to Service**
   - Right to add, modify, or discontinue features
   - Notice period for material changes (e.g., 30 days)
   - No liability for temporary service interruptions
   - Grandfather clauses for existing users (if applicable)

Reference: [ToS Agreement Benefits](https://www.partnero.com/articles/terms-of-service-agreements-101-benefits-example--template)

## User Rights and Responsibilities

### Permitted Uses

1. **Account Management**
   - Create one account per user or company
   - Maintain accurate and current account information
   - Use platform for legitimate business purposes
   - Access features included in subscription tier

2. **Data Management**
   - Upload and manage financial documents
   - Generate invoices and track expenses
   - Export data at any time (data portability right)
   - Integrate with supported third-party services

### Prohibited Activities

1. **Security Violations**
   - Attempting to gain unauthorized access to the platform
   - Reverse engineering, decompiling, or disassembling the software
   - Distributing viruses, malware, or harmful code
   - Interfering with security features or circumventing access controls

2. **Misuse of Service**
   - Sharing account credentials with unauthorized users
   - Using service for illegal activities or fraud
   - Uploading content that violates intellectual property rights
   - Generating excessive API calls to burden infrastructure

3. **Content Restrictions**
   - No hateful, discriminatory, or offensive content in user profiles
   - No spam or unsolicited commercial communications
   - No personal data of individuals without proper consent
   - No content that violates applicable laws or regulations

4. **Account Sharing**
   - Account is non-transferable without written permission
   - Each user must have their own account credentials
   - Company accounts may have multiple authorized users per subscription

### Consequences of Violations

- Warning notification for minor infractions
- Temporary account suspension for repeated violations
- Permanent account termination for serious breaches
- Legal action for fraudulent activity or security violations
- No refunds for terminations due to ToS violations

Reference: [Termly ToS Template](https://termly.io/resources/templates/terms-of-service-template/)

## Intellectual Property Rights

### Platform IP Ownership

1. **FiskAI Retains Ownership Of:**
   - All source code, algorithms, and software architecture
   - Platform design, user interface, and user experience
   - FiskAI trademarks, logos, and brand assets
   - Documentation, help articles, and training materials
   - AI models and machine learning algorithms
   - Proprietary features and functionality

2. **User License Grant:**
   - Non-exclusive, non-transferable license to use the platform
   - Limited to subscription term and tier features
   - Cannot sublicense or resell platform access
   - License terminates upon subscription cancellation

Reference: [Incorporating IP Rights in SaaS Agreements](https://www.aipla.org/list/innovate-articles/incorporating-intellectual-property-rights-in-saas-agreements)

### User Content Ownership

1. **User Retains Ownership Of:**
   - All invoices, expenses, and financial documents uploaded
   - Company information, customer data, and product catalogs
   - Business data entered or imported into the platform
   - Original content created using platform features

2. **License to FiskAI:**
   - Users grant FiskAI limited license to process their content
   - License scope: storing, displaying, and processing data to provide services
   - Right to use aggregated, anonymized data for analytics and improvements
   - No ownership claim over user's intellectual property

3. **Important Clarification:**
   - In intellectual property law, copyright is automatically granted to original work
   - Users own content they created by default
   - SaaS agreement must explicitly request permission to use content
   - Without proper clauses, platform may infringe users' IP rights

Reference: [SaaS User Content Ownership](https://www.termsfeed.com/blog/saas-who-owns-content-your-users/)

### AI-Generated Content

1. **Output Ownership**
   - Users retain rights to AI-generated outputs (receipt extractions, categorizations)
   - Users represent they have necessary rights to input data for AI processing
   - Outputs may not be unique; similar inputs may produce similar results

2. **Disclosure Requirements**
   - Users should disclose when content was generated using AI tools
   - Due to machine learning nature, outputs may not be exclusive
   - Platform may produce similar results for other users with similar inputs

3. **User Responsibility**
   - Users solely responsible for ensuring AI-generated content complies with laws
   - Users must verify accuracy of AI outputs before relying on them
   - Platform not liable for decisions based on AI-generated insights

Reference: [AI Terms of Service Best Practices 2025](https://www.humai.blog/ai-chatbot-terms-of-service-comparison-2025-privacy-rights/)

## Payment Terms

### Subscription and Billing

1. **Pricing Structure**
   - Tiered pricing (Starter, Professional, Enterprise)
   - Monthly or annual billing options
   - Prices displayed in local currency (EUR or HRK for Croatian market)
   - All prices exclusive of applicable taxes (VAT added at checkout)

2. **Payment Processing**
   - Automatic recurring billing on subscription anniversary date
   - Accepted payment methods (credit card, bank transfer, SEPA direct debit)
   - Payment processed by third-party provider (Stripe, PayPal)
   - User responsible for maintaining valid payment method

3. **Failed Payments**
   - Automatic retry for failed transactions (3 attempts over 7 days)
   - Email notification of payment failure
   - Account suspension after final failed attempt
   - 30-day grace period before data deletion

### Refunds and Cancellations

1. **Cancellation Policy**
   - Users can cancel subscription at any time
   - Cancellation effective at end of current billing period
   - No prorated refunds for partial months (except EU statutory rights)
   - Access continues until end of paid period

2. **Refund Policy**
   - 14-day money-back guarantee for first-time subscribers (EU consumer law)
   - No refunds after 14-day trial period expires
   - Enterprise plans: Custom refund terms negotiated in contract
   - Refunds processed within 7-10 business days

3. **Price Changes**
   - 30-day advance notice for price increases
   - Existing subscribers grandfathered for one renewal cycle
   - Option to cancel before new pricing takes effect
   - Price decreases applied immediately to all users

### Late Payments and Fees

- Late payment fee: €10 or 5% of invoice amount, whichever is greater
- Interest on overdue amounts: 1.5% per month or maximum allowed by law
- Suspension of service access until payment received
- Collection agency referral for accounts over 90 days past due

Reference: [Legal Requirements for SaaS](https://www.termsfeed.com/blog/legal-requirements-saas/)

## Privacy and Data Protection

### Privacy Policy Integration

1. **Cross-Reference**
   - "Your use of FiskAI is also governed by our Privacy Policy, available at [link]"
   - Privacy Policy details data collection, use, storage, and sharing practices
   - Both documents must be read together for complete understanding
   - In case of conflict, more privacy-protective provision applies

2. **Data Protection Compliance**
   - GDPR compliance for European users (including Croatia)
   - CCPA compliance for California residents (if applicable)
   - ISO 27001 and SOC 2 certifications for security standards
   - Regular third-party security audits

Reference: [AI Personal Data Protection - GDPR CCPA](https://secureprivacy.ai/blog/ai-personal-data-protection-gdpr-ccpa-compliance)

### User Data Rights

1. **GDPR Rights (for EU Users)**
   - Right to Access: Request copy of personal data (30-day response time)
   - Right to Rectification: Correct inaccurate data
   - Right to Erasure: "Right to be forgotten" (with legal exceptions)
   - Right to Data Portability: Export data in machine-readable format
   - Right to Restrict Processing: Limit how data is used
   - Right to Object: Opt-out of specific data processing activities

2. **CCPA Rights (for California Users)**
   - Right to Know: Disclosure of data collection and sharing practices (45-day response)
   - Right to Delete: Request deletion of personal information
   - Right to Opt-Out: Do Not Sell My Personal Information
   - Right to Non-Discrimination: No penalties for exercising privacy rights

3. **Data Retention**
   - Active account data: Retained for duration of subscription
   - Deleted account data: 30-day recovery period, then permanent deletion
   - Legal requirements: Financial data retained 7 years per tax law
   - Backup data: May persist in backups for up to 90 days after deletion

### AI and Data Usage

1. **Training Data Usage**
   - Clarify whether user conversations/data train AI models
   - Best practice: Offer opt-out mechanism for AI training (following Google Gemini 2025 example)
   - Anonymize and aggregate data before using for improvements
   - Never share individual user data with third parties without consent

2. **Data Analytics**
   - Platform may collect usage analytics (feature adoption, performance metrics)
   - Analytics used to improve service quality and user experience
   - Aggregated data may be shared in anonymized form for research or marketing
   - Users can opt-out of non-essential analytics tracking

Reference: [AI Terms of Service Comparison 2025](https://www.humai.blog/ai-chatbot-terms-of-service-comparison-2025-privacy-rights/)

## AI-Specific Terms

### AI Capabilities and Limitations

1. **AI Features Disclosure**
   - Receipt scanning powered by optical character recognition (OCR) and machine learning
   - Expense categorization uses trained classification models
   - Invoice data extraction from uploaded documents
   - Smart suggestions based on historical patterns

2. **Accuracy Disclaimers**
   - AI outputs provided as suggestions, not guaranteed accurate
   - Users must review and verify all AI-generated content
   - Platform not liable for business decisions based on AI recommendations
   - Accuracy improves over time but perfection not guaranteed

3. **Non-Uniqueness of Outputs**
   - Due to machine learning nature, outputs may not be exclusive
   - Other users with similar inputs may receive similar outputs
   - AI models trained on aggregated data from multiple sources
   - No guarantee of unique or confidential AI-generated results

### User Input Responsibilities

1. **Content Rights**
   - Users represent they have rights to all uploaded content
   - Users responsible for obtaining necessary licenses for input data
   - No copyrighted material uploaded without permission
   - Platform not liable for user's infringement of third-party rights

2. **Data Quality**
   - Users responsible for accuracy and completeness of input data
   - "Garbage in, garbage out": AI quality depends on input quality
   - Users should provide clear, legible documents for best AI results

3. **Prohibited Inputs**
   - No sensitive personal data beyond what's necessary for service
   - No attempts to manipulate or poison AI training data
   - No adversarial attacks on AI models (prompt injection, jailbreaking)

### AI Training and Improvement

1. **How User Data May Be Used**
   - Aggregated, anonymized data may improve AI models
   - User conversations may help debug and prevent abuse
   - Feedback signals (corrections, edits) train future models
   - Individual identifiable data never shared without consent

2. **Opt-Out Mechanisms**
   - Users can opt-out of AI training data usage (following 2025 best practices)
   - Opt-out available in Settings > Privacy > AI Training Preferences
   - Opt-out does not affect core service functionality
   - Previously contributed data may remain in trained models

3. **Compliance with AI Regulations**
   - Adherence to EU AI Act requirements (when enforced)
   - Transparency about AI decision-making processes
   - Human oversight for high-stakes automated decisions
   - Regular bias testing and fairness audits

Reference: [AI Terms of Service Best Practices 2025](https://www.humai.blog/ai-chatbot-terms-of-service-comparison-2025-privacy-rights/)

## Disclaimers and Limitation of Liability

### Service Warranties

1. **"As-Is" Disclaimer**
   - Service provided "as-is" and "as-available" without warranties
   - No guarantee of uninterrupted, error-free, or secure service
   - No warranty that service meets all user requirements
   - Especially applies to beta features and experimental capabilities

2. **Implied Warranties Disclaimed**
   - To maximum extent permitted by law, disclaim implied warranties of:
     - Merchantability (fitness for general use)
     - Fitness for particular purpose
     - Non-infringement of third-party rights
     - Title (ownership)

3. **Limitations on Disclaimers**
   - Some jurisdictions don't allow warranty disclaimers (e.g., EU consumer law)
   - Statutory consumer rights cannot be waived
   - Disclaimers apply only to extent permitted by applicable law

### Liability Limitations

1. **Scope of Limitation**
   - FiskAI not liable for indirect, incidental, special, or consequential damages
   - No liability for lost profits, data loss, business interruption
   - No liability for third-party actions (banking API failures, payment processor issues)
   - No liability for user's misuse of platform or violation of laws

2. **Cap on Damages**
   - Maximum liability: Amount paid by user in 12 months preceding claim
   - For free tier users: Maximum liability €100
   - Cap applies per incident and in aggregate

3. **Exceptions to Limitations**
   - Liability cannot be limited for:
     - Death or personal injury caused by negligence
     - Fraud or fraudulent misrepresentation
     - Gross negligence or willful misconduct
     - Violations that cannot be limited by law

### Important Compliance Note

The GDPR has already levied fines totaling over €4.5 billion since 2018, including Amazon ($877 million) and Google ($1.2 billion). FiskAI maintains compliance through:

- SOC 2 and ISO 27001 certifications
- Regular security audits and penetration testing
- Incident response plan for data breaches
- Encryption of data in transit and at rest

Reference: [SaaS Legal Requirements](https://www.njbusiness-attorney.com/how-to-handle-saas-legal-requirements-a-step-by-step-guide/)

## Termination Conditions

### Termination by User

1. **Voluntary Cancellation**
   - User can cancel subscription at any time via Settings > Billing
   - Cancellation effective at end of current billing period
   - Access continues until paid period expires
   - Data available for download during 30-day grace period
   - After 30 days, data permanently deleted (except legal retention requirements)

2. **Data Export Before Termination**
   - Users should export all data before cancellation
   - Export available in JSON, CSV, or PDF formats
   - Document attachments downloadable as ZIP archive
   - No data recovery available after 30-day grace period

### Termination by FiskAI

1. **Grounds for Termination**
   - Material breach of Terms of Service
   - Fraudulent activity or payment disputes
   - Illegal use of platform
   - Repeated violations after warnings
   - Non-payment of fees (after 30-day grace period)

2. **Notice Requirements**
   - 7-day notice for payment-related terminations
   - Immediate termination for security violations or illegal activity
   - Email notification sent to registered email address
   - Opportunity to cure breach (for certain violations)

3. **Effect of Termination**
   - Immediate suspension of platform access
   - License to use service terminates
   - Outstanding fees immediately due and payable
   - No refunds for terminated accounts (except statutory rights)

### Account Inactivity

- Accounts inactive for 24 months may be automatically closed
- 30-day warning email before closure
- Data retention per privacy policy (30 days after closure)
- No fees charged during inactive period for cancelled subscriptions

Reference: [Service Agreements Overview](https://www.sirion.ai/library/contracts/service-agreements/)

## Dispute Resolution

### Governing Law

1. **Jurisdiction**
   - For Croatian users: Croatian law applies, courts in Zagreb have jurisdiction
   - For EU users: Law of user's country of residence may apply (consumer protection)
   - For international users: Croatian law applies unless prohibited

2. **Language**
   - Terms of Service available in Croatian and English
   - In case of discrepancy, Croatian version prevails (for Croatian users)
   - English version authoritative for international users

### Dispute Resolution Process

1. **Informal Resolution (Mandatory First Step)**
   - User must contact support@fiskai.hr with detailed complaint
   - FiskAI commits to good-faith resolution within 30 days
   - Escalation to senior management if initial contact fails
   - Document all communications for potential formal proceedings

2. **Mediation**
   - If informal resolution fails, parties agree to mediation
   - Neutral third-party mediator mutually selected
   - Mediation costs shared equally by both parties
   - Mediation not binding but good-faith participation required

3. **Arbitration (Alternative to Litigation)**
   - Binding arbitration under Croatian Chamber of Economy rules
   - Single arbitrator unless claim exceeds €50,000 (then three arbitrators)
   - Arbitration conducted in Zagreb, Croatia
   - Arbitration decision final and binding, limited appeal rights

4. **Litigation (Last Resort)**
   - If mediation and arbitration fail, litigation in Croatian courts
   - User can bring consumer protection claims in their home country (EU law)
   - Small claims court option for claims under €10,000
   - Prevailing party may recover legal fees (per Croatian law)

### Class Action Waiver

- Users agree to resolve disputes individually, not as class actions
- No participation in class action lawsuits against FiskAI
- Exception: Waivers void where prohibited by law (many EU countries)
- US users specifically bound by class action waiver to extent permitted

Reference: [Terms of Service Essential Sections](https://usercentrics.com/guides/terms-of-service/)

## Modification of Terms

### Change Notification Process

1. **Advance Notice**
   - 30-day notice for material changes to terms
   - Email notification to registered email address
   - In-app banner notification upon next login
   - Summary of key changes highlighted in notification

2. **Review Period**
   - Users can review proposed changes during notice period
   - Link to side-by-side comparison of old vs. new terms
   - Option to download current version before changes take effect

3. **Acceptance or Rejection**
   - Continued use after effective date constitutes acceptance
   - Users who disagree may cancel subscription before effective date
   - No penalty for cancellation due to terms changes
   - Prorated refund available for annual subscribers who cancel

### Version Control

- Each version assigned effective date and version number
- Previous versions archived and accessible via footer link
- Version history shows date and summary of changes
- Users can see which version they accepted during registration

### Non-Material Changes

- Minor updates (typos, clarifications, formatting) made without notice
- Changes required by law implemented immediately
- Updated "Last Modified" date shown at top of terms
- Material vs. non-material determination at FiskAI's discretion

## Page Design and User Experience

### Layout Best Practices

1. **Readability**
   - Plain language where possible, avoiding excessive legalese
   - Short paragraphs (3-5 sentences maximum)
   - Clear section headings with numbering (1, 1.1, 1.1.1)
   - Adequate line spacing (1.5 or double-spaced)
   - Font size: Minimum 12pt for body text, 16pt for headings
   - High contrast: Dark text on light background

2. **Navigation**
   - Table of contents with jump links to sections
   - "Back to top" button for easy navigation
   - Sticky header with key sections
   - Collapsible sections for long content (optional)
   - Progress indicator for long documents

3. **Accessibility**
   - WCAG 2.1 Level AA compliance
   - Screen reader compatible (proper heading hierarchy)
   - Keyboard navigation support
   - Alternative text for icons and images
   - Skip navigation link for assistive technologies

### User Acceptance UI

1. **Clickwrap Implementation**
   - Checkbox with label: "I have read and agree to the Terms of Service"
   - Hyperlinked "Terms of Service" opens in new tab/modal
   - Unchecked by default (pre-checked boxes legally questionable)
   - Submit button disabled until checkbox checked
   - Clear visual focus states for keyboard navigation

2. **Placement During Registration**
   - Acceptance checkbox immediately above "Create Account" button
   - Terms link positioned near acceptance element
   - No other distractions between terms and CTA
   - Mobile-friendly touch targets (minimum 44x44px)

3. **Record Keeping**
   - Backend logs: User ID, timestamp, IP address, ToS version
   - Audit trail for compliance verification
   - Retention: Keep acceptance records for 7+ years (statute of limitations)

Reference: [Legal Requirements for SaaS](https://www.termsfeed.com/blog/legal-requirements-saas/)

## Compliance Penalties and Enforcement

### Potential Consequences of Non-Compliance

1. **GDPR Violations**
   - Maximum fine: 4% of global annual revenue or €20 million (whichever is greater)
   - Amazon fined $877 million for GDPR violations
   - Google fined $1.2 billion for privacy violations
   - Reference: [GDPR Enforcement](https://secureprivacy.ai/blog/ai-personal-data-protection-gdpr-ccpa-compliance)

2. **CCPA Violations**
   - Maximum fine: $7,500 per intentional violation
   - Enforced by California Attorney General
   - Private right of action for data breaches ($100-$750 per consumer per incident)

3. **Unenforceable Terms Risks**
   - Courts may invalidate entire agreement if key provisions unenforceable
   - "Browsewrap" agreements frequently rejected by courts
   - Lack of clear acceptance = no binding contract
   - Users may claim they never agreed to terms

### Best Practices for Enforcement

- Regular legal review (annually or when laws change)
- A/B testing acceptance flows for compliance
- User acceptance analytics (completion rates, drop-off points)
- Consultation with local counsel for international users
- Updates to reflect 2025 regulatory changes (EU AI Act, CCPA amendments)

## Dependencies

- **Depends on**: None (standalone legal page, accessible without authentication)
- **Depended by**:
  - [[auth-registration]] - User must accept ToS during signup
  - [[settings-billing]] - Payment terms referenced during subscription management
  - [[marketing-landing]] - Footer links to ToS for transparency

## Integrations

None - This is a static legal page with no external API integrations. However, acceptance events are logged internally for audit compliance.

## Verification Checklist

- [ ] All 11 essential sections included (Introduction, Definitions, Service Description, etc.)
- [ ] Clickwrap acceptance mechanism implemented (checkbox + button)
- [ ] Terms link prominently placed during registration flow
- [ ] Version number and effective date displayed at top
- [ ] "Last updated" date shown and accurate
- [ ] Table of contents with jump links functional
- [ ] Plain language used where possible, legalese minimized
- [ ] Mobile-responsive design tested on iOS and Android
- [ ] Accessibility standards met (WCAG 2.1 Level AA)
- [ ] Footer link to Terms of Service works on all pages
- [ ] Backend logging of acceptance events (user ID, timestamp, IP, version)
- [ ] GDPR and CCPA compliance provisions included
- [ ] AI-specific terms address training data, output ownership, accuracy disclaimers
- [ ] Intellectual property sections clarify platform vs. user content ownership
- [ ] Dispute resolution process detailed with jurisdiction specified
- [ ] Modification notification process described (30-day notice for material changes)
- [ ] Legal review completed by Croatian counsel (for local compliance)
- [ ] Previous versions archived and accessible
- [ ] Email notification system configured for terms updates
- [ ] Data export functionality available before account termination

## Evidence Links

1. [Terms of Service: Meaning, Examples, And How to Create One](https://usercentrics.com/guides/terms-of-service/) - Comprehensive guide covering essential sections, acceptance mechanisms, and best practices for creating legally binding ToS agreements
2. [Service Agreements: A Comprehensive Overview [2025 Updated]](https://www.sirion.ai/library/contracts/service-agreements/) - Details on definitions section, termination conditions, and service agreement structures for 2025
3. [What Is a Terms of Service Agreement? Benefits, Examples & Free Template](https://www.partnero.com/articles/terms-of-service-agreements-101-benefits-example--template) - Service description best practices, user rights and responsibilities, and ToS benefits for platforms
4. [Sample Terms of Service Template](https://termly.io/resources/templates/terms-of-service-template/) - Ready-to-use template covering prohibited activities, user conduct, and liability disclaimers
5. [Incorporating Intellectual Property Rights In SaaS Agreements](https://www.aipla.org/list/innovate-articles/incorporating-intellectual-property-rights-in-saas-agreements) - Deep dive into IP ownership, licensing structures, and protecting platform intellectual property
6. [Legal Requirements for SaaS - TermsFeed](https://www.termsfeed.com/blog/legal-requirements-saas/) - Payment terms, privacy compliance, and essential legal documents for SaaS platforms
7. [AI and Personal Data Protection | Navigating GDPR and CCPA Compliance](https://secureprivacy.ai/blog/ai-personal-data-protection-gdpr-ccpa-compliance) - AI-specific compliance requirements, data protection regulations, and penalties for non-compliance
8. [AI Terms of Service Compared: Privacy & Rights Guide 2025](https://www.humai.blog/ai-chatbot-terms-of-service-comparison-2025-privacy-rights/) - 2025 AI platform ToS comparison, training data policies, and opt-out mechanisms
9. [How to Handle SaaS Legal Requirements | SaaS Law Firm](https://www.njbusiness-attorney.com/how-to-handle-saas-legal-requirements-a-step-by-step-guide/) - Step-by-step legal compliance guide, disclaimers, and limitation of liability clauses
10. [SaaS, Who Owns the Content of Your Users? - TermsFeed](https://www.termsfeed.com/blog/saas-who-owns-content-your-users/) - User content ownership, automatic copyright grants, and licensing requirements for SaaS platforms
11. [Key Terms in the SaaS Agreement: Intellectual Property and Data](https://spzlegal.com/blog/key-terms-saas-agreement-intellectual-property-and-data) - Provider vs. customer IP, data ownership distinctions, and contract negotiation strategies
