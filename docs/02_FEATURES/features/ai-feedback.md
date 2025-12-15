# Feature: AI Feedback System (F079)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 34

## Purpose

The AI Feedback System enables users to provide feedback on AI-powered operations (OCR receipt extraction, invoice extraction, and category suggestions), helping improve model accuracy over time. Users can rate AI predictions as correct, incorrect, or partial, optionally providing corrective data and notes. The system tracks feedback statistics including accuracy percentages, aggregates feedback by operation type, and provides analytics widgets for monitoring AI performance. Feedback data is stored per company and operation, supporting future model improvements and providing transparency about AI reliability to users.

## User Entry Points

| Type      | Path                        | Evidence                                                       |
| --------- | --------------------------- | -------------------------------------------------------------- |
| Component | AIFeedback                  | `src/components/ai/ai-feedback.tsx:19`                         |
| Component | AIStatsWidget               | `src/components/ai/ai-stats-widget.tsx:21`                     |
| API       | POST /api/ai/feedback       | `src/app/api/ai/feedback/route.ts:27`                          |
| API       | GET /api/ai/feedback        | `src/app/api/ai/feedback/route.ts:87`                          |
| Usage     | Receipt Scanner Integration | `src/components/expense/receipt-scanner-with-feedback.tsx:182` |

## Core Flow

1. User completes AI operation (receipt scan, category suggestion) → `src/components/expense/receipt-scanner-with-feedback.tsx:35-95`
2. System displays AIFeedback component with confidence badge → `src/components/ai/ai-feedback.tsx:146-229`
3. User selects feedback type (correct/incorrect/partial) → `src/components/ai/ai-feedback.tsx:70-77`
4. If incorrect/partial, system shows notes textarea → `src/components/ai/ai-feedback.tsx:99-144`
5. User optionally provides correction notes → `src/components/ai/ai-feedback.tsx:113-120`
6. User submits feedback to /api/ai/feedback → `src/components/ai/ai-feedback.tsx:42-52`
7. API validates feedback schema with Zod → `src/app/api/ai/feedback/route.ts:38-45`
8. System retrieves user's company context → `src/app/api/ai/feedback/route.ts:50-57`
9. Service layer saves feedback to database → `src/lib/ai/feedback.ts:26-56`
10. System logs feedback submission → `src/lib/ai/feedback.ts:41-49`
11. API returns success response → `src/app/api/ai/feedback/route.ts:73`
12. Component displays confirmation message → `src/components/ai/ai-feedback.tsx:92-97`
13. Optional callback triggered for parent component → `src/components/ai/ai-feedback.tsx:61`
14. Analytics widgets can fetch stats via GET endpoint → `src/app/api/ai/feedback/route.ts:113-120`
15. System calculates accuracy from feedback data → `src/lib/ai/feedback.ts:108-115`
16. Stats displayed in AIStatsWidget component → `src/components/ai/ai-stats-widget.tsx:114-124`

## Key Modules

| Module                     | Purpose                                   | Location                                                      |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| AIFeedback                 | User feedback collection UI component     | `src/components/ai/ai-feedback.tsx:19`                        |
| AIConfidenceBadge          | Displays AI confidence level as badge     | `src/components/ai/ai-feedback.tsx:236`                       |
| AIStatsWidget              | Full statistics dashboard widget          | `src/components/ai/ai-stats-widget.tsx:21`                    |
| CompactAIStats             | Compact accuracy badge display            | `src/components/ai/ai-stats-widget.tsx:173`                   |
| submitFeedback             | Saves feedback to database                | `src/lib/ai/feedback.ts:26`                                   |
| getFeedbackStats           | Calculates accuracy statistics            | `src/lib/ai/feedback.ts:86`                                   |
| getRecentFeedback          | Retrieves recent feedback entries         | `src/lib/ai/feedback.ts:126`                                  |
| getFeedbackForEntity       | Gets feedback for specific entity         | `src/lib/ai/feedback.ts:61`                                   |
| POST /api/ai/feedback      | Feedback submission endpoint              | `src/app/api/ai/feedback/route.ts:27`                         |
| GET /api/ai/feedback       | Statistics and recent feedback endpoint   | `src/app/api/ai/feedback/route.ts:87`                         |
| ReceiptScannerWithFeedback | Receipt scanner with feedback integration | `src/components/expense/receipt-scanner-with-feedback.tsx:21` |

## Feedback Collection Features

### Feedback Component Modes

- **Full Mode** → `src/components/ai/ai-feedback.tsx:182-228`
  - Large labeled buttons with icons → `src/components/ai/ai-feedback.tsx:196-226`
  - Three options: Da (correct), Djelomično (partial), Ne (incorrect)
  - Question prompt: "Je li AI dobro prepoznao?" → `src/components/ai/ai-feedback.tsx:188`
  - Displays confidence badge alongside → `src/components/ai/ai-feedback.tsx:191-193`

- **Compact Mode** → `src/components/ai/ai-feedback.tsx:146-179`
  - Icon-only thumbs up/down/alert buttons → `src/components/ai/ai-feedback.tsx:153-176`
  - Minimal space usage for inline display
  - Tooltips for accessibility (Točno, Netočno, Prijavi problem) → `src/components/ai/ai-feedback.tsx:157-173`
  - Optional confidence badge display → `src/components/ai/ai-feedback.tsx:149-151`

- **Notes Input Mode** → `src/components/ai/ai-feedback.tsx:99-144`
  - Triggered for incorrect/partial feedback → `src/components/ai/ai-feedback.tsx:71-73`
  - Textarea for problem description → `src/components/ai/ai-feedback.tsx:113-120`
  - Submit and Skip buttons → `src/components/ai/ai-feedback.tsx:122-141`
  - Cancel option to return to selection → `src/components/ai/ai-feedback.tsx:104-111`

### Feedback Validation

- **Zod Schema Validation** → `src/app/api/ai/feedback/route.ts:14-21`
  - entityType: String, minimum 1 character → `src/app/api/ai/feedback/route.ts:15`
  - entityId: String, minimum 1 character → `src/app/api/ai/feedback/route.ts:16`
  - operation: Enum (ocr_receipt, ocr_invoice, category_suggestion) → `src/app/api/ai/feedback/route.ts:17`
  - feedback: Enum (correct, incorrect, partial) → `src/app/api/ai/feedback/route.ts:18`
  - correction: Optional JSON object → `src/app/api/ai/feedback/route.ts:19`
  - notes: Optional string → `src/app/api/ai/feedback/route.ts:20`

- **Schema Enforcement** → `src/app/api/ai/feedback/route.ts:39-45`
  - SafeParse validation before processing
  - Returns 400 status with error details on failure
  - Formatted validation errors from Zod

### Confidence Display

- **AIConfidenceBadge Component** → `src/components/ai/ai-feedback.tsx:236-260`
  - High confidence (≥80%): "Visoka pouzdanost" - default variant → `src/components/ai/ai-feedback.tsx:242-250`
  - Medium confidence (≥60%): "Srednja pouzdanost" - secondary variant → `src/components/ai/ai-feedback.tsx:244-252`
  - Low confidence (<60%): "Niska pouzdanost" - destructive variant → `src/components/ai/ai-feedback.tsx:246-253`
  - Displays percentage alongside label → `src/components/ai/ai-feedback.tsx:256-258`

## Feedback Analytics

### Statistics Calculation

- **getFeedbackStats Function** → `src/lib/ai/feedback.ts:86-121`
  - Queries all feedback for company and optional operation → `src/lib/ai/feedback.ts:91-101`
  - Counts correct, incorrect, partial feedback → `src/lib/ai/feedback.ts:104-106`
  - Calculates accuracy: (correct + partial _ 0.5) / total _ 100 → `src/lib/ai/feedback.ts:108`
  - Returns FeedbackStats object with rounded accuracy → `src/lib/ai/feedback.ts:110-116`

- **FeedbackStats Interface** → `src/lib/ai/feedback.ts:15-21`
  - total: Total feedback count → `src/lib/ai/feedback.ts:16`
  - correct: Count of correct feedback → `src/lib/ai/feedback.ts:17`
  - incorrect: Count of incorrect feedback → `src/lib/ai/feedback.ts:18`
  - partial: Count of partial feedback → `src/lib/ai/feedback.ts:19`
  - accuracy: Percentage (0-100) → `src/lib/ai/feedback.ts:20`

### Statistics Widget

- **AIStatsWidget Component** → `src/components/ai/ai-stats-widget.tsx:21-163`
  - Fetches stats from /api/ai/feedback?type=stats → `src/components/ai/ai-stats-widget.tsx:32`
  - Optional operation filter parameter → `src/components/ai/ai-stats-widget.tsx:30`
  - Displays overall accuracy with color coding → `src/components/ai/ai-stats-widget.tsx:114-124`
  - Shows breakdown of correct/partial/incorrect counts → `src/components/ai/ai-stats-widget.tsx:127-151`
  - Total feedback count at bottom → `src/components/ai/ai-stats-widget.tsx:154-158`

- **Accuracy Color Coding** → `src/components/ai/ai-stats-widget.tsx:83-95`
  - High (≥80%): Green (text-green-600, bg-green-50) → `src/components/ai/ai-stats-widget.tsx:84-92`
  - Medium (≥60%): Yellow (text-yellow-600, bg-yellow-50) → `src/components/ai/ai-stats-widget.tsx:86-94`
  - Low (<60%): Red (text-red-600, bg-red-50) → `src/components/ai/ai-stats-widget.tsx:88-95`

- **CompactAIStats Component** → `src/components/ai/ai-stats-widget.tsx:173-206`
  - Badge display showing "AI: {accuracy}% ({total})" → `src/components/ai/ai-stats-widget.tsx:202-203`
  - Sparkles icon for AI indication → `src/components/ai/ai-stats-widget.tsx:202`
  - Variant based on accuracy threshold → `src/components/ai/ai-stats-widget.tsx:197-198`
  - Returns null if no feedback data → `src/components/ai/ai-stats-widget.tsx:195`

### Recent Feedback

- **getRecentFeedback Function** → `src/lib/ai/feedback.ts:126-146`
  - Retrieves most recent feedback for company → `src/lib/ai/feedback.ts:131-139`
  - Ordered by createdAt descending → `src/lib/ai/feedback.ts:135-137`
  - Configurable limit (default: 10) → `src/lib/ai/feedback.ts:128`

- **API Query Parameter** → `src/app/api/ai/feedback/route.ts:109-116`
  - GET /api/ai/feedback?type=recent → `src/app/api/ai/feedback/route.ts:113`
  - Optional limit parameter → `src/app/api/ai/feedback/route.ts:111`
  - Returns array of feedback entries → `src/app/api/ai/feedback/route.ts:115`

## API Endpoints

### POST /api/ai/feedback

- **Purpose**: Submit user feedback about AI operation → `src/app/api/ai/feedback/route.ts:27-81`
- **Authentication**: Requires valid session → `src/app/api/ai/feedback/route.ts:28-31`
- **Authorization**: User must have default company → `src/app/api/ai/feedback/route.ts:50-57`
- **Request Body**:
  ```json
  {
    "entityType": "expense",
    "entityId": "clx123456",
    "operation": "ocr_receipt",
    "feedback": "incorrect",
    "correction": { "vendor": "Corrected Name" },
    "notes": "Vendor name misread"
  }
  ```
- **Validation**: Zod schema enforcement → `src/app/api/ai/feedback/route.ts:38-45`
- **Context Tracking**: Updates context with userId and companyId → `src/app/api/ai/feedback/route.ts:33,59`
- **Response**: `{ success: true, feedback: {...} }` → `src/app/api/ai/feedback/route.ts:73`
- **Error Handling**: Returns 400/401/404/500 with error details → `src/app/api/ai/feedback/route.ts:40-44,74-80`

### GET /api/ai/feedback

- **Purpose**: Retrieve feedback statistics or recent entries → `src/app/api/ai/feedback/route.ts:87-128`
- **Authentication**: Requires valid session → `src/app/api/ai/feedback/route.ts:88-91`
- **Query Parameters**:
  - type: "stats" (default) or "recent" → `src/app/api/ai/feedback/route.ts:109`
  - operation: Optional filter (ocr_receipt, ocr_invoice, category_suggestion) → `src/app/api/ai/feedback/route.ts:110`
  - limit: Max results for recent type (default: 10) → `src/app/api/ai/feedback/route.ts:111`
- **Stats Response**: `{ stats: { total, correct, incorrect, partial, accuracy } }` → `src/app/api/ai/feedback/route.ts:120`
- **Recent Response**: `{ feedback: [...] }` → `src/app/api/ai/feedback/route.ts:115`
- **Operation Filtering**: Stats can be filtered by operation type → `src/app/api/ai/feedback/route.ts:119`

## Integration Examples

### Receipt Scanner Integration

- **ReceiptScannerWithFeedback Component** → `src/components/expense/receipt-scanner-with-feedback.tsx:21-258`
  - Shows feedback component after successful extraction → `src/components/expense/receipt-scanner-with-feedback.tsx:182-192`
  - Passes entityId, entityType="expense", operation="ocr_receipt" → `src/components/expense/receipt-scanner-with-feedback.tsx:184-186`
  - Includes confidence score from extraction → `src/components/expense/receipt-scanner-with-feedback.tsx:187`
  - Callback logs feedback submission → `src/components/expense/receipt-scanner-with-feedback.tsx:188-190`

- **Conditional Display** → `src/components/expense/receipt-scanner-with-feedback.tsx:182`
  - Only shows if showFeedback=true, extractedData exists, and entityId provided
  - Prevents feedback submission without entity context

## Data

### Database Tables

- **AIFeedback Model** → `prisma/schema.prisma:1066-1084`
  - id: String, cuid primary key → `prisma/schema.prisma:1067`
  - companyId: String, tenant isolation → `prisma/schema.prisma:1068`
  - userId: String, feedback submitter → `prisma/schema.prisma:1069`
  - entityType: String, entity type (expense, invoice) → `prisma/schema.prisma:1071`
  - entityId: String, entity reference → `prisma/schema.prisma:1072`
  - operation: String, AI operation type → `prisma/schema.prisma:1073`
  - feedback: String, user rating (correct/incorrect/partial) → `prisma/schema.prisma:1075`
  - correction: Json, optional corrected values → `prisma/schema.prisma:1076`
  - notes: String, optional user notes → `prisma/schema.prisma:1077`
  - createdAt: DateTime, submission timestamp → `prisma/schema.prisma:1079`

- **Database Indexes** → `prisma/schema.prisma:1081-1083`
  - companyId index for tenant queries → `prisma/schema.prisma:1081`
  - [entityType, entityId] composite for entity lookup → `prisma/schema.prisma:1082`
  - operation index for operation-specific stats → `prisma/schema.prisma:1083`

### Service Layer Types

- **SubmitFeedbackInput Interface** → `src/lib/ai/feedback.ts:4-13`
  - All fields required for feedback submission
  - Includes optional correction and notes
  - Typed operation string (not enum in service layer)

- **FeedbackStats Interface** → `src/lib/ai/feedback.ts:15-21`
  - Aggregated statistics for analytics
  - Accuracy as calculated percentage

## Component Props

### AIFeedback Props

- **AIFeedbackProps Interface** → `src/components/ai/ai-feedback.tsx:9-17`
  - entityType: String, type of entity being rated → `src/components/ai/ai-feedback.tsx:10`
  - entityId: String, ID of entity → `src/components/ai/ai-feedback.tsx:11`
  - operation: Enum (ocr_receipt, ocr_invoice, category_suggestion) → `src/components/ai/ai-feedback.tsx:12`
  - confidence?: Number, AI confidence score 0-1 → `src/components/ai/ai-feedback.tsx:13`
  - className?: String, optional CSS classes → `src/components/ai/ai-feedback.tsx:14`
  - compact?: Boolean, use compact mode (default: false) → `src/components/ai/ai-feedback.tsx:15`
  - onFeedbackSubmitted?: Callback after successful submission → `src/components/ai/ai-feedback.tsx:16`

### AIStatsWidget Props

- **AIStatsWidgetProps Interface** → `src/components/ai/ai-stats-widget.tsx:16-19`
  - operation?: String, optional filter by operation type → `src/components/ai/ai-stats-widget.tsx:17`
  - className?: String, optional CSS classes → `src/components/ai/ai-stats-widget.tsx:18`

- **CompactAIStatsProps Interface** → `src/components/ai/ai-stats-widget.tsx:165-168`
  - Same as AIStatsWidgetProps
  - Returns null if no data available → `src/components/ai/ai-stats-widget.tsx:195`

## Error Handling

### Component Error States

- **Loading State** → `src/components/ai/ai-stats-widget.tsx:47-57`
  - Skeleton placeholder while fetching stats
  - Animated pulse effect
  - Prevents layout shift

- **Error State** → `src/components/ai/ai-stats-widget.tsx:60-67`
  - Red text error message display
  - Maintains card layout
  - Shows fetch error details

- **Empty State** → `src/components/ai/ai-stats-widget.tsx:70-80`
  - "Još nema povratnih informacija" message
  - Sparkles icon with opacity
  - Centered text display

### API Error Handling

- **Validation Errors** → `src/app/api/ai/feedback/route.ts:40-45`
  - Returns 400 status with Zod error format
  - Includes detailed validation error structure

- **Authentication Errors** → `src/app/api/ai/feedback/route.ts:28-31,88-91`
  - Returns 401 "Unauthorized" if no session

- **Authorization Errors** → `src/app/api/ai/feedback/route.ts:55-57,102-104`
  - Returns 404 "Company not found" if no default company

- **Server Errors** → `src/app/api/ai/feedback/route.ts:74-80,122-127`
  - Logs error with context → `src/app/api/ai/feedback/route.ts:75,123`
  - Returns 500 with error message
  - Catches both typed and unknown errors

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required → `src/app/api/ai/feedback/route.ts:28`
  - [[company-management]] - Company context required → `src/app/api/ai/feedback/route.ts:50-53`
  - Database (Prisma) - AIFeedback table access → `src/lib/ai/feedback.ts:28`
  - Logging system - Structured logging → `src/lib/ai/feedback.ts:41-49`
  - Context tracking - User/company context → `src/app/api/ai/feedback/route.ts:33,59`

- **Depended by**:
  - [[expenses-receipt-scanner]] - Collects OCR feedback
  - [[expense-categories]] - Collects category suggestion feedback
  - Future invoice OCR features - Will use same system
  - Analytics dashboards - Stats widget integration

## Verification Checklist

- [ ] AIFeedback component renders in full mode
- [ ] AIFeedback component renders in compact mode
- [ ] Correct feedback submits immediately without notes
- [ ] Incorrect feedback shows notes textarea
- [ ] Partial feedback shows notes textarea
- [ ] Notes can be submitted with feedback
- [ ] Notes can be skipped (feedback without notes)
- [ ] Cancel button returns to feedback selection
- [ ] Confidence badge displays for high confidence (≥80%)
- [ ] Confidence badge displays for medium confidence (60-79%)
- [ ] Confidence badge displays for low confidence (<60%)
- [ ] POST /api/ai/feedback validates schema with Zod
- [ ] POST /api/ai/feedback requires authentication
- [ ] POST /api/ai/feedback saves to database
- [ ] POST /api/ai/feedback logs submission
- [ ] GET /api/ai/feedback returns stats by default
- [ ] GET /api/ai/feedback filters by operation
- [ ] GET /api/ai/feedback returns recent feedback
- [ ] Accuracy calculation: (correct + partial\*0.5)/total
- [ ] AIStatsWidget fetches and displays stats
- [ ] AIStatsWidget shows loading skeleton
- [ ] AIStatsWidget shows error state
- [ ] AIStatsWidget shows empty state
- [ ] AIStatsWidget color codes by accuracy
- [ ] CompactAIStats displays badge format
- [ ] CompactAIStats returns null if no data
- [ ] Feedback submission triggers callback
- [ ] Thank you message displays after submission
- [ ] Tenant isolation: companyId index enforced
- [ ] Entity lookup: [entityType, entityId] index used
- [ ] Operation filtering: operation index used

## Evidence Links

1. AIFeedback component definition → `src/components/ai/ai-feedback.tsx:19`
2. AIConfidenceBadge component → `src/components/ai/ai-feedback.tsx:236`
3. AIStatsWidget component → `src/components/ai/ai-stats-widget.tsx:21`
4. CompactAIStats component → `src/components/ai/ai-stats-widget.tsx:173`
5. submitFeedback service function → `src/lib/ai/feedback.ts:26`
6. getFeedbackStats service function → `src/lib/ai/feedback.ts:86`
7. getRecentFeedback service function → `src/lib/ai/feedback.ts:126`
8. getFeedbackForEntity service function → `src/lib/ai/feedback.ts:61`
9. POST /api/ai/feedback endpoint → `src/app/api/ai/feedback/route.ts:27`
10. GET /api/ai/feedback endpoint → `src/app/api/ai/feedback/route.ts:87`
11. Feedback schema validation → `src/app/api/ai/feedback/route.ts:14`
12. AIFeedback database model → `prisma/schema.prisma:1066`
13. Database indexes definition → `prisma/schema.prisma:1081-1083`
14. ReceiptScannerWithFeedback integration → `src/components/expense/receipt-scanner-with-feedback.tsx:182`
15. Accuracy calculation algorithm → `src/lib/ai/feedback.ts:108`
16. FeedbackStats interface → `src/lib/ai/feedback.ts:15`
17. AIFeedbackProps interface → `src/components/ai/ai-feedback.tsx:9`
18. Task documentation reference → `TASK_8_AI_FEEDBACK_INTEGRATION.md:1`
