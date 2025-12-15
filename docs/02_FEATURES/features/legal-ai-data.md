# Feature: AI Data Policy Page

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 10
- Complexity: Low

## Purpose

Provides a dedicated policy page at /ai-data-policy that transparently discloses how FiskAI collects, processes, and uses data for AI/ML operations. This page addresses regulatory requirements under GDPR, CCPA, and the EU AI Act, ensuring users understand data governance practices, automated decision-making processes, individual rights regarding AI systems, and compliance measures. The page serves as a critical trust signal and legal compliance mechanism for FiskAI's AI-powered features including receipt OCR, category suggestions, and AI assistants.

## User Entry Points

| Type     | Path                          | Evidence                    |
| -------- | ----------------------------- | --------------------------- |
| Page     | /ai-data-policy               | New route to be implemented |
| Footer   | "AI Data Usage" link          | Legal section of footer     |
| Privacy  | Reference from privacy policy | Cross-reference link        |
| Settings | AI settings data policy link  | Settings page AI section    |

## Core Flow

### View AI Data Policy Page

1. User navigates to /ai-data-policy from footer, privacy policy, or settings
2. Page renders with SEO metadata (title, description, canonical URL)
3. Hero section displays page title "AI Data Usage Policy" and last updated date
4. Introduction section explains FiskAI's use of AI/ML technologies
5. Table of contents provides quick navigation to policy sections
6. Main content sections cover all required disclosure areas
7. User can expand/collapse sections for easier reading
8. Contact information provided for AI-related data questions
9. Version history link shows policy update timeline

### AI Technologies Disclosure Section

1. Section header: "AI Technologies We Use"
2. List of AI-powered features in FiskAI:
   - Receipt and invoice OCR (text extraction)
   - Expense category suggestions
   - Banking transaction categorization
   - AI chat assistant for accounting questions
   - Document data extraction and validation
3. Technology providers disclosed (e.g., OpenAI, Google Cloud Vision)
4. Purpose statement for each AI feature
5. Legal basis for processing under GDPR Article 6

### Data Collection & Processing Section

1. Section header: "Data Collection for AI Systems"
2. Types of data collected for AI training and processing:
   - Receipt/invoice images and scanned documents
   - User feedback on AI suggestions
   - Interaction data with AI assistant
   - Transaction descriptions and patterns
   - Correction data for model improvement
3. Data minimization principle explanation
4. Retention periods for AI-related data
5. Anonymization and pseudonymization practices
6. Cross-border data transfers for AI processing

### Automated Decision-Making Section

1. Section header: "Automated Decision-Making and Your Rights"
2. GDPR Article 22 compliance disclosure
3. List of automated decisions made by AI:
   - Expense category assignment
   - Transaction matching suggestions
   - VAT rate recommendations
   - Document field extraction
4. Right to human review and intervention
5. How to contest automated decisions
6. Explanation of decision logic and reasoning
7. CCPA ADMT (Automated Decision-Making Technology) compliance
8. California residents' right to opt-out of ADMT

### Data Governance & Quality Section

1. Section header: "AI Data Governance"
2. EU AI Act Article 10 compliance measures
3. Data quality standards:
   - Relevance and representativeness
   - Error detection and correction
   - Completeness verification
   - Statistical property maintenance
4. Training dataset governance
5. Validation and testing procedures
6. Bias detection and mitigation practices
7. Human oversight mechanisms
8. Regular audit schedule

### Individual Rights Section

1. Section header: "Your Rights Regarding AI Processing"
2. Right to access AI processing information
3. Right to rectification of training data
4. Right to erasure (right to be forgotten)
5. Right to object to AI processing
6. Right to data portability
7. Right to explanation of AI decisions
8. How to exercise each right (contact methods)
9. Response timeline commitments

### Third-Party AI Services Section

1. Section header: "Third-Party AI Processors"
2. List of AI service providers:
   - OpenAI (GPT models for assistant)
   - Google Cloud Vision (OCR processing)
   - Custom ML models (on-premise)
3. Data Processing Agreements (DPA) in place
4. Sub-processor disclosure
5. Data transfer safeguards
6. Provider compliance certifications

### Security & Privacy Measures Section

1. Section header: "AI Data Security"
2. Encryption in transit and at rest
3. Access control for AI training data
4. Privacy-enhancing technologies (PETs)
5. Anonymization before external processing
6. Model security and reverse-engineering protection
7. Incident response for AI data breaches
8. Regular security audits

### Data Retention & Deletion Section

1. Section header: "Data Retention for AI"
2. Retention periods by data type:
   - OCR processed images: 90 days
   - AI feedback data: 2 years
   - Training datasets: 3 years
   - Anonymized analytics: 5 years
3. Automatic deletion schedules
4. User-initiated deletion process
5. Backup retention policies
6. Legal hold exceptions

### Transparency & Accountability Section

1. Section header: "AI Transparency Commitments"
2. Clear AI interaction indicators
3. Model cards and documentation
4. Performance metrics disclosure
5. Bias testing results
6. Regular transparency reports
7. Stakeholder engagement process
8. Continuous monitoring and improvement

### Contact & Updates Section

1. Contact information for AI data inquiries
2. Data Protection Officer (DPO) contact
3. How to submit complaints or concerns
4. Policy update notification process
5. Version history and changelog
6. Effective date of current policy

## Key Modules

| Module               | Purpose                              | Location                                            |
| -------------------- | ------------------------------------ | --------------------------------------------------- |
| AI Data Policy Page  | Main policy page component           | `src/app/(marketing)/ai-data-policy/page.tsx` (new) |
| Marketing Layout     | Footer with AI policy link           | `src/app/(marketing)/layout.tsx`                    |
| Privacy Policy       | Cross-reference to AI policy         | `src/app/(marketing)/privacy/page.tsx`              |
| AI Settings          | User AI preferences with policy link | `src/app/(dashboard)/settings/ai/page.tsx` (new)    |
| Policy Version Store | Track policy updates                 | `src/lib/legal/policy-versions.ts` (new)            |

## Data

### Policy Metadata

- Title: "FiskAI — AI Data Usage Policy"
- Description: "Learn how FiskAI uses artificial intelligence and machine learning, including data collection, processing, and your rights under GDPR and CCPA."
- Last Updated: Dynamic (current date)
- Version: Semantic versioning (e.g., 1.0.0)
- Effective Date: Date policy takes effect

### AI Features Inventory

List of AI-powered features requiring disclosure:

1. **Receipt OCR** -> `src/app/(dashboard)/expenses/receipt-scanner/*`
   - Technology: Google Cloud Vision API
   - Data processed: Receipt images, extracted text
   - Purpose: Automate expense data entry
   - Retention: 90 days

2. **Category Suggestions** -> `src/lib/ai/category-suggestions.ts`
   - Technology: Custom ML model
   - Data processed: Transaction descriptions, user corrections
   - Purpose: Suggest expense categories
   - Retention: Training data 2 years

3. **AI Assistant** -> `src/app/(dashboard)/ai-assistant/*`
   - Technology: OpenAI GPT-4
   - Data processed: User questions, context data
   - Purpose: Answer accounting questions
   - Retention: Session-based, 30 days for improvement

4. **Document Extraction** -> `src/lib/ai/document-extraction.ts`
   - Technology: Hybrid (Cloud Vision + Custom)
   - Data processed: Invoice/expense PDFs
   - Purpose: Extract structured data
   - Retention: 90 days

5. **Transaction Matching** -> `src/lib/ai/transaction-matching.ts`
   - Technology: Custom ML model
   - Data processed: Bank transactions, invoice data
   - Purpose: Auto-match transactions to invoices
   - Retention: Training data 2 years

### Regulatory Compliance Matrix

| Regulation        | Requirement                | FiskAI Implementation                       |
| ----------------- | -------------------------- | ------------------------------------------- |
| GDPR Art. 5       | Data minimization          | Only essential data for AI features         |
| GDPR Art. 13      | Transparency               | Detailed AI processing disclosures          |
| GDPR Art. 22      | Automated decisions        | Human review available for all AI decisions |
| GDPR Art. 25      | Data protection by design  | Privacy-first AI architecture               |
| EU AI Act Art. 10 | Data governance            | Quality standards, bias testing             |
| EU AI Act Art. 13 | Transparency for deployers | System capabilities and limitations         |
| EU AI Act Art. 50 | Provider obligations       | AI disclosure in product                    |
| CCPA ADMT         | Automated decision-making  | Pre-use notice, access rights, opt-out      |
| California CPPA   | Risk assessments           | Annual privacy risk assessments             |

### User Rights Implementation

- **Access Request**: Submit via settings or email, 30-day response
- **Rectification**: Correct AI training data through feedback interface
- **Erasure**: Delete all AI-related data, 14-day processing
- **Objection**: Opt-out of specific AI features in settings
- **Portability**: Export AI interaction data in JSON/CSV format
- **Explanation**: Request human explanation of any AI decision

## Navigation & SEO

### Internal Links

- Footer legal section: /ai-data-policy link
- Privacy policy: Reference to AI policy
- Terms of service: AI processing terms
- AI settings page: "Learn more about our AI data policy"
- Help center: AI transparency articles

### External Links

None (all regulatory references are informational, not linked)

### SEO

- Sitemap priority: 0.5
- Change frequency: monthly
- Canonical URL: /ai-data-policy
- Robots: index, follow
- Schema.org markup: WebPage + FAQPage

## Evidence Links

1. **GDPR AI Processing Requirements**: [EDPB Opinion on AI Models and GDPR Principles](https://www.edpb.europa.eu/news/news/2024/edpb-opinion-ai-models-gdpr-principles-support-responsible-ai_en)
   - GDPR principles (accountability, fairness, transparency, accuracy) for AI systems
   - Article 22 automated decision-making rights and safeguards
   - Data protection by design and data minimization requirements

2. **EU AI Act Data Governance**: [Article 10: Data and Data Governance - EU AI Act](https://artificialintelligenceact.eu/article/10/)
   - Training, validation, and testing data quality requirements
   - Data governance practices for high-risk AI systems
   - Statistical properties and bias mitigation standards

3. **AI Transparency Requirements**: [Article 50: Transparency Obligations - EU AI Act](https://artificialintelligenceact.eu/article/50/)
   - Provider disclosure obligations for AI systems
   - User notification when interacting with AI
   - Model documentation and performance capabilities

4. **CCPA Automated Decision-Making**: [California CPPA ADMT Regulations](https://cppa.ca.gov/regulations/ccpa_updates.html)
   - Automated Decision-Making Technology (ADMT) disclosure requirements
   - Pre-use notice and consumer rights (access, opt-out, appeal)
   - Risk assessment requirements effective January 1, 2027

5. **AI Policy Best Practices 2025**: [SecureFrame - Why You Need an AI Policy in 2025](https://secureframe.com/blog/ai-policy)
   - Formal governance structures for AI systems
   - Data retention and deletion policies
   - Continuous compliance monitoring and regular policy reviews

6. **Machine Learning Privacy Requirements**: [TermsFeed - How to Collect Consent for AI and Machine Learning](https://www.termsfeed.com/blog/consent-ai-machine-learning/)
   - GDPR and CCPA consent requirements for ML data
   - Purpose limitation and data minimization for AI
   - Individual rights (access, rectification, erasure) implementation

7. **GDPR Article 22 Compliance**: [GDPR-Info.eu - Art. 22 Automated Decision-Making](https://gdpr-info.eu/art-22-gdpr/)
   - Right not to be subject to solely automated decisions
   - Requirements for human intervention and contestation
   - Safeguards for data subject rights and freedoms

8. **AI Data Governance Best Practices**: [PMI - AI Data Governance Best Practices](https://www.pmi.org/blog/ai-data-governance-best-practices)
   - Data quality and integrity for AI models
   - Human oversight requirements
   - Building culture of privacy and responsibility

9. **GDPR Machine Learning Guide**: [GDPR Local - GDPR for Machine Learning](https://gdprlocal.com/gdpr-machine-learning/)
   - Legal basis for AI processing (legitimate interest assessment)
   - Privacy by design for AI development lifecycle
   - Data Protection Impact Assessment (DPIA) for high-risk AI

10. **AI Transparency Disclosure Guide**: [GDPR Local - AI Transparency Requirements](https://gdprlocal.com/ai-transparency-requirements/)
    - Core transparency elements: traceability, explainability, interpretability
    - Data usage disclosure and documentation requirements
    - Model cards, performance metrics, and bias testing results

## Implementation Notes

### Required Development

1. Create new route: `/src/app/(marketing)/ai-data-policy/page.tsx`
2. Add footer link in marketing layout
3. Create cross-reference in privacy policy
4. Implement AI settings page with policy link
5. Add policy version tracking system
6. Create changelog for policy updates

### Content Requirements

- Minimum 2,500 words for comprehensive coverage
- Plain language explanations (max 8th grade reading level)
- Croatian translation required for full compliance
- Legal review required before publication
- Annual review and update schedule

### Compliance Checklist

- [ ] GDPR Article 13 transparency obligations
- [ ] GDPR Article 22 automated decision-making disclosures
- [ ] EU AI Act Article 10 data governance requirements
- [ ] EU AI Act Article 50 transparency obligations
- [ ] CCPA ADMT pre-use notice requirements
- [ ] California CPPA risk assessment disclosures
- [ ] Data retention policy aligned with actual practices
- [ ] Contact methods for exercising rights
- [ ] Version control and update notifications
- [ ] Accessibility compliance (WCAG 2.1 AA)

### Legal Considerations

- Consult with data protection lawyer before publication
- Ensure consistency with Privacy Policy and Terms of Service
- Document all AI data flows and processing activities
- Maintain Data Processing Agreements with AI vendors
- Conduct Data Protection Impact Assessment for AI features
- Implement technical measures described in policy
- Train staff on AI policy and user rights handling
- Establish internal audit schedule for compliance verification
