# Feature: AI Receipt Extraction (F077)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 15
- Complexity: High

## Purpose

The AI Receipt Extraction feature provides a robust API endpoint (/api/ai/extract) that leverages OpenAI's GPT-4o Vision model to perform intelligent OCR (Optical Character Recognition) and structured data extraction from receipt images. The feature accepts image uploads (via base64 encoding or file upload), processes them through a multimodal vision model to extract key business information (merchant details, line items, amounts, dates, payment methods), validates and structures the data according to predefined JSON schemas, and returns it with confidence scores for downstream processing. This feature is designed for expense management systems, accounting software, and financial applications that need to automate receipt digitization with high accuracy across multiple languages and receipt formats.

## API Overview

| Attribute    | Details                                  |
| ------------ | ---------------------------------------- |
| Endpoint     | POST /api/ai/extract                     |
| Method       | POST                                     |
| Model        | OpenAI GPT-4o Vision                     |
| Input Format | Base64-encoded image or multipart upload |
| Output       | Structured JSON with confidence scoring  |
| Rate Limits  | Subscription-based (20-unlimited/month)  |
| Use Cases    | Expense tracking, receipt digitization   |

## Core Technology Stack

### GPT-4o Vision Model

**What is GPT-4o?**
GPT-4o ("o" for "omni") is OpenAI's flagship multimodal model that accepts any combination of text, audio, image, and video inputs and generates text, audio, and image outputs. It represents a significant advancement where a single neural network processes all input modalities end-to-end, enabling more natural human-computer interaction.

**Vision Capabilities**

- **OCR Performance**: GPT-4o can extract text from images with high accuracy, though specialized OCR engines may still outperform for pure text extraction tasks
- **Contextual Understanding**: Unlike traditional OCR, GPT-4o understands contextual information in images like humans, enabling it to fix OCR errors based on context
- **Structured Output**: With structured outputs feature, GPT-4o-2024-08-06 achieves 100% reliability in matching JSON schemas when `strict: true` is set
- **Multilingual Support**: Handles diverse languages and mixed-language content, particularly effective for international receipts
- **Layout Understanding**: Processes complex receipt layouts, including tables, line items, and hierarchical data structures

**Performance Metrics**

- Speed: 2x faster than GPT-4 Turbo
- Cost: 50% lower pricing than GPT-4 Turbo
- Rate Limits: 5x higher than GPT-4 Turbo
- Real-World Accuracy: ~90% accuracy for receipt parsing out-of-the-box, with ~97% achievable with hybrid OCR+LLM approaches

## Extraction Workflow

### 1. Image Input Processing

**Supported Input Methods**

- Base64-encoded data URLs with MIME type prefix
- File uploads via multipart/form-data
- Public HTTPS URLs to image files
- Maximum file size: 20MB recommended
- Supported formats: PNG, JPEG, WebP, HEIC, non-animated GIF

**Base64 Encoding Pattern**

```typescript
// Correct format for base64 images
{
  "type": "image_url",
  "image_url": {
    "url": "data:image/jpeg;base64,{base64_string}"
  }
}
```

**Image Preprocessing Considerations**

- Higher resolution images provide better OCR accuracy
- Poor quality images (blurred, rotated, damaged) benefit from hybrid OCR+GPT-4o approach
- Images are automatically deleted after processing for privacy
- Multiple images can be processed in a single request (count as separate tokens)

### 2. Vision API Integration

**API Configuration**

- Model: `gpt-4o` or `gpt-4o-2024-08-06` for structured outputs
- Max tokens: 1000-2000 recommended for receipt extraction
- Temperature: 0-0.3 for deterministic extraction
- Response format: JSON schema with `strict: true` for guaranteed structure

**Prompt Engineering for Receipts**
The system prompt should include:

- Request for structured JSON output with specific field names
- Instructions to handle Croatian/local language terms (e.g., "PDV" for VAT, "Ukupno" for Total)
- Guidance to extract line items with quantity, description, and unit prices
- Instructions to return confidence scores (0-1 scale)
- Error handling instructions for missing or unclear information

**Example Prompt Structure**

```text
Extract all information from this receipt image and return as JSON.
Extract: vendor name, tax ID (OIB), date (YYYY-MM-DD format),
line items (with qty/description/price), subtotal, VAT amount,
total, payment method, and currency. Croatian receipts use
"PDV" for VAT and "Ukupno" for total. Return confidence score
(0-1). If information is unclear, set field to null.
```

### 3. Structured Data Extraction

**Core Data Fields**

| Field         | Type   | Description                           | Example       |
| ------------- | ------ | ------------------------------------- | ------------- |
| vendor        | string | Merchant/business name                | "Konzum d.d." |
| vendorOib     | string | 11-digit tax identification number    | "12345678901" |
| date          | string | Transaction date (YYYY-MM-DD)         | "2025-12-15"  |
| items         | array  | Line items with qty/description/price | See below     |
| subtotal      | number | Amount before VAT                     | 100.00        |
| vatAmount     | number | VAT/tax amount                        | 25.00         |
| total         | number | Final total amount                    | 125.00        |
| paymentMethod | enum   | cash/card/transfer                    | "card"        |
| currency      | string | ISO currency code                     | "EUR"         |
| confidence    | number | Extraction confidence (0-1)           | 0.92          |

**Line Item Structure**

```typescript
{
  quantity: number // Item quantity
  description: string // Item name/description
  unitPrice: number // Price per unit
  totalPrice: number // Line total (qty × unitPrice)
}
```

### 4. Response Parsing and Validation

**JSON Extraction**

- Parse response text to extract JSON content
- Handle cases where model adds explanatory text around JSON
- Validate against expected schema using Zod or similar
- Implement fallback parsing for non-JSON responses

**Confidence Score Interpretation**

| Range     | Level  | Meaning                                    | Action                  |
| --------- | ------ | ------------------------------------------ | ----------------------- |
| 0.80-1.00 | High   | High reliability, minimal review needed    | Auto-process            |
| 0.60-0.79 | Medium | Moderate confidence, review recommended    | Flag for review         |
| 0.00-0.59 | Low    | Low confidence, manual verification needed | Require manual approval |

**Validation Rules**

- Verify mathematical consistency (subtotal + VAT = total)
- Check date format and reasonable date range
- Validate tax ID format (country-specific)
- Ensure line items sum matches subtotal
- Flag anomalies for review

### 5. Error Handling and Fallbacks

**Common Error Scenarios**

- Low quality/damaged images → Return low confidence score, suggest re-scan
- Ambiguous text → Set unclear fields to null, lower confidence
- Non-receipt images → Detect and reject with appropriate error
- Rate limit exceeded → Return 429 with retry-after information
- Model refusal (unsafe content) → New refusal string in API response

**Hybrid OCR Approach for Better Accuracy**
For improved results, especially with low-quality images:

1. Run specialized OCR first (Google Vision, Azure OCR, Tesseract)
2. Pass OCR text + original image to GPT-4o
3. Instruct GPT-4o to fix OCR errors using contextual understanding
4. This hybrid approach can improve accuracy from 80% to 97%+

## Rate Limiting and Usage Tracking

### Subscription-Based Limits

**Rate Limit Tiers**

- **Trial/Default**: 20 extraction calls/month
- **Pausalni**: 100 calls/month, 50 OCR receipts
- **Obrtnicki**: 500 calls/month, 250 OCR receipts
- **Obrt VAT**: 1000 calls/month
- **DOO Small**: 2000 calls/month
- **DOO Standard**: 5000 calls/month
- **Enterprise**: Unlimited

**Multi-Tier Enforcement**

1. Per-minute limit: 10 requests (prevents abuse)
2. Monthly total calls limit (per subscription plan)
3. Monthly cost budget limit (based on token usage)
4. Per-operation specific limits (e.g., OCR receipts vs. text extraction)

### Usage Tracking

**Tracked Metrics**

- **Token Usage**: prompt_tokens + completion_tokens per request
- **Cost Calculation**: Stored in cents (EUR) for billing
- **Success Rate**: Track successful vs. failed extractions
- **Model Used**: Record which model version processed request
- **Operation Type**: Distinguish between OCR, text extraction, categorization

**Usage Data Storage**

```typescript
AIUsage {
  companyId: string;      // Tenant isolation
  operation: string;      // Operation type
  tokensUsed: number;     // Total tokens consumed
  costCents: number;      // Cost in EUR cents
  model: string;          // AI model identifier
  success: boolean;       // Operation result
  createdAt: DateTime;    // Timestamp
}
```

## Best Practices for Implementation

### Image Input Optimization

1. **Resolution**: Use high-resolution images (300 DPI or higher) for best OCR results
2. **Orientation**: Auto-rotate images to correct orientation before sending
3. **Compression**: Balance file size vs. quality (JPEG quality 85-95)
4. **Format Selection**: Use JPEG for photos, PNG for screenshots/digital receipts

### Prompt Engineering Tips

1. **Be Specific**: Clearly define expected output structure and field names
2. **Provide Examples**: Include sample JSON in prompt for complex schemas
3. **Handle Ambiguity**: Instruct model how to handle unclear/missing data
4. **Local Context**: Include language-specific terms and formats
5. **Confidence Scoring**: Always request confidence scores for quality assessment

### Structured Output Configuration

**Using JSON Schema (Recommended)**

```typescript
{
  "model": "gpt-4o-2024-08-06",
  "messages": [...],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "receipt_extraction",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "vendor": {"type": "string"},
          "total": {"type": "number"},
          "confidence": {"type": "number"}
        },
        "required": ["vendor", "total", "confidence"],
        "additionalProperties": false
      }
    }
  }
}
```

**Benefits of Structured Outputs**

- 100% schema compliance (no validation failures)
- Eliminates need for retry logic due to format errors
- Faster parsing and integration with downstream systems
- Predictable output structure for type safety

### Error Recovery Strategies

1. **Retry Logic**: Implement exponential backoff for transient failures
2. **Fallback Models**: Use GPT-4o-mini for text-only extraction as cheaper fallback
3. **User Feedback Loop**: Collect corrections to improve future extractions
4. **Confidence Thresholds**: Route low-confidence extractions to manual review queue

## Security and Privacy Considerations

### Data Protection

- **Automatic Deletion**: OpenAI automatically deletes images after processing
- **No Training**: Images not used to train OpenAI models (per API terms)
- **Tenant Isolation**: Implement proper company/user data segregation
- **Sensitive Data**: Be cautious with receipts containing personal information (medical, financial services)

### Compliance

- **GDPR**: Ensure lawful basis for processing receipt data (legitimate interest, contract)
- **Data Retention**: Define retention policies for extracted data
- **Right to Erasure**: Implement deletion workflows for user data
- **Audit Logging**: Track all AI operations for compliance and troubleshooting

## Integration Patterns

### RESTful API Integration

**Request Example**

```typescript
POST /api/ai/extract
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "options": {
    "language": "hr",
    "includeItems": true
  }
}
```

**Response Example**

```typescript
{
  "success": true,
  "data": {
    "vendor": "Konzum d.d.",
    "vendorOib": "12345678901",
    "date": "2025-12-15",
    "items": [
      {
        "quantity": 2,
        "description": "Mlijeko 1L",
        "unitPrice": 5.99,
        "totalPrice": 11.98
      }
    ],
    "subtotal": 100.00,
    "vatAmount": 25.00,
    "total": 125.00,
    "paymentMethod": "card",
    "currency": "EUR",
    "confidence": 0.92
  },
  "usage": {
    "tokensUsed": 1250,
    "costCents": 15,
    "remaining": 985
  }
}
```

### SDK Integration (Node.js Example)

```typescript
import { OpenAI } from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function extractReceipt(imageBase64: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-2024-08-06",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract receipt data as JSON with fields: vendor, date, total, items, confidence",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
    max_tokens: 1000,
    response_format: { type: "json_object" },
  })

  return JSON.parse(response.choices[0].message.content)
}
```

### Webhook Pattern for Async Processing

For high-volume scenarios:

1. Accept image upload, return job ID immediately
2. Process extraction asynchronously in background queue
3. Send webhook notification when complete
4. Store results in database for retrieval

## Advanced Features

### Confidence Scoring and Validation

**Generating Confidence Scores**

- Prompt model to self-report confidence per field
- Use logit probabilities for calibrated scores (requires API access)
- Implement cross-field validation (e.g., total = subtotal + VAT)
- Compare against historical patterns for anomaly detection

**Confidence Signals**
Instead of single confidence number, track specific uncertainty signals:

- Unclear text/blurred areas
- Ambiguous date formats
- Missing required fields
- Mathematical inconsistencies

### Multilingual Receipt Processing

**Language Support**

- GPT-4o handles 38+ languages natively
- Mixed-language receipts (e.g., Arabic-English) supported
- Automatic language detection from image content
- Cultural context awareness (date formats, currency symbols)

**Internationalization Considerations**

- VAT vs. GST vs. Sales Tax terminology
- Date format variations (DD/MM/YYYY vs. MM/DD/YYYY)
- Currency symbol placement
- Decimal separator differences (. vs. ,)

### Fraud Detection Integration

**Automated Checks**

- Duplicate receipt detection (hash comparison)
- Altered amount detection (visual vs. extracted mismatches)
- Suspicious patterns (round numbers, missing tax IDs)
- Policy violation flags (expense category limits)

**Implementation Pattern**

1. Extract receipt data via GPT-4o
2. Run validation rules on extracted data
3. Compare against company policy database
4. Flag anomalies for manual review
5. Log all checks for audit trail

## Monitoring and Observability

### Key Metrics to Track

1. **Accuracy Metrics**
   - Field-level extraction accuracy per receipt type
   - Confidence score distribution
   - False positive/negative rates for validation

2. **Performance Metrics**
   - API response time (p50, p95, p99)
   - Token usage per request
   - Cost per extraction
   - Success rate by subscription tier

3. **Business Metrics**
   - User adoption rate (% using AI extraction)
   - Manual correction frequency
   - Time saved vs. manual entry
   - ROI on AI feature costs

### Logging Best Practices

```typescript
// Structured logging for AI operations
logger.info("Receipt extraction started", {
  companyId: company.id,
  userId: user.id,
  imageSize: imageBuffer.length,
  operation: "ocr_receipt",
})

logger.info("Receipt extraction completed", {
  companyId: company.id,
  success: true,
  confidence: result.confidence,
  tokensUsed: usage.total_tokens,
  costCents: calculatedCost,
  processingTimeMs: endTime - startTime,
})
```

## Testing Strategies

### Unit Testing

- Mock OpenAI API responses with sample JSON
- Test schema validation with valid/invalid data
- Verify confidence score calculations
- Test error handling for API failures

### Integration Testing

- Test with real receipt images across various formats
- Verify end-to-end flow from upload to storage
- Test rate limiting enforcement
- Validate webhook delivery

### Quality Assurance

- Maintain test receipt dataset (diverse vendors, languages, qualities)
- Automated accuracy testing against ground truth
- A/B testing different prompt formulations
- User acceptance testing with real users

## Cost Optimization

### Token Usage Strategies

1. **Image Compression**: Reduce image size while maintaining OCR quality
2. **Prompt Optimization**: Use concise, efficient prompts
3. **Response Limits**: Set appropriate max_tokens to avoid waste
4. **Model Selection**: Use GPT-4o-mini for simpler receipts (lower cost)

### Cost Calculation Example

**GPT-4o Pricing** (as of 2024):

- Input: $2.50 per 1M tokens
- Output: $10.00 per 1M tokens

**Typical Receipt Extraction**:

- Input tokens: ~1000 (image encoding + prompt)
- Output tokens: ~200 (JSON response)
- Cost per extraction: ~$0.0045 USD

**Monthly Cost Projections**:

- 100 receipts: ~$0.45
- 500 receipts: ~$2.25
- 1000 receipts: ~$4.50

## Troubleshooting Guide

### Common Issues

**Issue**: Low extraction accuracy

- **Solution**: Implement hybrid OCR+GPT-4o approach
- **Solution**: Improve image quality (higher resolution, better lighting)
- **Solution**: Fine-tune prompt with specific receipt format examples

**Issue**: Inconsistent JSON structure

- **Solution**: Use structured outputs with `strict: true`
- **Solution**: Implement robust JSON parsing with fallbacks
- **Solution**: Add schema validation layer (Zod, JSON Schema)

**Issue**: Rate limit exceeded

- **Solution**: Implement request queuing with backoff
- **Solution**: Upgrade subscription plan
- **Solution**: Optimize by reducing unnecessary extraction calls

**Issue**: High costs

- **Solution**: Switch to GPT-4o-mini for standard receipts
- **Solution**: Implement caching for duplicate receipts
- **Solution**: Use confidence thresholds to reduce unnecessary reprocessing

## Future Enhancements

### Potential Improvements

1. **Local Model Fallback**: Use open-source models (LLaMA, Mistral) for offline/privacy-sensitive scenarios
2. **Active Learning**: Train custom fine-tuned model on collected feedback data
3. **Real-time Processing**: Implement streaming responses for faster UX
4. **Mobile SDK**: Native mobile libraries for on-device preprocessing
5. **Batch Processing**: Optimize API for bulk receipt processing

### Research Directions

- **ReceiptSense Dataset**: Leverage academic datasets for model benchmarking
- **Post-OCR Parsing**: Explore specialized post-processing models
- **Table Extraction**: Improve line item extraction accuracy with table-specific models
- **Few-Shot Learning**: Use example receipts in prompt for better adaptation

## Evidence Links

1. [GPT-4o Vision OCR Receipt Parsing - Medium](https://medium.com/data-science/how-to-effortlessly-extract-receipt-information-with-ocr-and-gpt-4o-mini-0825b4ac1fea) - Guide on using GPT-4o mini for receipt extraction with clean JSON output
2. [Traditional OCR Is Dead - GPT-4o's Vision Model](https://medium.com/@mohammedadil77/traditional-ocr-is-dead-gpt-4os-vision-model-does-magic-ed7c8d9340e3) - Comparison showing GPT-4o's advantages over traditional OCR for receipt parsing
3. [OpenAI Cookbook: Data Extraction with GPT-4o](https://cookbook.openai.com/examples/data_extraction_transformation) - Official guide on using GPT-4o as OCR alternative for ELT workflows
4. [OpenAI Vision API Documentation](https://platform.openai.com/docs/guides/vision) - Official documentation for vision-enabled chat models
5. [Hello GPT-4o - OpenAI](https://openai.com/index/hello-gpt-4o/) - Official announcement of GPT-4o multimodal capabilities
6. [Receipt Data Extraction - Microsoft Azure](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/receipt?view=doc-intel-4.0.0) - Azure's prebuilt receipt model with JSON output specification
7. [How AI Converts Scanned Receipts to Structured Data](https://airparser.com/blog/how-ai-helps-convert-scanned-receipts-to-structured-data/) - Overview of AI technologies (OCR, ML, NLP) for receipt parsing
8. [Structured Outputs in OpenAI API](https://platform.openai.com/docs/guides/structured-outputs) - Documentation on 100% reliable JSON schema adherence
9. [Introducing Structured Outputs - OpenAI](https://openai.com/index/introducing-structured-outputs-in-the-api/) - Announcement of guaranteed schema compliance feature
10. [Confidence Scores in LLMs - Infrrd](https://www.infrrd.ai/blog/confidence-scores-in-llms) - Guide on implementing confidence scoring for LLM extractions
11. [Receipt OCR Benchmark with LLMs](https://research.aimultiple.com/receipt-ocr/) - Benchmarks showing 97% accuracy with LLM-based receipt OCR
12. [Complete Guide to GPT-4o Image API](https://www.cursor-ide.com/blog/gpt4o-image-api-guide-2025-english) - Comprehensive guide on base64 encoding and image processing
13. [Receipt OCR API Integration - Veryfi](https://www.veryfi.com/receipt-ocr-api/) - Commercial API example with SDKs and integration patterns
14. [ReceiptSense Dataset - arXiv](https://arxiv.org/abs/2406.04493) - Academic research on multilingual receipt understanding with 20,000+ annotated receipts
15. [GPT-4o Vision Best Practices - tsmatz](https://tsmatz.wordpress.com/2024/02/07/gpt-4-vision-with-ocr/) - Best practices for improving accuracy with OCR-assisted multimodal models

## Dependencies

- **Depends on**:
  - OpenAI API - GPT-4o Vision model for image understanding
  - Rate limiting system - Subscription-based usage enforcement
  - Authentication - User/company context for tenant isolation
  - Image storage - R2/S3 for receipt image persistence
  - Database - AIUsage and AIFeedback tables for tracking

- **Depended by**:
  - Expense creation workflows - Auto-populate expense forms
  - Receipt scanner UI components - Frontend integration
  - Reporting and analytics - Extracted data for business insights
  - Accounting integrations - Structured data export

## Verification Checklist

- [ ] API endpoint accepts base64-encoded images
- [ ] API endpoint accepts multipart file uploads
- [ ] GPT-4o Vision model processes receipt images
- [ ] Structured JSON output matches defined schema
- [ ] Confidence scores generated for extractions
- [ ] Rate limiting enforces subscription-based limits
- [ ] Per-minute rate limits prevent abuse
- [ ] Token usage tracked in AIUsage table
- [ ] Cost calculation accurate in EUR cents
- [ ] Mathematical validation (subtotal + VAT = total)
- [ ] Date format validation (YYYY-MM-DD)
- [ ] Line items extracted with all fields
- [ ] Payment method correctly categorized
- [ ] Multilingual receipts supported
- [ ] Error handling for low-quality images
- [ ] 429 responses include retry-after information
- [ ] Usage stats returned in API response
- [ ] Tenant isolation prevents cross-company access
- [ ] Images processed securely and deleted after use
- [ ] Webhook support for async processing
- [ ] Monitoring logs capture all relevant metrics
