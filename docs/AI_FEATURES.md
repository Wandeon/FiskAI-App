# AI/OCR Features Documentation

## Overview

FiskAI includes AI-powered features for automated receipt scanning, data extraction, and intelligent categorization of expenses. These features use OpenAI's GPT models to simplify expense entry and reduce manual data entry.

## Features

### 1. Receipt Scanning & OCR

- **Image-to-Text Extraction**: Upload or photograph receipts to automatically extract data
- **Smart Data Parsing**: Extracts vendor name, OIB, date, items, amounts, VAT, and payment method
- **Croatian Language Support**: Understands Croatian receipt terminology (PDV, Ukupno, Gotovina, etc.)
- **Multi-format Support**: Works with various receipt formats and layouts

### 2. Intelligent Categorization

- **Keyword-based Suggestions**: Automatically suggests expense categories based on description
- **Vendor History**: Learns from previous expenses with the same vendor
- **Confidence Scoring**: Shows confidence level for each suggestion
- **Multi-language Keywords**: Supports both Croatian and English keywords

### 3. Auto-fill Forms

- **Pre-populated Fields**: Automatically fills expense forms from extracted data
- **Review & Edit**: Users can review and modify extracted data before saving
- **Validation**: Ensures extracted data meets business rules

## Setup

### 1. Install Dependencies

```bash
npm install openai lucide-react
```

### 2. Configure OpenAI API Key

Add to your `.env` file:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

Get your API key from: https://platform.openai.com/api-keys

### 3. Models Used

- **Text Extraction**: `gpt-4o-mini` - Fast and cost-effective for structured data extraction
- **Image OCR**: `gpt-4o` - Vision-enabled model for image-to-text extraction

## Architecture

### File Structure

```
src/
├── lib/ai/
│   ├── types.ts              # TypeScript interfaces for AI data
│   ├── extract.ts            # LLM-based text extraction
│   ├── ocr.ts                # Image-to-text OCR
│   ├── categorize.ts         # Category suggestion logic
│   └── index.ts              # Barrel export
├── components/expense/
│   ├── receipt-scanner.tsx   # Camera/upload UI component
│   └── expense-form-with-ai.tsx  # Enhanced form with AI
└── app/api/ai/
    ├── extract/route.ts      # Extraction API endpoint
    └── suggest-category/route.ts  # Category suggestion API
```

### Data Flow

```
1. User uploads image
   ↓
2. Image → Base64 → API endpoint
   ↓
3. OpenAI Vision API (gpt-4o)
   ↓
4. Extracted JSON data
   ↓
5. Auto-fill form fields
   ↓
6. Category suggestions based on vendor/description
   ↓
7. User reviews and saves
```

## API Endpoints

### POST /api/ai/extract

Extract receipt data from image or text.

**Request:**

```json
{
  "image": "base64-encoded-image-data",
  // OR
  "text": "raw receipt text"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "vendor": "Konzum",
    "vendorOib": "12345678901",
    "date": "2024-01-15",
    "items": [
      {
        "description": "Mlijeko",
        "quantity": 2,
        "unitPrice": 5.99,
        "total": 11.98,
        "vatRate": 25
      }
    ],
    "subtotal": 9.58,
    "vatAmount": 2.4,
    "total": 11.98,
    "paymentMethod": "card",
    "currency": "EUR",
    "confidence": 0.92
  }
}
```

### POST /api/ai/suggest-category

Get category suggestions based on description and vendor.

**Request:**

```json
{
  "description": "Toner za printer HP",
  "vendor": "Tisak",
  "companyId": "company-uuid"
}
```

**Response:**

```json
{
  "suggestions": [
    {
      "categoryId": "cat-uuid-1",
      "categoryName": "Uredski materijal",
      "confidence": 0.85
    },
    {
      "categoryId": "cat-uuid-2",
      "categoryName": "IT oprema",
      "confidence": 0.65
    }
  ]
}
```

## Components

### ReceiptScanner

Camera/file upload component for receipt scanning.

**Props:**

- `onExtracted: (data: ExtractedReceipt) => void` - Callback when extraction succeeds
- `onCancel?: () => void` - Optional cancel handler

**Usage:**

```tsx
import { ReceiptScanner } from "@/components/expense/receipt-scanner"

;<ReceiptScanner
  onExtracted={(data) => {
    console.log("Extracted:", data)
    // Fill form fields
  }}
  onCancel={() => setShowScanner(false)}
/>
```

### ExpenseFormWithAI

Enhanced expense form with AI-powered features.

**Props:**

- `categories: Array<{ id, name, code }>` - Available expense categories
- `companyId: string` - Current company ID
- `onSubmit: (data) => Promise<void>` - Form submission handler
- `defaultValues?: Partial<ExpenseFormData>` - Optional default values

**Features:**

- Receipt scanner integration
- Real-time category suggestions
- Auto-fill from extracted data
- Validation and error handling

## Category Keywords

The system uses keyword matching for intelligent categorization. Keywords are defined in `/src/lib/ai/categorize.ts`:

### Default Categories

- **OFFICE**: papir, toner, uredski, office, printer, pisač
- **TRAVEL**: gorivo, benzin, diesel, cestarina, parking
- **TELECOM**: mobitel, internet, telefon, a1, tele2, telemach
- **RENT**: najam, zakup, rent, naknada
- **UTILITIES**: struja, voda, plin, hep, komunalije
- **SERVICES**: usluga, servis, održavanje, consulting
- **MARKETING**: marketing, reklama, promocija, oglas
- **FOOD**: restoran, hrana, piće, kava, obrok
- **TRANSPORT**: prijevoz, transport, dostava, kurir
- **EQUIPMENT**: oprema, alat, uređaj, tool, stroj
- **SOFTWARE**: software, licenca, pretplata, subscription
- **INSURANCE**: osiguranje, polica, insurance

### Adding Custom Keywords

Edit `/src/lib/ai/categorize.ts` to add category-specific keywords:

```typescript
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  YOUR_CATEGORY_CODE: ["keyword1", "keyword2", "ključna-riječ"],
  // ...
}
```

## Cost Considerations

### Pricing (as of Dec 2025)

- **gpt-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **gpt-4o**: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens

### Typical Usage

- Text extraction: ~500 tokens → ~$0.0005 per receipt
- Image OCR: ~1000 tokens → ~$0.003 per receipt

For 1000 receipts/month: ~$3-5/month

### Optimization Tips

1. **Cache extracted data** - Don't re-process the same receipt
2. **Use gpt-4o-mini** for text extraction when possible
3. **Batch processing** - Process multiple receipts in one API call if feasible
4. **Confidence thresholds** - Only use AI when keyword matching fails

## Error Handling

### Common Errors

1. **Missing API Key**

   ```json
   { "success": false, "error": "OpenAI API key not configured" }
   ```

   Solution: Add `OPENAI_API_KEY` to `.env`

2. **Invalid Image Format**

   ```json
   { "success": false, "error": "No JSON in response" }
   ```

   Solution: Ensure image is JPEG/PNG and properly base64 encoded

3. **Rate Limiting**
   ```json
   { "success": false, "error": "Rate limit exceeded" }
   ```
   Solution: Implement request queuing or upgrade OpenAI plan

### Graceful Degradation

If AI extraction fails, the system falls back to:

1. Manual form entry (always available)
2. Keyword-based categorization (no AI required)
3. Vendor history lookup (database only)

## Testing

### Test Receipt Extraction

```bash
# Create a test image
curl -X POST http://localhost:3000/api/ai/extract \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Konzum\nOIB: 12345678901\nDatum: 15.01.2024\nUkupno: 11.98 EUR\nPDV 25%: 2.40 EUR"
  }'
```

### Test Category Suggestion

```bash
curl -X POST http://localhost:3000/api/ai/suggest-category \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Internet pretplata",
    "vendor": "A1",
    "companyId": "your-company-id"
  }'
```

## Best Practices

1. **Review Extracted Data**: Always allow users to review before saving
2. **Show Confidence**: Display confidence scores to users
3. **Provide Fallback**: Ensure manual entry works if AI fails
4. **Log Failures**: Track extraction failures for model improvement
5. **User Feedback**: Allow users to report incorrect extractions
6. **Privacy**: Never store images permanently unless required
7. **Compliance**: Ensure GDPR compliance for OCR data

## Future Enhancements

- [ ] Multi-page document support
- [ ] Invoice extraction (separate from receipts)
- [ ] Bank statement parsing
- [ ] Receipt duplicate detection
- [ ] Custom category training
- [ ] Multi-language support (English, German, etc.)
- [ ] Offline OCR fallback (Tesseract.js)
- [ ] Receipt validation against e-invoices

## Troubleshooting

### Scanner not working on mobile

**Symptom**: Camera doesn't open on mobile devices

**Solution**: Ensure HTTPS is enabled (camera API requires secure context)

### Low extraction accuracy

**Symptom**: Extracted data is often incorrect

**Solutions**:

1. Improve image quality (better lighting, focus)
2. Add more Croatian keywords to prompts
3. Fine-tune extraction prompts
4. Use higher resolution images

### Category suggestions not appearing

**Symptom**: No suggestions shown

**Check**:

1. Categories exist in database
2. Keywords match description/vendor
3. Company ID is correct
4. API endpoint is working

## Support

For issues or questions:

1. Check console for API errors
2. Verify OpenAI API key is valid
3. Test with sample receipts
4. Review extraction prompt in `/src/lib/ai/extract.ts`

## License

Part of FiskAI - Croatian Accounting SaaS
