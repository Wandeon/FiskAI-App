# Feature: AI Category Suggestions (F078)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 26

## Purpose

The AI Category Suggestions feature provides intelligent, context-aware expense category recommendations based on description keywords and vendor purchase history. The system combines keyword-based pattern matching with historical vendor data to suggest the most appropriate expense category with confidence scoring, helping users categorize expenses faster and more consistently while learning from their past behavior.

## User Entry Points

| Type     | Path                          | Evidence                                                  |
| -------- | ----------------------------- | --------------------------------------------------------- |
| API      | POST /api/ai/suggest-category | `src/app/api/ai/suggest-category/route.ts:9`              |
| UI       | Expense Form Suggestions      | `src/app/(dashboard)/expenses/new/expense-form.tsx:51-84` |
| Function | suggestCategory               | `src/lib/ai/categorize.ts:20-47`                          |
| Function | suggestCategoryByVendor       | `src/lib/ai/categorize.ts:49-90`                          |

## Core Flow

1. User types description or selects vendor in expense form → `src/app/(dashboard)/expenses/new/expense-form.tsx:38-39`
2. System debounces input for 500ms to avoid excessive API calls → `src/app/(dashboard)/expenses/new/expense-form.tsx:82`
3. Frontend sends POST request to /api/ai/suggest-category → `src/app/(dashboard)/expenses/new/expense-form.tsx:60-68`
4. API validates user authentication with session → `src/app/api/ai/suggest-category/route.ts:10-13`
5. System retrieves user's default company context → `src/app/api/ai/suggest-category/route.ts:21-31`
6. If vendor provided, check vendor history first → `src/app/api/ai/suggest-category/route.ts:38-43`
7. System queries previous expenses from same vendor → `src/lib/ai/categorize.ts:67-78`
8. If vendor match found, return category with 95% confidence → `src/lib/ai/categorize.ts:80-87`
9. System fetches description-based suggestions via keyword matching → `src/app/api/ai/suggest-category/route.ts:45-48`
10. System loads all expense categories (global + company-specific) → `src/lib/ai/categorize.ts:24-26`
11. For each category, match description against keyword dictionary → `src/lib/ai/categorize.ts:32-44`
12. Calculate confidence based on number of keyword matches → `src/lib/ai/categorize.ts:40`
13. System combines vendor + description suggestions → `src/app/api/ai/suggest-category/route.ts:50-56`
14. Deduplicate by categoryId, keeping highest confidence → `src/app/api/ai/suggest-category/route.ts:51-54`
15. Sort by confidence descending and return top 3 suggestions → `src/app/api/ai/suggest-category/route.ts:55-56`
16. Frontend displays suggestions as clickable badges → `src/app/(dashboard)/expenses/new/expense-form.tsx:216-247`
17. User clicks suggestion to auto-select category → `src/app/(dashboard)/expenses/new/expense-form.tsx:232`

## Key Modules

| Module                  | Purpose                                  | Location                                            |
| ----------------------- | ---------------------------------------- | --------------------------------------------------- |
| SuggestCategoryAPI      | API endpoint for category suggestions    | `src/app/api/ai/suggest-category/route.ts:9-66`     |
| suggestCategory         | Keyword-based category matching engine   | `src/lib/ai/categorize.ts:20-47`                    |
| suggestCategoryByVendor | Historical vendor-based category lookup  | `src/lib/ai/categorize.ts:49-90`                    |
| ExpenseForm             | Client form with real-time suggestion UI | `src/app/(dashboard)/expenses/new/expense-form.tsx` |
| CategorySuggestion      | TypeScript interface for suggestion data | `src/lib/ai/types.ts:37-42`                         |

## Suggestion Logic

### 1. Vendor History Matching

**Priority**: Highest (executed first)
**Confidence**: 95%

- Queries Contact table for vendor by name → `src/lib/ai/categorize.ts:54-62`
- Case-insensitive partial name match → `src/lib/ai/categorize.ts:58-59`
- Finds most recent expense from vendor → `src/lib/ai/categorize.ts:67-78`
- Returns previously used category → `src/lib/ai/categorize.ts:80-87`
- Reasoning: "Prethodno korišteno za [vendor]" → `src/lib/ai/categorize.ts:85`

**Example:**

```typescript
Input: vendor = "Tisak"
Output: {
  categoryId: "cat-123",
  categoryName: "Uredski materijal",
  confidence: 0.95,
  reason: "Prethodno korišteno za \"Tisak\""
}
```

### 2. Keyword-Based Matching

**Priority**: Secondary (if vendor fails or no vendor)
**Confidence**: 0.3 per keyword match (max 0.9)

- Loads keyword dictionary from CATEGORY_KEYWORDS → `src/lib/ai/categorize.ts:5-18`
- Converts description to lowercase → `src/lib/ai/categorize.ts:28`
- For each category, checks if keywords appear in description → `src/lib/ai/categorize.ts:33`
- Confidence = min(matches × 0.3, 0.9) → `src/lib/ai/categorize.ts:40`
- Returns matched keywords in reason → `src/lib/ai/categorize.ts:41`

**Example:**

```typescript
Input: description = "Toner za printer HP"
Matched keywords: ["toner", "printer"]
Output: {
  categoryId: "cat-456",
  categoryName: "Uredski materijal",
  confidence: 0.6,
  reason: "Prepoznate ključne riječi: toner, printer"
}
```

### 3. Keyword Categories

The system supports 12 default expense categories with Croatian and English keywords:

| Category Code | Croatian Keywords                                  | English Keywords             |
| ------------- | -------------------------------------------------- | ---------------------------- |
| OFFICE        | papir, toner, uredski, pisač, olovka, bilježnica   | office, printer              |
| TRAVEL        | gorivo, benzin, diesel, cestarina, parking, put    | autoprevoz                   |
| TELECOM       | mobitel, internet, telefon                         | a1, tele2, telemach, telekom |
| RENT          | najam, zakup, naknada, prostor                     | rent                         |
| UTILITIES     | struja, voda, plin, komunalije, grijanje, hlađenje | hep                          |
| SERVICES      | usluga, servis, održavanje, savjetovanje, podrška  | consulting                   |
| MARKETING     | marketing, reklama, promocija, oglas               | advertising                  |
| FOOD          | restoran, hrana, piće, kava, obrok                 | restaurant, catering         |
| TRANSPORT     | prijevoz, transport, dostava, kurir                | shipping                     |
| EQUIPMENT     | oprema, alat, uređaj, stroj                        | equipment, tool              |
| SOFTWARE      | software, licenca, pretplata, aplikacija, program  | subscription                 |
| INSURANCE     | osiguranje, polica, premija                        | insurance                    |

Source: `src/lib/ai/categorize.ts:5-18`

### 4. Deduplication & Ranking

- Combines vendor + keyword suggestions → `src/app/api/ai/suggest-category/route.ts:36-48`
- Filters duplicates by categoryId, keeping first occurrence → `src/app/api/ai/suggest-category/route.ts:50-54`
- Sorts by confidence descending → `src/app/api/ai/suggest-category/route.ts:55`
- Returns only top 3 suggestions → `src/app/api/ai/suggest-category/route.ts:56`

## API Reference

### POST /api/ai/suggest-category

**Request:**

```json
{
  "description": "Toner za printer HP",
  "vendor": "Tisak"
}
```

**Response:**

```json
{
  "suggestions": [
    {
      "categoryId": "cat-uuid-1",
      "categoryName": "Uredski materijal",
      "confidence": 0.95,
      "reason": "Prethodno korišteno za \"Tisak\""
    },
    {
      "categoryId": "cat-uuid-2",
      "categoryName": "IT oprema",
      "confidence": 0.6,
      "reason": "Prepoznate ključne riječi: toner, printer"
    }
  ]
}
```

**Authentication**: Required (session-based)
**Rate Limiting**: Debounced client-side (500ms)

## UI Integration

### Expense Form Suggestions

- Display below category dropdown → `src/app/(dashboard)/expenses/new/expense-form.tsx:216-247`
- Show "AI prijedlozi" label with Sparkles icon → `src/app/(dashboard)/expenses/new/expense-form.tsx:218-224`
- Loading indicator during API call → `src/app/(dashboard)/expenses/new/expense-form.tsx:225-227`
- Suggestions as clickable badges → `src/app/(dashboard)/expenses/new/expense-form.tsx:228-246`
- Confidence percentage display → `src/app/(dashboard)/expenses/new/expense-form.tsx:235`
- Tooltip with reasoning on hover → `src/app/(dashboard)/expenses/new/expense-form.tsx:238-242`

**Visual Design:**

- Badge with outline variant → `src/app/(dashboard)/expenses/new/expense-form.tsx:229`
- Cursor pointer on hover
- Category name + confidence % label
- Tooltip for explanation

### Auto-fill Behavior

When user clicks suggestion:

1. Sets categoryId state → `src/app/(dashboard)/expenses/new/expense-form.tsx:232`
2. Form updates to show selected category
3. VAT deductible default applied from category → Line 212

## Data Models

### CategorySuggestion Interface

```typescript
interface CategorySuggestion {
  categoryId: string // UUID of ExpenseCategory
  categoryName: string // Display name (e.g., "Uredski materijal")
  confidence: number // 0.0 to 1.0 (0% to 100%)
  reason?: string // Human-readable explanation
}
```

Source: `src/lib/ai/types.ts:37-42`

### ExpenseCategory Schema

```prisma
model ExpenseCategory {
  id                   String    @id @default(cuid())
  companyId            String?   // null = global category
  name                 String
  code                 String    // OFFICE, TRAVEL, etc.
  vatDeductibleDefault Boolean   @default(true)
  isActive             Boolean   @default(true)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt
  expenses             Expense[]
  company              Company?  @relation(fields: [companyId], references: [id])

  @@unique([companyId, code])
  @@index([companyId])
}
```

Source: `prisma/schema.prisma:376-390`

## Performance Optimization

### Client-Side Debouncing

- 500ms delay before API call → `src/app/(dashboard)/expenses/new/expense-form.tsx:82`
- Cleanup on unmount to prevent memory leaks → Line 83
- Prevents excessive API requests during typing

### Database Queries

- Single query for all categories (global + company) → `src/lib/ai/categorize.ts:24-26`
- Indexed lookup on vendor by name → `src/lib/ai/categorize.ts:54-62`
- Most recent expense via indexed orderBy → `src/lib/ai/categorize.ts:75-77`

### Response Optimization

- Returns only top 3 suggestions → `src/app/api/ai/suggest-category/route.ts:56`
- Early return if no description/vendor → `src/app/(dashboard)/expenses/new/expense-form.tsx:53-56`
- In-memory keyword matching (no AI API calls)

## Cost Analysis

**No AI API Usage**: This feature uses keyword matching and database lookups only. No OpenAI or external AI services required.

**Database Costs:**

- 1-2 database queries per suggestion request
- Negligible cost at any scale
- No rate limiting needed

**Comparison to AI Alternatives:**

- OpenAI GPT-based categorization: ~$0.0001-0.0005 per request
- This approach: $0.00 per request

## Extensibility

### Adding Custom Categories

1. Create category in database → `ExpenseCategory` table
2. Add keyword mappings → `src/lib/ai/categorize.ts:5-18`

Example:

```typescript
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  CUSTOM_CODE: ["keyword1", "keyword2", "ključna-riječ"],
  // ...
}
```

### Multi-Language Support

Current: Croatian + English keywords
Future: Extend CATEGORY_KEYWORDS with additional languages

### Machine Learning Integration

Future enhancement: Replace keyword matching with ML model trained on company's expense history.

## Testing

### Test Script

```bash
npx tsx scripts/test-ai.ts
```

Source: `scripts/test-ai.ts:50-80`

### Manual Testing

1. Navigate to /expenses/new
2. Type "Toner za printer" in description
3. Verify "Uredski materijal" suggestion appears
4. Check confidence percentage
5. Click suggestion to auto-select
6. Submit expense and verify category saved

### Test Cases

| Input Description   | Expected Category | Confidence |
| ------------------- | ----------------- | ---------- |
| Toner za printer HP | Uredski materijal | 60%        |
| Gorivo diesel       | Putni troškovi    | 60%        |
| Internet pretplata  | Telekomunikacije  | 30%        |
| Papir A4, olovke    | Uredski materijal | 60%        |

## Error Handling

### No Suggestions

- Returns empty array if no matches → `src/lib/ai/categorize.ts:46`
- UI shows nothing (graceful degradation)
- User can still manually select category

### Database Errors

- Caught and logged by API route → `src/app/api/ai/suggest-category/route.ts:59-65`
- Returns 500 error with message
- Frontend continues to function (suggestion optional)

### Invalid Input

- No description and no vendor: Early return → Line 53-56
- Invalid company: 404 error → Line 26-31
- Unauthorized: 401 error → Line 11-13

## Integration Points

### Related Features

- **F029: Create Expense** - Primary consumer of suggestions → `docs/02_FEATURES/features/expenses-create.md`
- **F032: Receipt Scanner** - Provides vendor/description for suggestions → `docs/02_FEATURES/features/expenses-receipt-scanner.md`
- **F033: Expense Categories** - Category management → `docs/02_FEATURES/features/expenses-categories.md`
- **F079: AI Feedback System** - Tracks suggestion accuracy → `src/app/api/ai/feedback/route.ts`

### Database Dependencies

- `ExpenseCategory` - Category definitions
- `Contact` - Vendor information
- `Expense` - Historical expense data
- `Company` - Tenant isolation

### Frontend Components

- ExpenseForm → `src/app/(dashboard)/expenses/new/expense-form.tsx`
- Badge → `src/components/ui/badge.tsx`
- Sparkles icon → lucide-react library

## Security Considerations

### Authentication

- Session-based auth required → `src/app/api/ai/suggest-category/route.ts:10-13`
- Company isolation via session → Line 21-31
- No direct companyId input (prevents cross-tenant access)

### Data Privacy

- Only accesses company's own expense history
- No data sent to external AI services
- All processing happens server-side

### Input Validation

- Description and vendor sanitized by Prisma
- No SQL injection risk (parameterized queries)
- No XSS risk (text-only responses)

## Monitoring & Analytics

### Success Metrics

Track via AI Feedback System (F079):

- Suggestion acceptance rate
- Confidence correlation with accuracy
- Most common keyword matches
- Vendor history hit rate

### Logs

- API calls logged via withApiLogging → `src/app/api/ai/suggest-category/route.ts:9`
- Errors logged with context → Line 60
- Includes userId and companyId for debugging

## Future Enhancements

- [ ] Custom keyword training per company
- [ ] ML-based categorization using expense history
- [ ] Multi-language keyword expansion
- [ ] Confidence threshold configuration
- [ ] Bulk expense categorization
- [ ] Category suggestion API for mobile apps
- [ ] A/B testing different keyword sets
- [ ] Integration with receipt OCR confidence scoring

## Known Limitations

1. **Static Keywords**: Fixed keyword dictionary, doesn't learn from corrections
2. **Language Limited**: Only Croatian and English keywords
3. **No Context**: Doesn't consider amount, date, or other expense attributes
4. **Exact Matching**: Substring matching only (no fuzzy matching)
5. **Manual Maintenance**: Keywords must be manually updated

## Evidence Links

1. API endpoint definition → `src/app/api/ai/suggest-category/route.ts:9-66`
2. Keyword matching logic → `src/lib/ai/categorize.ts:20-47`
3. Vendor history lookup → `src/lib/ai/categorize.ts:49-90`
4. Frontend integration → `src/app/(dashboard)/expenses/new/expense-form.tsx:51-84`
5. UI suggestion badges → `src/app/(dashboard)/expenses/new/expense-form.tsx:216-247`
6. TypeScript interfaces → `src/lib/ai/types.ts:37-42`
7. Keyword dictionary → `src/lib/ai/categorize.ts:5-18`
8. Database schema → `prisma/schema.prisma:376-390`
9. Test script → `scripts/test-ai.ts:50-80`
10. API logging wrapper → `src/app/api/ai/suggest-category/route.ts:9`
11. Authentication check → `src/app/api/ai/suggest-category/route.ts:10-13`
12. Company isolation → `src/app/api/ai/suggest-category/route.ts:21-31`
13. Vendor suggestion call → `src/app/api/ai/suggest-category/route.ts:38-43`
14. Description suggestion call → `src/app/api/ai/suggest-category/route.ts:45-48`
15. Deduplication logic → `src/app/api/ai/suggest-category/route.ts:50-56`
16. Confidence calculation → `src/lib/ai/categorize.ts:40`
17. Reason formatting → `src/lib/ai/categorize.ts:41`
18. Database query optimization → `src/lib/ai/categorize.ts:24-26`
19. Contact lookup → `src/lib/ai/categorize.ts:54-62`
20. Expense history query → `src/lib/ai/categorize.ts:67-78`
21. Client debouncing → `src/app/(dashboard)/expenses/new/expense-form.tsx:82`
22. Loading state → `src/app/(dashboard)/expenses/new/expense-form.tsx:225-227`
23. Click handler → `src/app/(dashboard)/expenses/new/expense-form.tsx:232`
24. Tooltip display → `src/app/(dashboard)/expenses/new/expense-form.tsx:238-242`
25. Error handling → `src/app/api/ai/suggest-category/route.ts:59-65`
26. AI features documentation → `docs/AI_FEATURES.md:129-158`

## Related Documentation

- AI Features Overview → `/home/admin/FiskAI/docs/AI_FEATURES.md`
- Phase 16 Implementation → `/home/admin/FiskAI/PHASE_16_IMPLEMENTATION.md`
- Expense Creation → `/home/admin/FiskAI/docs/02_FEATURES/features/expenses-create.md`
- Receipt Scanner → `/home/admin/FiskAI/docs/02_FEATURES/features/expenses-receipt-scanner.md`
- Expense Categories → `/home/admin/FiskAI/docs/02_FEATURES/features/expenses-categories.md`
