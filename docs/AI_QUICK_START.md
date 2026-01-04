# AI/OCR Features - Quick Start Guide

## Setup (5 minutes)

### 1. Install Dependencies

```bash
npm install openai lucide-react
```

### 2. Configure OpenAI API Key

Add to your `.env` file:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

Get your API key from: https://platform.openai.com/api-keys

### 3. Restart Development Server

```bash
npm run dev
```

That's it! The AI features are now active.

## Using the Receipt Scanner

### For Users:

1. Go to "Novi trošak" (New Expense)
2. Click "Skeniraj račun" button
3. Take a photo or upload an image
4. Wait a few seconds for processing
5. Review and edit the auto-filled data
6. Click "Spremi trošak" to save

### What Gets Extracted:

- ✅ Vendor name (Dobavljač)
- ✅ Vendor OIB
- ✅ Date
- ✅ Items and quantities
- ✅ Net amount
- ✅ VAT amount and rate
- ✅ Total amount
- ✅ Payment method

### Category Suggestions:

As you type the description or select a vendor, you'll see:

- AI-powered category suggestions
- Confidence scores (%)
- Click a badge to apply the category

## Example Usage

### Sample Receipt:

```
KONZUM d.d.
OIB: 12345678901
Datum: 15.01.2024

MLIJEKO 2.5%    2x  5.99 EUR   11.98 EUR
KRUH            1x  2.50 EUR    2.50 EUR

Neto:                          11.58 EUR
PDV 25%:                        2.90 EUR
UKUPNO:                        14.48 EUR

Plaćeno karticom
```

### Extracted Result:

- Vendor: "KONZUM d.d."
- OIB: "12345678901"
- Date: "2024-01-15"
- Net: 11.58 EUR
- VAT: 2.90 EUR (25%)
- Total: 14.48 EUR
- Payment: Card
- Description: "MLIJEKO 2.5% (2x), KRUH (1x)"

## Testing

### Quick Test:

```bash
# Optional: Test without running the app
npx tsx scripts/test-ai.ts
```

### Browser Test:

1. Open `/expenses/new`
2. Click "Skeniraj račun"
3. Upload a test receipt image
4. Verify the extracted data is correct

## Costs

### Typical Usage:

- **Text extraction**: $0.0005 per receipt
- **Image OCR**: $0.003 per receipt
- **1000 receipts/month**: ~$3-5

### Free Alternative:

Category suggestions use keyword matching (no AI cost) when:

- Based on previous vendor history
- Matched by keywords in description

## Troubleshooting

### "OpenAI API key not configured"

→ Add `OPENAI_API_KEY` to `.env` and restart server

### "Extraction failed"

→ Check image quality (clear, well-lit, in focus)
→ Verify OpenAI API key is valid
→ Check OpenAI account has credits

### Camera not working on mobile

→ Ensure site is accessed via HTTPS
→ Check browser camera permissions

### Category suggestions not showing

→ Wait 500ms after typing (debounced)
→ Check browser console for errors
→ Verify categories exist in database

## Support

- Full docs: `/docs/AI_FEATURES.md`
- Implementation details: `/PHASE_16_IMPLEMENTATION.md`
- Test script: `/scripts/test-ai.ts`

## Croatian UI Reference

| English       | Croatian       |
| ------------- | -------------- |
| Scan receipt  | Skeniraj račun |
| Take photo    | Fotografiraj   |
| Upload image  | Učitaj sliku   |
| Processing... | Obrađujem...   |
| Confirm       | Potvrdi        |
| Cancel        | Poništi        |
| Suggestions   | Prijedlozi     |
| Vendor        | Dobavljač      |
| Description   | Opis           |
| Total         | Ukupno         |

## Next Steps

1. ✅ Test with real Croatian receipts
2. ✅ Train users on the scanner feature
3. ✅ Monitor extraction accuracy
4. ✅ Gather user feedback
5. ✅ Adjust keywords/prompts as needed

---

**Need help?** Check the full documentation in `/docs/AI_FEATURES.md`
