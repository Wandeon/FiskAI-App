# Feature: Document Scanner (F075)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 40

## Purpose

The Document Scanner feature enables automated processing and data extraction from various financial documents including bank statements, invoices, receipts, and other business documents via the /import endpoint. Using AI-powered OCR (Optical Character Recognition) and multimodal large language models, the system automatically extracts structured data, validates financial information, performs reconciliation, and populates FiskAI's database with transaction records. The feature supports multiple file formats (PDF, JPEG, PNG, WebP, HEIC), handles complex layouts including multi-page documents and tables, and achieves 99%+ accuracy through modern LLM-powered vision models. Documents are processed through an intelligent workflow that includes format detection, OCR extraction, data validation, entity matching, and automated reconciliation with existing records.

## User Entry Points

| Type   | Path                | Purpose                            |
| ------ | ------------------- | ---------------------------------- |
| Page   | /import             | Document upload and processing hub |
| API    | /api/documents/scan | Document processing endpoint       |
| Action | importDocument      | Server action for document import  |

## Core Flow

1. User navigates to /import endpoint
2. System validates authentication and company context
3. User uploads document (PDF, image, or multi-page file)
4. System converts document to processable format
5. Document type detection determines processing pipeline
6. OCR engine extracts raw text and structure
7. AI model parses structured data based on document type
8. System validates extracted financial data
9. Entity matching identifies existing contacts/vendors
10. Reconciliation engine matches transactions with records
11. User reviews extracted data with confidence scores
12. User approves, corrects, or rejects extraction
13. System imports validated data into database
14. AI feedback collected for continuous improvement
15. Audit trail created for compliance

## Document Types Supported

### Bank Statements

Bank statements contain transaction history, account balances, and financial activity for a specific period. Modern OCR systems achieve 99.8% accuracy on bank statements, processing documents in 3-5 seconds regardless of layout complexity.

**Key Data Fields**:

- Account number and holder information
- Statement period (start and end dates)
- Opening and closing balances
- Transaction list with dates, descriptions, amounts
- Debits and credits clearly separated
- Running balance after each transaction
- Currency and multi-currency support

**Processing Challenges**:

- Multi-column layouts spanning multiple pages
- Complex table structures with nested information
- Handwritten annotations or corrections
- Poorly scanned or photographed documents
- Bank-specific formatting and terminology
- Multi-currency transactions requiring conversion

**Technology**: Microsoft Azure Document Intelligence provides specialized bank statement extraction models that combine OCR with deep learning. The system processes up to 2,000 pages per document (500MB file size limit) and automatically detects text in 200+ languages.

### Invoices and Bills

Invoices are structured business documents requiring precise extraction of line items, totals, tax calculations, and vendor information. Intelligent Document Processing (IDP) systems extract key fields including vendor name, invoice number, date, line items with quantities and prices, subtotals, tax amounts, and totals.

**Key Data Fields**:

- Vendor information (name, address, tax ID/OIB)
- Invoice number and issue date
- Payment terms and due date
- Line items with descriptions, quantities, unit prices
- Subtotal, tax breakdown (PDV/VAT), total amount
- Payment method and bank details
- Customer/buyer information

**Processing Capabilities**:

- Handles 27+ languages including Croatian
- Extracts tables and line items accurately
- Calculates and validates tax amounts
- Supports various invoice formats and layouts
- Processes both machine-printed and handwritten invoices
- Returns structured JSON data representation

**Use Cases**:

- Automated accounts payable processing
- Invoice matching with purchase orders
- Three-way matching (PO, invoice, delivery ticket)
- Straight-through processing for validated invoices
- Discrepancy flagging for manual review

### Receipts

Receipt processing extracts vendor information, purchased items, prices, tax amounts, and payment methods from retail receipts. Modern OCR systems handle Croatian-specific terms (PDV for VAT, Ukupno for Total) and process receipts in under 5 seconds.

**Key Data Fields**:

- Vendor name and tax ID (OIB)
- Receipt date and time
- Individual items with quantities and prices
- Subtotal, VAT amount, total
- Payment method (cash, card, transfer)
- Receipt number for reference

**Technology Features**:

- Handles various receipt formats and layouts
- Processes both printed and handwritten text
- Works with poorly scanned or photographed images
- Extracts data from thermal printer receipts
- Supports multiple languages simultaneously

### Tax Forms and Financial Statements

Tax forms (P&L statements, balance sheets, cash flow statements) require extraction of complex financial data with high accuracy. Automated systems reduce error rates from 5-10% (manual) to below 1% (AI-powered).

**Processing Requirements**:

- Table extraction spanning multiple pages
- Formula and calculation recognition
- Footnote and reference extraction
- Cross-referencing between sections
- Validation of mathematical relationships
- Support for various accounting standards

**Benefits**:

- Saves 25% of workweek time on data entry
- Reduces costs by $12.9M/year (average per Gartner)
- Improves compliance and audit readiness
- Enables 42% automation of finance activities (McKinsey)

## AI Technologies and Models

### Optical Character Recognition (OCR)

Modern OCR has evolved from simple character recognition to sophisticated document understanding systems that comprehend layout, structure, and context.

#### Traditional OCR Libraries

**Tesseract (Google)**

- Most established open-source OCR engine
- Supports 100+ languages including Croatian
- High accuracy for printed text
- Limitations: Struggles with handwriting, complex layouts, tables
- Best for: Simple documents with clear text

**PaddleOCR**

- Advanced features for complex, structured documents
- Excellent for invoices requiring text and layout extraction
- Strong performance in Chinese and English
- Requires GPU for optimal performance
- Handles tables and multi-column layouts

**EasyOCR**

- Beginner-friendly with easy integration
- Supports 80+ languages
- Good balance of accuracy and ease of use
- CPU and GPU support

#### Modern AI-Powered OCR

**Mistral OCR**

- Processes 2,000 pages per minute on single GPU
- 99%+ accuracy across 11+ languages
- Interprets tables, forms, invoices with unprecedented cognition
- Lighter weight than competitors
- Available via API

**Google Document AI**

- 25 years of OCR research
- Detects text in 200+ languages
- Powered by generative AI for out-of-box accuracy
- Fine-tunable with as few as 10 documents
- Enterprise-grade with Workbench interface

**Microsoft Azure Document Intelligence**

- Extracts text, key-value pairs, tables, structure
- Supports printed and handwritten forms
- Specialized models for invoices, receipts, bank statements
- Processes up to 2,000 pages per document
- Returns structured, actionable JSON data

**AWS Textract**

- Automatic multi-language detection
- Machine learning improves accuracy over time
- Handles complex layouts and variations
- Form field extraction with confidence scores

### Multimodal Large Language Models

Multimodal LLMs represent the cutting edge of document understanding, treating OCR as part of broader visual-language reasoning.

#### GPT-4 Vision and GPT-4o

**Architecture**:

- Fully unified multimodal Transformer
- Processes image patches, audio, text in single sequence
- No separate vision tower needed
- Tokenizes visual content alongside text

**GPT-4o (Omni)**:

- Understands text, vision, audio modalities simultaneously
- Single unified model for any input/output combination
- Best for high-accuracy visual analysis
- Supports complex document reasoning

**Document Processing Capabilities**:

- Reads and interprets complex layouts
- Understands relationships between elements
- Extracts structured data with context
- Handles multi-page document analysis
- OCR in 100+ languages

#### Claude 3 and Claude 3.5 Vision

**Key Advantages**:

- Context window up to 2 million tokens
- Ideal for lengthy document processing
- Superior for document-heavy workflows
- Clear and structured visual reasoning

**Claude 3.5 Vision**:

- Excels at OCR and diagram interpretation
- Superior image-to-text analysis
- Best for research teams and educators
- Consistent and reliable multimodal explanations
- Low hallucination rates

**Use Cases**:

- Multi-page financial document analysis
- Contract and legal document review
- Technical documentation processing
- Complex table extraction

#### Qwen 2.5-VL and Qwen 3-VL

**Qwen 2.5-VL**:

- Available in 2B, 7B, 72B parameter sizes
- Supports 90+ languages
- Excellent OCR and scientific reasoning
- Strong performance on DocVQA benchmark
- Open-source alternative to proprietary models

**Qwen 3-VL-235B**:

- Rivals GPT-5 and Gemini-2.5-Pro
- Excels across multimodal benchmarks
- OCR in 32 languages
- Reads text in low-light, blurred, tilted images
- Accurately parses complex documents, forms, layouts

#### Gemini 2.5 Pro

**Capabilities**:

- Best for general multimodal tasks
- Strong scientific task performance
- Handles images, video, audio
- Large context window for entire documents

**Limitations**:

- Weaker in math reasoning
- Higher hallucination risk vs. Claude

### Specialized Document AI Models

#### GOT-OCR 2.0 (General OCR Transformer)

- Treats OCR as holistic vision-language task
- Unifies document parsing, formula reading, scene text detection
- Chart interpretation under single architecture
- State-of-the-art on complex document benchmarks

#### Datalab Marker (with Surya)

- Full end-to-end OCR pipeline
- Converts PDFs and images to JSON, Markdown, HTML
- Deterministic layout parsing
- Specialized for tables, equations, code blocks
- Production-ready document processing

#### MiniCPM-V

- Efficient model for edge device deployment
- 8B model outperforms GPT-4V on 11 benchmarks
- Processes high-resolution images at any aspect ratio
- Robust OCR with low hallucination rates
- Ideal for privacy-sensitive deployments

## Document Processing Workflow

### Phase 1: Document Upload and Validation

**File Format Support**:

- PDF documents (single or multi-page)
- Image formats: JPEG, PNG, WebP, HEIC
- Maximum file size: 10MB (configurable to 500MB)
- Batch upload support for multiple documents

**Validation Steps**:

1. File type verification
2. File size checking
3. Malware scanning
4. Format compatibility check
5. Page count detection
6. Quality assessment (resolution, clarity)

**Conversion Pipeline**:

- PDF to image conversion for processing
- Image optimization and normalization
- Resolution enhancement (up to 300 DPI)
- Aspect ratio preservation
- Color accuracy maintenance

### Phase 2: Document Type Detection

**Classification Methods**:

- Deep convolutional neural networks (AlexNet-based)
- Classifies into: handwritten, machine-printed, receipts, invoices, statements
- Layout analysis for structure recognition
- Header/footer pattern matching
- Logo and branding detection

**Detection Confidence**:

- High confidence (>90%): Proceed automatically
- Medium confidence (60-90%): Request user confirmation
- Low confidence (<60%): Prompt user to specify type

### Phase 3: OCR Extraction

**Text Extraction**:

- Vision transformer (ViT) produces visual embeddings
- LLM performs attention over text and visual embeddings
- Infers relationships and structure
- Produces natural language descriptions
- Extracts structured JSON data

**Layout Understanding**:

- Table detection and cell extraction
- Multi-column layout handling
- Header and footer identification
- Section hierarchy recognition
- Form field detection

**Language Support**:

- Croatian primary language support
- Croatian financial terminology (PDV, OIB, Ukupno)
- Multi-language detection
- Automatic language switching within documents

### Phase 4: Data Structuring

**Structured Output Format (JSON)**:

```json
{
  "documentType": "bank_statement|invoice|receipt",
  "vendor": {
    "name": "string",
    "oib": "11-digit-string",
    "address": "string",
    "contact": "string"
  },
  "documentInfo": {
    "number": "string",
    "date": "YYYY-MM-DD",
    "dueDate": "YYYY-MM-DD",
    "currency": "EUR"
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": "decimal",
      "type": "debit|credit",
      "balance": "decimal",
      "reference": "string"
    }
  ],
  "lineItems": [
    {
      "description": "string",
      "quantity": "decimal",
      "unitPrice": "decimal",
      "amount": "decimal",
      "vatRate": "decimal"
    }
  ],
  "totals": {
    "subtotal": "decimal",
    "vatAmount": "decimal",
    "total": "decimal"
  },
  "confidence": {
    "overall": 0.95,
    "fields": {
      "vendor": 0.98,
      "date": 0.92,
      "amount": 0.97
    }
  }
}
```

**Field Validation**:

- Date format verification (YYYY-MM-DD)
- Amount precision and decimal handling
- OIB validation (11-digit Croatian tax ID)
- Currency code validation (ISO 4217)
- Mathematical consistency checks (line items sum to subtotal)

### Phase 5: Entity Matching and Reconciliation

**Vendor/Contact Matching**:

- Search by OIB (exact match)
- Search by name (fuzzy matching)
- Address matching for disambiguation
- Historical transaction matching
- Confidence scoring for matches

**Transaction Reconciliation**:

- Match with existing bank transactions
- Compare amounts and dates (tolerance windows)
- Reference number matching
- Description similarity scoring
- Multi-criteria matching algorithm

**Reconciliation Accuracy**:

- Automated systems achieve 99%+ accuracy
- Reduce reconciliation time by 80% (Gartner 2023)
- Eliminate 95% of manual errors
- Process in real-time vs. hours for manual

**Exception Handling**:

- Unmatched transactions flagged for review
- Discrepancy highlighting with explanations
- Suggested corrections based on patterns
- Exception queue for manual resolution

### Phase 6: User Review and Approval

**Review Interface Components**:

- Side-by-side original document preview
- Extracted data in editable form fields
- Confidence scores per field (color-coded)
- Validation warnings for suspicious data
- Similar transaction suggestions

**Confidence Indicators**:

- High (≥80%): Green badge "Visoka pouzdanost"
- Medium (≥60%): Yellow badge "Srednja pouzdanost"
- Low (<60%): Red badge "Niska pouzdanost"

**User Actions**:

- Approve: Accept all extracted data
- Edit: Modify specific fields before approval
- Reject: Discard extraction entirely
- Request Re-scan: Trigger re-processing

**Bulk Operations**:

- Approve multiple documents at once
- Batch corrections for recurring errors
- Template-based correction application

### Phase 7: Data Import and Storage

**Database Operations**:

- Transaction creation/update
- Contact creation or linking
- Invoice/expense record creation
- Document attachment linking
- Audit trail creation

**Storage Architecture**:

- Original documents in R2/S3 storage
- Extracted JSON in database
- Tenant isolation (companyId)
- Version history for corrections
- Soft delete support

**Batch Processing**:

- Queue-based processing for large uploads
- Background job execution
- Progress tracking and notifications
- Retry logic for failures

## Rate Limiting and Cost Control

### Subscription-Based Limits

**Plan Configuration**:

- **pausalni**: 100 AI calls/month, 50 document scans
- **obrtnicki**: 500 AI calls/month, 250 document scans
- **obrt_vat**: 1,000 AI calls/month
- **doo_small**: 2,000 AI calls/month
- **doo_standard**: 5,000 AI calls/month
- **enterprise**: Unlimited usage
- **trial**: 20 AI calls total

**Multi-Tier Enforcement**:

- Per-minute limit: 10 requests
- Monthly total calls limit
- Monthly total cost limit (in EUR cents)
- Per-operation limits (scan_document, ocr_bank_statement)

### Cost Tracking

**Token-Based Pricing**:

- GPT-4o Vision: Higher cost, highest accuracy
- Claude 3.5 Vision: Medium cost, excellent for documents
- Tesseract/Open-source: Free, lower accuracy

**Cost Calculation**:

- Tracks prompt_tokens and completion_tokens
- Stored in cents (EUR) in AIUsage table
- Compared against plan budget limits
- Real-time cost projection during upload

**Usage Analytics**:

- Daily/monthly usage dashboards
- Cost per document type
- Accuracy vs. cost analysis
- Optimization recommendations

## AI Feedback and Continuous Improvement

### Feedback Collection

**Feedback Types**:

- **Correct**: Extraction accurate, no changes needed
- **Incorrect**: Extraction wrong, substantial errors
- **Partial**: Some fields correct, others need correction

**Collection Flow**:

1. User reviews extracted data
2. Selects feedback type (correct/incorrect/partial)
3. For incorrect/partial: Provides corrected values
4. Optional notes field for additional context
5. Submission creates AIFeedback record

**Feedback Schema**:

```json
{
  "entityType": "document",
  "entityId": "document-id",
  "operation": "scan_bank_statement|scan_invoice|scan_receipt",
  "feedback": "correct|incorrect|partial",
  "correction": {
    "field": "correctedValue"
  },
  "notes": "User explanation",
  "confidence": 0.85
}
```

### Model Improvement Pipeline

**Training Data Generation**:

- Collect corrected extractions as training examples
- Anonymize sensitive financial data
- Label with document type and layout
- Build diverse dataset across vendors/formats

**Fine-Tuning Strategies**:

- Fine-tune with 10-100 corrected documents
- Layout-specific model adaptation
- Vendor-specific terminology learning
- Croatian financial term emphasis

**A/B Testing**:

- Test new models against baseline
- Measure accuracy improvements
- Monitor processing time changes
- Gradual rollout to production

## Security and Compliance

### Data Protection

**Encryption**:

- TLS 1.3 for data in transit
- AES-256 for data at rest
- Encrypted storage in R2/S3
- Encrypted database fields for sensitive data

**Tenant Isolation**:

- companyId on all records
- Row-level security policies
- Isolated storage buckets
- Cross-tenant access prevention

**Access Controls**:

- Role-based permissions (RBAC)
- Document access audit logs
- Time-limited access tokens
- IP allowlisting for enterprise

### Compliance

**GDPR Compliance**:

- Right to access extracted data
- Right to rectification (feedback system)
- Right to erasure (soft delete)
- Data portability (JSON export)
- Audit trail for all processing

**Financial Regulations**:

- Croatian tax authority (Porezna uprava) requirements
- VAT compliance verification
- Fiscal year handling
- Retention period enforcement

**Audit Trail**:

- Document upload timestamp and user
- Processing timestamps and results
- User review actions and changes
- Approval/rejection with reasons
- Data export events

### ISO27001 Compliance

**Affinda Example**:

- ISO27001 certified for bank statement processing
- Enterprise-grade security controls
- Regular security audits
- Incident response procedures
- Business continuity planning

## Error Handling and Recovery

### Extraction Errors

**Common Failure Modes**:

- Poor image quality (low resolution, blur)
- Damaged or incomplete documents
- Unsupported layouts or formats
- OCR confidence below threshold
- JSON parsing failures

**Recovery Strategies**:

- Automatic retry with different model
- Image enhancement preprocessing
- Manual extraction fallback
- User-guided field selection
- Template-based extraction

### Rate Limit Errors

**429 Response Handling**:

- Returns usage stats and limit info
- Includes retryAfter timestamp
- Human-readable reason message
- Suggestion to upgrade plan

**Client-Side Handling**:

- Display clear error message
- Show remaining quota
- Offer upgrade path
- Queue for later processing

### Processing Failures

**Failure Detection**:

- Timeout after 60 seconds
- Monitor for stuck jobs
- Health check endpoints
- Alert on high failure rates

**Recovery Mechanisms**:

- Automatic retry with exponential backoff
- Job queue persistence
- Manual retry interface
- Fallback to simpler extraction method

## Performance Optimization

### Processing Speed

**Benchmarks**:

- Single-page receipt: 3-5 seconds
- Multi-page invoice: 10-15 seconds
- Bank statement (10 pages): 20-30 seconds
- Batch processing: 100 documents/hour

**Optimization Techniques**:

- Parallel processing of pages
- GPU acceleration for OCR
- Caching of common vendors
- Preloading of entity data
- Background job processing

### Accuracy Improvements

**Best Practices**:

- Use high-resolution scans (300 DPI minimum)
- Ensure good lighting for photos
- Avoid skewed or rotated images
- Use native PDF when available
- Crop to document boundaries

**Quality Metrics**:

- Field-level accuracy tracking
- Document type accuracy
- Vendor matching accuracy
- Amount extraction precision
- Date parsing success rate

## Integration Points

### Bank Transaction Matching

- **Banking Module**: Extracted bank statement transactions match with imported bank data
- **Auto-Match Engine**: Reconciliation between statements and bank feed
- **Manual Match Interface**: User review for ambiguous matches

### Invoice and Expense Linking

- **Invoicing Module**: Scanned invoices create draft invoice records
- **Expense Module**: Receipt scanning auto-populates expense forms
- **Contact Management**: Vendor extraction creates/links contacts

### Reporting and Analytics

- **VAT Reports**: Extracted VAT amounts feed into PDV reports
- **Profit & Loss**: Transaction categorization for P&L statements
- **Accountant Export**: Structured data export for external accounting

## Dependencies

**Depends on**:

- Authentication system for user context
- Company management for tenant isolation
- Contact management for vendor matching
- Banking module for transaction reconciliation
- Subscription/billing for rate limiting
- R2/S3 storage for document storage
- OpenAI/Claude APIs for AI processing
- Database for structured data storage

**Depended by**:

- Banking reconciliation workflows
- Invoice creation workflows
- Expense tracking workflows
- Financial reporting modules
- Accountant export features

## Verification Checklist

- [ ] User can access /import page
- [ ] File upload accepts PDF and image formats
- [ ] File size validation enforces limits
- [ ] Document type detection classifies correctly
- [ ] OCR extracts text from various layouts
- [ ] Structured data extraction returns JSON
- [ ] Vendor/contact matching finds existing entities
- [ ] Transaction reconciliation identifies matches
- [ ] Confidence scores display per field
- [ ] User can edit extracted values
- [ ] User can approve extraction
- [ ] User can reject extraction
- [ ] Feedback system collects corrections
- [ ] Rate limiting enforces subscription limits
- [ ] Cost tracking records AI usage
- [ ] Documents upload to R2/S3 storage
- [ ] Original documents link to records
- [ ] Audit trail captures all actions
- [ ] Error messages display clearly
- [ ] Failed extractions retry automatically
- [ ] Batch processing handles multiple documents
- [ ] Tenant isolation prevents cross-company access
- [ ] GDPR data export works
- [ ] Croatian language support handles PDV/OIB terms
- [ ] Multi-page documents process completely
- [ ] Table extraction handles complex layouts

## Evidence Links

### AI Document Scanning and OCR

1. [10 Best AI-Powered OCR Tools for Accurate Data Extraction](https://www.softkraft.co/ai-powered-ocr-tools/) - Comprehensive comparison of AI OCR tools including Docsumo, Adobe, ABBYY
2. [Google Cloud Document AI](https://cloud.google.com/document-ai) - 25 years of OCR research, 200+ languages, generative AI powered
3. [Mistral AI Document OCR](https://mistral.ai/solutions/document-ai) - 2,000 pages/minute processing, 99%+ accuracy, 11+ languages
4. [Microsoft Azure AI Document Intelligence](https://azure.microsoft.com/en-us/products/ai-services/ai-document-intelligence) - Enterprise OCR with text, key-value pairs, tables extraction
5. [Best OCR Software of 2025 | TechRadar](https://www.techradar.com/best/best-ocr-software) - Industry review of top OCR solutions

### Bank Statement Processing

6. [Bank Statement OCR Data Extraction: Complete Guide | Koncile](https://www.koncile.ai/en/ressources/extract-data-from-bank-statements-with-ocr) - Comprehensive guide to bank statement OCR
7. [Microsoft Azure Bank Statement Extraction Model](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/bank-statement?view=doc-intel-4.0.0) - Specialized model for US bank statements, 2,000 page processing
8. [Veryfi Bank Statements OCR API](https://www.veryfi.com/bank-statements-ocr-api/) - 99.8% accuracy, processes 15M documents monthly, 80% time reduction
9. [Unstract Bank Statement Extraction API](https://unstract.com/bank-statement-extraction-api/) - AI-powered parsing without pre-training or manual annotation
10. [Klippa Bank Statement OCR](https://www.klippa.com/en/ocr/financial-documents/bank-statements/) - Smart lending and reconciliation, <5 seconds for 3-page statements
11. [Parsio Bank Statements OCR](https://parsio.io/bank-statements/) - Handles any layout, handwritten and printed text, multiple languages

### Financial Document Extraction

12. [KlearStack OCR Financial Statements Extraction](https://klearstack.com/ocr-financial-statements-data-extraction) - AI-based financial statement data extraction
13. [Evolution AI: Financial Statement Extraction Approaches 2025](https://www.evolution.ai/post/financial-statement-extraction) - Modern approaches to financial statement processing
14. [Docsumo Financial Statements Automation](https://www.docsumo.com/blog/financial-statements) - Automated extraction from diverse financial statement formats
15. [DocuClipper: How to Simplify Financial Data Extraction in 2025](https://www.docuclipper.com/blog/financial-data-extraction/) - McKinsey: 42% of finance activities can be automated

### OCR Libraries and Implementation

16. [Python OCR Libraries: Top Choices for 2025 | Medium](https://medium.com/@shouke.wei/python-ocr-libraries-the-top-choices-for-text-extraction-in-2025-7a069c2120ee) - Comprehensive review of Tesseract, PaddleOCR, EasyOCR
17. [8 Top Open-Source OCR Models Compared | Modal](https://modal.com/blog/8-top-open-source-ocr-models-compared) - Datalab Marker, Surya, GOT-OCR 2.0 comparison
18. [Mistral OCR Announcement](https://mistral.ai/news/mistral-ocr) - 2,000 pages/minute, lightweight architecture
19. [Ultimate Guide to OCR Tools for Document Processing in Python | Medium](https://medium.com/@pankaj_pandey/ultimate-guide-to-ocr-tools-for-document-processing-in-python-bebeb3011267) - Implementation guide for Python OCR
20. [10 Awesome OCR Models for 2025 | KDnuggets](https://www.kdnuggets.com/10-awesome-ocr-models-for-2025) - Latest OCR model innovations

### Invoice and Receipt Processing

21. [Behind the Scenes: AI Algorithms for Invoice Data Extraction | Artsyl](https://www.artsyltech.com/blog/Artificial-Intelligence-For-Invoice-Data-Extraction) - Deep learning algorithms for invoice processing
22. [Microsoft Azure Invoice Data Extraction](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/invoice?view=doc-intel-4.0.0) - Prebuilt invoice model supporting 27 languages
23. [Invoice Information Extraction Using OCR and Deep Learning | Medium](https://medium.com/analytics-vidhya/invoice-information-extraction-using-ocr-and-deep-learning-b79464f54d69) - Technical deep dive into invoice OCR
24. [Top IDP Use Cases | DocuWare](https://start.docuware.com/blog/document-management/idp-use-cases) - Intelligent document processing for invoices, receipts

### Document Workflow Automation

25. [AI Document Automation 2025 | Sharayeh](https://sharayeh.com/en/blog/ai-document-automation-formatting-guide-2025) - AI-powered document conversion and formatting
26. [Document Workflow Automation: Transform Operations 2025 | PDFForge](https://www.pdfforge.org/blog/document-workflow-automation-1) - Automated routing and processing workflows
27. [Top Document Workflow Software 2025 | Klippa](https://www.klippa.com/en/blog/information/document-workflow-software/) - DocHorizon platform features
28. [Uploadcare Document Conversion](https://uploadcare.com/products/document-conversion/) - Convert 1100+ document types, generate thumbnails

### Multimodal LLM Document Understanding

29. [GPT-4 Vision for Document Processing | Medium](https://medium.com/@frinktyler1445/large-language-model-vision-bfd05d72150c) - How LLMs visualize and process documents
30. [The LLM Landscape: GPT-4, Gemini, Claude 3, Llama 3 | Complere](https://complereinfosystem.com/the-llm-landscape-gpt-4-gemini-claude-3-meta-llama-3) - Comprehensive comparison of leading LLMs
31. [Ultimate 2025 AI Language Models Comparison | Promptitude](https://www.promptitude.io/post/ultimate-2025-ai-language-models-comparison-gpt5-gpt-4-claude-gemini-sonar-more) - GPT-5, GPT-4, Claude, Gemini comparison
32. [Top 5 Vision Language Models 2025 | Novita](https://blogs.novita.ai/top-5-vision-language-models/) - Best VLMs for document processing
33. [8 Best LLMs for Vision and Multimodal Tasks 2025 | VisionVix](https://visionvix.com/best-llm-for-vision/) - LLM selection guide for visual tasks

### Financial Reconciliation Automation

34. [Reconciliation Automation Guide for Finance Teams 2025 | KlearStack](https://klearstack.com/reconciliation-automation-guide) - Comprehensive reconciliation automation guide
35. [Account Reconciliation Automation Guide | KlearStack](https://klearstack.com/account-reconciliation-automation-guide) - 80% time reduction, 99%+ accuracy
36. [Bank Reconciliation Automation Software 2025 | KlearStack](https://klearstack.com/best-bank-reconciliation-automation-software) - Top solutions comparison
37. [Automated Statement Reconciliation | Automation Anywhere](https://www.automationanywhere.com/solutions/finance-accounting/statement-reconciliation) - RPA for reconciliation (Gartner Magic Quadrant Leader)
38. [Gartner: Best Financial Reconciliation Solutions 2025](https://www.gartner.com/reviews/market/financial-reconciliation-solutions) - Peer reviews and ratings
39. [Account Reconciliation Software | Simetrik](https://simetrik.com/platform/) - AI-powered matching, near-zero latency processing
40. [Top 10 Reconciliation Automation Software 2025 | Osfin](https://www.osfin.ai/blog/reconciliation-softwares) - Industry leader comparison with features

## Implementation Notes

### Technology Stack Recommendations

**For Croatian Market**:

- Primary OCR: Microsoft Azure Document Intelligence (supports Croatian, PDV/OIB recognition)
- Alternative: Google Document AI (200+ languages, fine-tunable)
- Bank Statements: Veryfi or Azure specialized model
- Invoices: Azure Invoice model (27 languages including Croatian)
- Open-source fallback: Tesseract with Croatian language pack

**LLM Selection**:

- High-accuracy needs: Claude 3.5 Vision (best for documents, 2M token context)
- Cost-sensitive: GPT-4o-mini for text extraction
- Privacy-sensitive: Qwen 2.5-VL on-premise deployment
- Enterprise scale: Microsoft Azure Document Intelligence

### Development Priorities

1. **Phase 1**: Basic document upload and OCR (Tesseract)
2. **Phase 2**: Bank statement processing with Azure/Veryfi
3. **Phase 3**: Invoice and receipt scanning
4. **Phase 4**: Transaction reconciliation engine
5. **Phase 5**: AI feedback and model improvement
6. **Phase 6**: Advanced features (batch processing, templates)

### Performance Targets

- Single receipt: <5 seconds end-to-end
- Invoice (2-3 pages): <15 seconds
- Bank statement (10 pages): <30 seconds
- Accuracy: >95% field-level accuracy
- User correction rate: <10% of documents
- Reconciliation match rate: >90% automatic
