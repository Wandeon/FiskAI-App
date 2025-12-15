# Task 8: AI Feedback/Reporting Mechanism - Integration Guide

## Overview

This document describes the AI feedback/reporting mechanism implemented for FiskAI, allowing users to report when AI extraction or suggestions are incorrect and provide feedback to improve quality.

## What Was Implemented

### 1. Database Model

Added `AIFeedback` model to Prisma schema (`/home/admin/FiskAI/prisma/schema.prisma`):

```prisma
model AIFeedback {
  id          String   @id @default(cuid())
  companyId   String
  userId      String

  entityType  String   // "expense", "invoice", etc.
  entityId    String
  operation   String   // "ocr_receipt", "category_suggestion", "ocr_invoice"

  feedback    String   // "correct", "incorrect", "partial"
  correction  Json?    // What the correct value should be
  notes       String?

  createdAt   DateTime @default(now())

  @@index([companyId])
  @@index([entityType, entityId])
  @@index([operation])
}
```

**Indexes:**
- `companyId` - Fast lookup of feedback per company
- `[entityType, entityId]` - Find all feedback for a specific entity
- `operation` - Analyze feedback by AI operation type

### 2. Feedback Service

Created `/home/admin/FiskAI/src/lib/ai/feedback.ts` with the following functions:

#### `submitFeedback(input)`
Saves user feedback to the database.

**Input:**
```typescript
{
  companyId: string
  userId: string
  entityType: string      // "expense", "invoice", etc.
  entityId: string        // ID of the entity
  operation: string       // "ocr_receipt", "category_suggestion", etc.
  feedback: 'correct' | 'incorrect' | 'partial'
  correction?: Record<string, unknown>  // Optional: corrected values
  notes?: string          // Optional: user notes
}
```

**Returns:**
```typescript
{ success: true, feedback: AIFeedback }
```

#### `getFeedbackForEntity(entityType, entityId)`
Retrieves all feedback for a specific entity.

**Returns:** Array of `AIFeedback` objects, sorted by creation date (newest first).

#### `getFeedbackStats(companyId, operation?)`
Get aggregated statistics for AI accuracy.

**Returns:**
```typescript
{
  total: number        // Total feedback count
  correct: number      // Count of "correct" feedback
  incorrect: number    // Count of "incorrect" feedback
  partial: number      // Count of "partial" feedback
  accuracy: number     // Percentage (0-100)
}
```

Accuracy is calculated as: `(correct + partial * 0.5) / total * 100`

#### `getRecentFeedback(companyId, limit?)`
Get the most recent feedback for monitoring/analytics.

**Parameters:**
- `companyId` - Company to get feedback for
- `limit` - Max number of results (default: 10)

### 3. API Routes

Created `/home/admin/FiskAI/src/app/api/ai/feedback/route.ts`:

#### POST `/api/ai/feedback`
Submit new feedback.

**Request Body:**
```json
{
  "entityType": "expense",
  "entityId": "clx123456",
  "operation": "ocr_receipt",
  "feedback": "incorrect",
  "correction": {
    "vendor": "Correced Vendor Name",
    "total": 125.50
  },
  "notes": "Vendor name was misread"
}
```

**Validation:**
- `operation` must be one of: `ocr_receipt`, `ocr_invoice`, `category_suggestion`
- `feedback` must be one of: `correct`, `incorrect`, `partial`
- Uses Zod for schema validation

**Response:**
```json
{
  "success": true,
  "feedback": { ... }
}
```

#### GET `/api/ai/feedback`
Get feedback statistics or recent feedback.

**Query Parameters:**
- `type` - "stats" (default) or "recent"
- `operation` - Optional: filter by operation type
- `limit` - Optional: limit results (for type=recent, default: 10)

**Examples:**

Get overall statistics:
```
GET /api/ai/feedback?type=stats
```

Get statistics for OCR only:
```
GET /api/ai/feedback?type=stats&operation=ocr_receipt
```

Get recent feedback:
```
GET /api/ai/feedback?type=recent&limit=20
```

### 4. UI Components

#### `AIFeedback` Component
Location: `/home/admin/FiskAI/src/components/ai/ai-feedback.tsx`

A reusable component for collecting user feedback on AI operations.

**Props:**
```typescript
{
  entityType: string           // Type of entity (e.g., "expense", "invoice")
  entityId: string            // ID of the entity
  operation: 'ocr_receipt' | 'ocr_invoice' | 'category_suggestion'
  confidence?: number         // AI confidence score (0-1)
  className?: string          // Optional CSS classes
  compact?: boolean           // Use compact layout (default: false)
  onFeedbackSubmitted?: () => void  // Callback after feedback submitted
}
```

**Features:**
- Shows AI confidence badge when `confidence` prop is provided
- Three feedback options: Correct (thumbs up), Partial, Incorrect (thumbs down)
- For incorrect/partial feedback, prompts user to add notes
- Compact mode: Icon-only buttons for minimal UI
- Full mode: Labeled buttons with explanatory text

**Usage Example - Compact Mode:**
```tsx
import { AIFeedback } from '@/components/ai/ai-feedback'

<AIFeedback
  entityType="expense"
  entityId={expenseId}
  operation="ocr_receipt"
  confidence={0.85}
  compact={true}
/>
```

**Usage Example - Full Mode:**
```tsx
<AIFeedback
  entityType="expense"
  entityId={expenseId}
  operation="category_suggestion"
  confidence={0.72}
  onFeedbackSubmitted={() => {
    console.log('Feedback submitted!')
  }}
/>
```

#### `AIConfidenceBadge` Component
Location: `/home/admin/FiskAI/src/components/ai/ai-feedback.tsx`

Displays AI confidence level as a colored badge.

**Props:**
```typescript
{
  confidence: number    // 0-1 score
  className?: string
}
```

**Confidence Levels:**
- High (≥80%): Blue badge
- Medium (60-79%): Gray badge
- Low (<60%): Red badge

### 5. Enhanced Receipt Scanner (Example)

Created `/home/admin/FiskAI/src/components/expense/receipt-scanner-with-feedback.tsx` as an example of integrating AI feedback into the receipt scanning flow.

**Key Features:**
- Shows AI confidence after extraction
- Allows immediate feedback before confirming
- Integrates seamlessly with existing workflow

## Integration Examples

### Example 1: Add Feedback to Expense Form

After OCR extraction, show feedback in the expense form:

```tsx
// In expense-form.tsx
import { AIFeedback } from '@/components/ai/ai-feedback'

// After extraction succeeds
const [extractedData, setExtractedData] = useState(null)
const [expenseId, setExpenseId] = useState(null)

// After creating expense from extracted data
const result = await createExpense({ ... })
if (result.success) {
  setExpenseId(result.expense.id)
}

// In the UI, below the extracted data display
{extractedData && expenseId && (
  <AIFeedback
    entityType="expense"
    entityId={expenseId}
    operation="ocr_receipt"
    confidence={extractedData.confidence}
    className="mt-4"
  />
)}
```

### Example 2: Add Feedback to Category Suggestions

Show feedback UI next to category suggestions:

```tsx
// Where category suggestions are displayed
import { AIFeedback } from '@/components/ai/ai-feedback'

{suggestions.map((suggestion) => (
  <div key={suggestion.categoryId} className="flex items-center gap-2">
    <Badge onClick={() => setCategoryId(suggestion.categoryId)}>
      {suggestion.categoryName} ({Math.round(suggestion.confidence * 100)}%)
    </Badge>
    <AIFeedback
      entityType="expense"
      entityId={expenseId}
      operation="category_suggestion"
      confidence={suggestion.confidence}
      compact={true}
    />
  </div>
))}
```

### Example 3: Programmatic Feedback Submission

Submit feedback programmatically without UI component:

```typescript
async function submitAIFeedback(
  entityId: string,
  wasCorrect: boolean,
  correctedValues?: Record<string, unknown>
) {
  const response = await fetch('/api/ai/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entityType: 'expense',
      entityId,
      operation: 'ocr_receipt',
      feedback: wasCorrect ? 'correct' : 'incorrect',
      correction: correctedValues,
    }),
  })

  if (!response.ok) {
    console.error('Failed to submit feedback')
  }
}
```

### Example 4: Analytics Dashboard

Display AI accuracy metrics in admin dashboard:

```typescript
// Fetch stats
const response = await fetch('/api/ai/feedback?type=stats')
const { stats } = await response.json()

// Display
<div className="grid grid-cols-3 gap-4">
  <StatCard title="Total Feedback" value={stats.total} />
  <StatCard title="Accuracy" value={`${stats.accuracy}%`} />
  <StatCard
    title="Breakdown"
    value={`${stats.correct} ✓ / ${stats.incorrect} ✗`}
  />
</div>
```

### Example 5: Per-Operation Stats

Get accuracy for specific AI operations:

```typescript
// Get OCR accuracy
const ocrStats = await fetch('/api/ai/feedback?type=stats&operation=ocr_receipt')
  .then(r => r.json())

// Get category suggestion accuracy
const categoryStats = await fetch('/api/ai/feedback?type=stats&operation=category_suggestion')
  .then(r => r.json())

console.log(`OCR Accuracy: ${ocrStats.stats.accuracy}%`)
console.log(`Category Accuracy: ${categoryStats.stats.accuracy}%`)
```

## Where to Add Feedback UI

### Recommended Locations

1. **Expense Form** (`/home/admin/FiskAI/src/app/(dashboard)/expenses/new/expense-form.tsx`)
   - After OCR extraction completes
   - Next to category suggestions
   - Compact mode for suggestions, full mode after extraction

2. **Invoice Editor** (if exists)
   - After invoice OCR extraction
   - Similar to expense form

3. **Receipt Scanner** (`/home/admin/FiskAI/src/components/expense/receipt-scanner.tsx`)
   - After successful extraction, before confirmation
   - Use the enhanced version with feedback

4. **Import Review** (document import flow)
   - When reviewing AI-extracted documents
   - Allow feedback on entire extraction

## Best Practices

### When to Collect Feedback

1. **Immediately after AI operation**: Best time for accurate feedback
2. **During user correction**: If user edits AI-extracted data, auto-submit "incorrect" feedback
3. **After submission**: Quick thumbs up/down for confirmation

### What to Track

1. **Operation Type**: Different AI operations may have different accuracy
2. **Confidence Levels**: Correlate confidence with actual accuracy
3. **Correction Data**: Save what the correct values should be (helps improve AI)
4. **User Notes**: Qualitative feedback on what went wrong

### Privacy & Data

- All feedback is company-scoped
- Only stores entityId references (not full data)
- Correction data is optional (JSON field)
- No PII stored in feedback records

### Performance Considerations

- Feedback submission is non-blocking (fire and forget)
- Use compact mode for inline feedback to save space
- Debounce programmatic feedback to avoid spam

## Testing

### Test the API

```bash
# Submit feedback
curl -X POST http://localhost:3000/api/ai/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "entityType": "expense",
    "entityId": "test123",
    "operation": "ocr_receipt",
    "feedback": "correct"
  }'

# Get stats
curl http://localhost:3000/api/ai/feedback?type=stats

# Get recent feedback
curl http://localhost:3000/api/ai/feedback?type=recent&limit=5
```

### Test the UI

1. Go to new expense form
2. Use "Scan Receipt" feature
3. Verify AI confidence badge shows
4. Submit feedback (correct/incorrect/partial)
5. Check database for feedback record

### Verify Database

```sql
-- Check feedback records
SELECT * FROM "AIFeedback" ORDER BY "createdAt" DESC LIMIT 10;

-- Get accuracy stats
SELECT
  operation,
  COUNT(*) as total,
  SUM(CASE WHEN feedback = 'correct' THEN 1 ELSE 0 END) as correct,
  SUM(CASE WHEN feedback = 'incorrect' THEN 1 ELSE 0 END) as incorrect
FROM "AIFeedback"
GROUP BY operation;
```

## Future Enhancements

### Potential Improvements

1. **Auto-detect corrections**: When user edits AI-extracted data, automatically submit feedback
2. **Feedback trends**: Track accuracy over time to monitor AI performance
3. **A/B testing**: Test different AI models and compare feedback
4. **Training data**: Use feedback to fine-tune AI models
5. **Bulk feedback**: Allow marking multiple items as correct/incorrect
6. **Feedback reminders**: Prompt users who haven't given feedback in a while

### Machine Learning Integration

The feedback system is designed to support ML improvements:

```typescript
// Example: Export training data
async function exportTrainingData() {
  const feedback = await db.aIFeedback.findMany({
    where: {
      feedback: 'incorrect',
      correction: { not: null }
    },
    include: {
      // Include original entity data for comparison
    }
  })

  // Format for ML training
  return feedback.map(f => ({
    input: f.originalData,
    expectedOutput: f.correction,
    operation: f.operation
  }))
}
```

## Files Created/Modified

### Created Files
1. `/home/admin/FiskAI/src/lib/ai/feedback.ts` - Feedback service
2. `/home/admin/FiskAI/src/app/api/ai/feedback/route.ts` - API endpoints
3. `/home/admin/FiskAI/src/components/ai/ai-feedback.tsx` - UI component
4. `/home/admin/FiskAI/src/components/expense/receipt-scanner-with-feedback.tsx` - Example integration

### Modified Files
1. `/home/admin/FiskAI/prisma/schema.prisma` - Added AIFeedback model

### Database Changes
- Created `AIFeedback` table with indexes
- Schema pushed to database via `prisma db push`
- Prisma client regenerated

## Summary

The AI feedback mechanism is now fully functional and ready to use. It provides:

- ✅ Database model for storing feedback
- ✅ Service layer for feedback operations
- ✅ REST API for submitting and retrieving feedback
- ✅ Reusable UI components
- ✅ Confidence level indicators
- ✅ Statistics and analytics support
- ✅ Easy integration with existing AI features

Users can now report incorrect AI extractions, provide corrections, and help improve the system's accuracy over time.
