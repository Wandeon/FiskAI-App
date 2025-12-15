# Feature: Recurring Expenses

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 9
- Implementation: ⚠️ Database schema complete, application logic pending

## Purpose

The Recurring Expenses feature enables users to configure automatic generation of repetitive expenses such as monthly rent, quarterly insurance payments, or weekly subscriptions. The system stores expense templates with scheduling information and uses a cron job to generate actual expense records on the specified dates, eliminating manual data entry for predictable recurring costs.

## User Entry Points

| Type     | Path                | Evidence                                |
| -------- | ------------------- | --------------------------------------- |
| Database | RecurringExpense    | `prisma/schema.prisma:392-411`          |
| Action   | Server Actions      | Planned: `src/app/actions/expense.ts`   |
| Cron     | Scheduled Generator | Planned: `/api/cron/recurring-expenses` |

## Core Flow

1. User creates a recurring expense template with frequency and amounts → Planned UI
2. System stores template in RecurringExpense table → `prisma/schema.prisma:392-411`
3. System calculates initial nextDate based on frequency → Planned calculation logic
4. Cron job runs daily checking for due recurring expenses → Planned: `/api/cron/recurring-expenses`
5. System finds all active recurring expenses where nextDate ≤ today → Query: `nextDate` index at `prisma/schema.prisma:410`
6. System generates new Expense record from template → Uses `src/app/actions/expense.ts:33-93`
7. System calculates next occurrence date based on frequency → Planned date calculation
8. System updates recurring expense with new nextDate → Updates `RecurringExpense.nextDate`
9. If endDate reached, system marks recurring expense as inactive → Sets `isActive = false`
10. Generated expenses appear in normal expense list → `/documents?category=expense`

## Key Modules

| Module           | Purpose                         | Location                             |
| ---------------- | ------------------------------- | ------------------------------------ |
| RecurringExpense | Database model for templates    | `prisma/schema.prisma:392-411`       |
| Frequency enum   | Scheduling options              | `prisma/schema.prisma:848-853`       |
| createExpense    | Generates expense from template | `src/app/actions/expense.ts:33-93`   |
| Tenant isolation | Multi-company data protection   | `src/lib/prisma-extensions.ts:68,87` |
| ExpenseCategory  | Categorization for recurring    | `prisma/schema.prisma:376-390`       |

## Database Schema

### RecurringExpense Model

The RecurringExpense model stores the template configuration → `prisma/schema.prisma:392-411`:

```prisma
model RecurringExpense {
  id          String    @id @default(cuid())
  companyId   String
  vendorId    String?
  categoryId  String
  description String
  netAmount   Decimal   @db.Decimal(10, 2)
  vatAmount   Decimal   @db.Decimal(10, 2)
  totalAmount Decimal   @db.Decimal(10, 2)
  frequency   Frequency
  nextDate    DateTime
  endDate     DateTime?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  company     Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([nextDate])
}
```

**Key Fields:**

- `frequency` - WEEKLY, MONTHLY, QUARTERLY, or YEARLY → `prisma/schema.prisma:401`
- `nextDate` - When the next expense should be generated → `prisma/schema.prisma:402`
- `endDate` - Optional termination date for the recurrence → `prisma/schema.prisma:403`
- `isActive` - Controls whether generation continues → `prisma/schema.prisma:404`

### Frequency Enum

Four scheduling options are supported → `prisma/schema.prisma:848-853`:

```prisma
enum Frequency {
  WEEKLY
  MONTHLY
  QUARTERLY
  YEARLY
}
```

**Croatian Translation:**

| Value     | Croatian  | Generation Logic       |
| --------- | --------- | ---------------------- |
| WEEKLY    | Tjedno    | Add 7 days             |
| MONTHLY   | Mjesečno  | Add 1 month (same day) |
| QUARTERLY | Kvartalno | Add 3 months           |
| YEARLY    | Godišnje  | Add 1 year (same date) |

### Indexes

Two indexes optimize recurring expense operations:

1. **companyId** → `prisma/schema.prisma:409`
   - Enables tenant-isolated queries
   - Used by multi-tenancy middleware → `src/lib/prisma-extensions.ts:68`

2. **nextDate** → `prisma/schema.prisma:410`
   - Optimizes cron job queries for due expenses
   - Critical for daily scheduled processing

## Next Date Calculation

### Initial Next Date

When creating a recurring expense, the user sets the first occurrence date. This becomes the initial `nextDate` value.

**Example:**

- User creates "Monthly Rent" on 2025-01-15
- Sets frequency to MONTHLY
- System stores nextDate = 2025-02-01 (first payment date)

### Subsequent Calculations

After generating an expense, the system calculates the next occurrence:

**WEEKLY:**

```typescript
nextDate = addDays(currentNextDate, 7)
```

**MONTHLY:**

```typescript
nextDate = addMonths(currentNextDate, 1)
// Handles month-end edge cases (e.g., Jan 31 → Feb 28)
```

**QUARTERLY:**

```typescript
nextDate = addMonths(currentNextDate, 3)
```

**YEARLY:**

```typescript
nextDate = addYears(currentNextDate, 1)
// Preserves exact date (e.g., 2025-06-15 → 2026-06-15)
```

### End Date Handling

If `endDate` is set and nextDate would exceed it:

1. Generate final expense on current nextDate
2. Set `isActive = false`
3. Stop future generation

**Example:**

- Monthly subscription from 2025-01-01 to 2025-06-30
- Generates expenses on: Jan 1, Feb 1, Mar 1, Apr 1, May 1, Jun 1
- After Jun 1 generation, sets isActive = false

## Automatic Generation Logic

### Planned Cron Job Architecture

The system will implement a daily cron job at `/api/cron/recurring-expenses` similar to existing cron patterns → `vercel.json:1-12`:

**Cron Schedule:**

```json
{
  "path": "/api/cron/recurring-expenses",
  "schedule": "0 6 * * *" // Daily at 6 AM UTC
}
```

### Generation Query

The cron job queries for expenses due today or overdue:

```typescript
const dueExpenses = await db.recurringExpense.findMany({
  where: {
    isActive: true,
    nextDate: { lte: new Date() },
  },
  include: {
    category: true,
    vendor: true,
  },
})
```

Uses the `nextDate` index for optimal performance → `prisma/schema.prisma:410`.

### Expense Creation

For each due recurring expense, the system:

1. **Creates new Expense record** using existing action → `src/app/actions/expense.ts:33-93`:

   ```typescript
   await createExpense({
     categoryId: recurring.categoryId,
     vendorId: recurring.vendorId,
     description: recurring.description,
     date: recurring.nextDate,
     netAmount: recurring.netAmount,
     vatAmount: recurring.vatAmount,
     totalAmount: recurring.totalAmount,
     vatDeductible: category.vatDeductibleDefault,
   })
   ```

2. **Calculates next occurrence** based on frequency
3. **Updates recurring template:**
   ```typescript
   await db.recurringExpense.update({
     where: { id: recurring.id },
     data: {
       nextDate: calculateNextDate(recurring.nextDate, recurring.frequency),
       isActive: shouldContinue(nextDate, recurring.endDate),
     },
   })
   ```

## Management UI (Planned)

### List View

**Location:** Planned `/settings/recurring-expenses`

**Display Columns:**

- Description (e.g., "Monthly Office Rent")
- Vendor name (if set)
- Category
- Amount (totalAmount)
- Frequency badge (WEEKLY/MONTHLY/QUARTERLY/YEARLY)
- Next date
- Status (Active/Inactive)
- Actions (Edit, Pause, Delete)

### Create/Edit Form

**Fields:**

- **Vendor** - Optional dropdown from contacts → `prisma/schema.prisma:395`
- **Category** - Required dropdown → `prisma/schema.prisma:396`
- **Description** - Free text (e.g., "Internet subscription")
- **Amount** - Net, VAT, Total (calculated fields)
- **Frequency** - Radio buttons or dropdown → `prisma/schema.prisma:401`
- **Start Date** - First occurrence (sets nextDate)
- **End Date** - Optional termination date → `prisma/schema.prisma:403`

### Pause/Resume

Users can temporarily stop generation without deleting:

- **Pause** - Sets `isActive = false`
- **Resume** - Sets `isActive = true` and recalculates nextDate

## Data

### Database Tables

- **RecurringExpense** → `prisma/schema.prisma:392-411`
  - Primary table storing expense templates
  - Indexed by companyId and nextDate
  - Cascade deletes with Company

- **Expense** → `prisma/schema.prisma:345-374`
  - Generated records from templates
  - No explicit link back to RecurringExpense (intentional)
  - User can modify generated expenses independently

- **ExpenseCategory** → `prisma/schema.prisma:376-390`
  - Required for categorization
  - Determines VAT deductibility defaults

- **Contact** → `prisma/schema.prisma:148-171`
  - Optional vendor linkage via vendorId
  - Supports supplier relationship tracking

## Security

### Multi-Tenant Isolation

RecurringExpense is protected by tenant middleware → `src/lib/prisma-extensions.ts:68,87`:

1. **Automatic filtering** - All queries filtered by companyId
2. **Audit logging** - Changes tracked in AuditLog
3. **Cascade deletion** - Removed when company deleted

### Authorization

Following existing expense patterns → `src/app/actions/expense.ts:1-365`:

1. **Create/Update** - Requires authenticated user with company context
2. **Delete** - Requires specific permission (`expense:delete`)
3. **Vendor validation** - Ensures vendor belongs to same company

### Data Validation

**Planned validation rules:**

- netAmount + vatAmount must equal totalAmount
- nextDate cannot be in the past
- endDate must be after nextDate
- frequency must be valid enum value
- categoryId must reference existing category

## Error Handling

### Cron Job Failures

**Network/Database Errors:**

- Log error with details
- Continue processing remaining recurring expenses
- Don't update nextDate if generation fails
- Retry on next cron run (idempotent)

**Generation Limit Exceeded:**

- If company hits monthly expense limit during generation
- Log warning
- Skip generation for that company
- Retain original nextDate for next attempt

**Invalid Category/Vendor:**

- If referenced category or vendor was deleted
- Mark recurring expense as isActive = false
- Notify user via email or dashboard alert

### User-Facing Errors

**Create/Edit Form:**

- "Kategorija je obavezna" - Category required
- "Iznosi ne odgovaraju" - Amount mismatch
- "Datum završetka mora biti nakon početnog datuma" - Invalid date range
- "Dobavljač nije pronađen" - Vendor not found

## Use Cases

### Example 1: Monthly Rent

**Setup:**

- Description: "Najam ureda"
- Vendor: "Poslovna Zgrada d.o.o."
- Category: RENT
- Amount: €1,000 + €250 VAT = €1,250
- Frequency: MONTHLY
- Start: 2025-01-01
- End: None (indefinite)

**Behavior:**

- Generates expense on 1st of each month
- Continues until manually stopped

### Example 2: Quarterly Insurance

**Setup:**

- Description: "Poslovno osiguranje"
- Vendor: "Croatia Osiguranje"
- Category: INSURANCE
- Amount: €300 (no VAT)
- Frequency: QUARTERLY
- Start: 2025-03-15
- End: 2026-03-15 (1 year contract)

**Behavior:**

- Generates on: Mar 15, Jun 15, Sep 15, Dec 15, Mar 15
- Automatically stops after Mar 15, 2026

### Example 3: Weekly Subscription

**Setup:**

- Description: "SaaS alat pretplata"
- Vendor: None
- Category: SERVICES
- Amount: €50 + €12.50 VAT = €62.50
- Frequency: WEEKLY
- Start: 2025-01-06 (Monday)
- End: None

**Behavior:**

- Generates every Monday
- User can review and approve each week

## Implementation Checklist

- [x] Database schema created → `prisma/schema.prisma:392-411`
- [x] Migration applied → `prisma/migrations/20251211_add_expenses/migration.sql`
- [x] Tenant isolation configured → `src/lib/prisma-extensions.ts:68,87`
- [ ] Server actions for CRUD operations
- [ ] Date calculation utility functions
- [ ] Cron job endpoint at `/api/cron/recurring-expenses`
- [ ] Vercel cron configuration in `vercel.json`
- [ ] UI list view at `/settings/recurring-expenses`
- [ ] UI create/edit form
- [ ] Pause/resume functionality
- [ ] Error notifications and logging
- [ ] E2E tests for generation logic

## Dependencies

- **Depends on**:
  - [[auth-login]] - User authentication required
  - [[company-management]] - Company context required
  - [[expenses-create]] - Uses expense creation logic
  - [[expenses-categories]] - Requires category configuration

- **Depended by**:
  - [[reports-expenses]] - Recurring expenses included in reports
  - [[dashboard-quick-stats]] - May show recurring expense summary
  - [[audit-log]] - Tracks recurring expense changes

## Evidence Links

1. `prisma/schema.prisma:392-411` - RecurringExpense model definition
2. `prisma/schema.prisma:848-853` - Frequency enum (WEEKLY/MONTHLY/QUARTERLY/YEARLY)
3. `prisma/schema.prisma:409-410` - Indexes for companyId and nextDate
4. `prisma/migrations/20251211_add_expenses/migration.sql:50-67` - Migration creating RecurringExpense table
5. `src/lib/prisma-extensions.ts:68` - Tenant isolation for RecurringExpense
6. `src/lib/prisma-extensions.ts:87` - Audit logging for RecurringExpense
7. `src/app/actions/expense.ts:33-93` - createExpense action used for generation
8. `vercel.json:1-12` - Example cron configuration pattern
9. `docs/plans/2025-12-11-remaining-modules-design.md:346-388` - Original design specification
