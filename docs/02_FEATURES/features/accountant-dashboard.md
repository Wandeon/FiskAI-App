# Feature: Accountant Dashboard (F096)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 13

## Purpose

The Accountant Dashboard provides a comprehensive workspace for accountants (both internal and external) to manage multiple clients' financial operations from a single interface. This specialized dashboard displays pending work items (invoices awaiting approval, expenses to process, support tickets), key financial metrics (VAT threshold monitoring, monthly revenue), and quick access to essential accounting reports and tools.

## User Entry Points

| Type       | Path                     | Evidence                                          |
| ---------- | ------------------------ | ------------------------------------------------- |
| Page       | /accountant              | `src/app/(dashboard)/accountant/page.tsx:46`      |
| Component  | ActionCards              | `src/components/dashboard/action-cards.tsx:6`     |
| Navigation | Navigation link          | `src/lib/navigation.ts:59`                        |
| Marketing  | Accountants landing page | `src/app/(marketing)/for/accountants/page.tsx:10` |

## Core Flow

### Dashboard Access Flow

1. User navigates to /accountant via navigation or action cards → `src/lib/navigation.ts:59`
2. System validates user authentication → `src/app/(dashboard)/accountant/page.tsx:47`
3. System validates company association → `src/app/(dashboard)/accountant/page.tsx:48`
4. System sets tenant context for isolation → `src/app/(dashboard)/accountant/page.tsx:50-53`
5. System fetches accountant-specific metrics in parallel → `src/app/(dashboard)/accountant/page.tsx:55-124`
6. Dashboard renders with metrics and action items → `src/app/(dashboard)/accountant/page.tsx:126-456`

### Metrics Collection Flow

1. **Pending Invoices Count** → `src/app/(dashboard)/accountant/page.tsx:66-72`
   - Filters: SENT or DELIVERED status
   - Filters: accountantApproved is null (not yet reviewed)
   - Counts invoices awaiting accountant approval

2. **Pending Expenses Count** → `src/app/(dashboard)/accountant/page.tsx:74-80`
   - Filters: APPROVED status (ready for processing)
   - Filters: accountantProcessed is false
   - Counts expenses requiring accountant processing

3. **Pending Support Tickets Count** → `src/app/(dashboard)/accountant/page.tsx:82-88`
   - Filters: Assigned to current user (accountant)
   - Filters: OPEN or IN_PROGRESS status
   - Counts active support requests

4. **Total Invoices Count** → `src/app/(dashboard)/accountant/page.tsx:90-95`
   - Filters: OUTBOUND direction
   - Counts all issued invoices

5. **Total Expenses Count** → `src/app/(dashboard)/accountant/page.tsx:97-101`
   - Counts all expenses for the company

6. **Monthly Revenue** → `src/app/(dashboard)/accountant/page.tsx:103-116`
   - Filters: OUTBOUND, PAID status
   - Filters: Issue date in current month
   - Aggregates totalAmount sum

7. **VAT Threshold Progress** → `src/app/(dashboard)/accountant/page.tsx:118-123`
   - Calls calculateVatThresholdProgress function
   - Calculates annual revenue vs 40,000 EUR threshold
   - Returns percentage, status (BELOW/WARNING/EXCEEDED)

### VAT Threshold Display Flow

1. System displays VAT threshold card → `src/app/(dashboard)/accountant/page.tsx:150-194`
2. Shows current year and 40,000 EUR threshold → `src/app/(dashboard)/accountant/page.tsx:157`
3. Displays progress percentage → `src/app/(dashboard)/accountant/page.tsx:165`
4. Renders progress bar with color coding → `src/app/(dashboard)/accountant/page.tsx:168-177`
   - Red: EXCEEDED status
   - Amber: WARNING status
   - Blue: BELOW status
5. Shows amounts (current vs threshold) → `src/app/(dashboard)/accountant/page.tsx:178-181`
6. Displays status badge → `src/app/(dashboard)/accountant/page.tsx:182-191`

### Metrics Cards Display Flow

1. System renders 4 metric cards in grid → `src/app/(dashboard)/accountant/page.tsx:197-245`
2. **Pending Invoices Card** → `src/app/(dashboard)/accountant/page.tsx:198-207`
   - Icon: FileText
   - Count: pendingInvoices
   - Description: "Čeka na odobrenje"
3. **Pending Expenses Card** → `src/app/(dashboard)/accountant/page.tsx:209-218`
   - Icon: Receipt
   - Count: pendingExpenses
   - Description: "Čeka na obradu"
4. **Open Tickets Card** → `src/app/(dashboard)/accountant/page.tsx:220-229`
   - Icon: Mail
   - Count: pendingTickets
   - Description: "Dodeljene računovodstvu"
5. **Monthly Revenue Card** → `src/app/(dashboard)/accountant/page.tsx:231-244`
   - Icon: TrendingUp
   - Amount: Formatted currency
   - Period: Current month/year in Croatian

### Pending Activities Section Flow

1. System renders pending activities card → `src/app/(dashboard)/accountant/page.tsx:249-335`
2. Displays 4 activity categories with counts → `src/app/(dashboard)/accountant/page.tsx:258-318`
   - Invoices for approval (blue badge)
   - Expenses for processing (green badge)
   - Accountant support tickets (purple badge)
   - Reminders (amber badge, hardcoded as 12)
3. Provides action buttons → `src/app/(dashboard)/accountant/page.tsx:320-333`
   - "Pregledaj račune" → Links to /e-invoices?status=DELIVERED
   - "Obradi troškove" → Links to /expenses?status=APPROVED

### Quick Reports Section Flow

1. System renders quick reports card → `src/app/(dashboard)/accountant/page.tsx:338-389`
2. Displays 5 commonly used reports → `src/app/(dashboard)/accountant/page.tsx:347-378`
   - KPR (Knjiga Prometa) → /reports/kpr
   - PO-SD Prijava → /reports/posd
   - PDV Izvješće → /reports/vat
   - Arhivski paket → /reports/export
   - Starost obveznice → /reports/aging
3. Provides "Svi izvještaji" link → `src/app/(dashboard)/accountant/page.tsx:381-386`

### Important Links Section Flow

1. System renders 3 linked cards in grid → `src/app/(dashboard)/accountant/page.tsx:393-453`
2. **E-fakture Card** → `src/app/(dashboard)/accountant/page.tsx:394-412`
   - Shows total invoices count
   - Shows pending invoices badge
   - Links to /e-invoices
3. **Troškovi Card** → `src/app/(dashboard)/accountant/page.tsx:414-432`
   - Shows total expenses count
   - Shows pending expenses badge
   - Links to /expenses
4. **Sigurnost Card** → `src/app/(dashboard)/accountant/page.tsx:434-452`
   - Security and access management
   - Links to /settings

## Key Modules

| Module                  | Purpose                                   | Location                                     |
| ----------------------- | ----------------------------------------- | -------------------------------------------- |
| AccountantDashboardPage | Main dashboard page component             | `src/app/(dashboard)/accountant/page.tsx`    |
| ActionCards             | Dashboard entry cards                     | `src/components/dashboard/action-cards.tsx`  |
| kpr-generator           | VAT threshold calculation utility         | `src/lib/reports/kpr-generator.ts`           |
| Navigation              | Navigation structure with accountant link | `src/lib/navigation.ts`                      |
| CompanySwitcher         | Multi-client company switcher             | `src/components/layout/company-switcher.tsx` |
| RBAC                    | Role-based access control                 | `src/lib/rbac.ts`                            |

## Dashboard Sections

### 1. Header Section

**Location** → `src/app/(dashboard)/accountant/page.tsx:128-147`

**Content**:

- Title: "Radni prostor računovodstva"
- Description: Complete overview and tools for working with invoices, expenses, and tax documentation
- Action buttons:
  - "Izvoz" (Export) button → Download icon
  - "Izvještaji" (Reports) button → Links to /reports?tab=kpr

### 2. VAT Threshold Progress Card

**Location** → `src/app/(dashboard)/accountant/page.tsx:150-194`

**Features**:

- Annual revenue tracking vs 40,000 EUR threshold
- Visual progress bar with color-coded status
- Percentage calculation
- Status badge (ISPRAVNO/POZOR/PREKORAČENO)
- Current year display

**Data Source** → `src/lib/reports/kpr-generator.ts:calculateVatThresholdProgress`

### 3. Metrics Cards Grid

**Location** → `src/app/(dashboard)/accountant/page.tsx:197-245`

**4 Cards Layout**:

1. Pending invoices count
2. Pending expenses count
3. Open support tickets count
4. Monthly revenue amount

**Styling**:

- Responsive grid: 1 column mobile, 4 columns desktop
- Card header with icon and title
- Large number display
- Descriptive subtitle

### 4. Pending Activities Card

**Location** → `src/app/(dashboard)/accountant/page.tsx:249-335`

**Activities Tracked**:

1. **Invoices for Approval**
   - Count: pendingInvoices
   - Icon: FileText (blue)
   - Description: User-issued invoices requiring accountant confirmation

2. **Expenses for Processing**
   - Count: pendingExpenses
   - Icon: Receipt (green)
   - Description: User-entered expenses requiring processing and categorization

3. **Accountant Support Tickets**
   - Count: pendingTickets
   - Icon: Mail (purple)
   - Description: User requests for help or information

4. **Reminders**
   - Count: Hardcoded as 12
   - Icon: AlertTriangle (amber)
   - Description: Overdue invoices, expenses, or pending activities

**Action Buttons**:

- "Pregledaj račune" → /e-invoices?status=DELIVERED
- "Obradi troškove" → /expenses?status=APPROVED

### 5. Quick Reports Card

**Location** → `src/app/(dashboard)/accountant/page.tsx:338-389`

**5 Report Shortcuts**:

1. KPR (Knjiga Prometa) → /reports/kpr
2. PO-SD Prijava → /reports/posd
3. PDV Izvješće → /reports/vat
4. Arhivski paket → /reports/export
5. Starost obveznice → /reports/aging

**Navigation**:

- Each report as outline button with icon
- "Svi izvještaji" link at bottom

### 6. Important Links Grid

**Location** → `src/app/(dashboard)/accountant/page.tsx:393-453`

**3 Hover Cards**:

1. **E-fakture** (E-Invoices)
   - Total count display
   - Pending count badge
   - Icon: FileText (blue)

2. **Troškovi** (Expenses)
   - Total count display
   - Pending count badge
   - Icon: Receipt (green)

3. **Sigurnost** (Security)
   - Access management
   - Status: "Konfigurirano"
   - Icon: Shield (purple)

## Multi-Client Support

### Company Switcher Integration

**Component** → `src/components/layout/company-switcher.tsx:14-89`

**Features**:

- Dropdown selector for multiple companies
- Displays company name and OIB
- Current company highlighted
- Switches context without page reload

**Workflow**:

1. Accountant associated with multiple companies via CompanyUser table
2. User clicks company switcher in header
3. Selects different client company
4. System calls switchCompany action
5. Dashboard reloads with new company context

### Role-Based Access

**RBAC Configuration** → `src/lib/rbac.ts`

**Accountant Role Permissions**:

- invoice:read - Can view all invoices
- expense:read - Can view all expenses
- contact:read - Can view contacts
- product:read - Can view products
- settings:read - Can view company settings
- reports:read - Can view all reports
- reports:export - Can export data

**Restricted Permissions**:

- Cannot create/update/delete without OWNER/ADMIN role
- Read-only access for safety
- Cannot manage billing (OWNER only)

## Database Schema

### CompanyUser Model (Multi-Client Association)

**Relevant Fields** → `prisma/schema.prisma:131-145`

- id: String (CUID)
- userId: String (accountant user ID)
- companyId: String (client company ID)
- role: Role (ACCOUNTANT role for external accountants)
- isDefault: Boolean (default company to show)
- createdAt: DateTime
- notificationSeenAt: DateTime (nullable)

**Relations**:

- user: User (accountant)
- company: Company (client)

**Indexes**:

- userId for fast user queries
- companyId for fast company queries
- Unique constraint on userId + companyId

### Support Ticket Assignment

**Relevant Fields** → `prisma/schema.prisma` (SupportTicket model)

- assignedToId: String (nullable) - Can assign tickets to accountants
- status: TicketStatus (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
- Used in pending tickets query → `src/app/(dashboard)/accountant/page.tsx:82-88`

### Invoice Accountant Fields

**Relevant Fields** → `prisma/schema.prisma:191-259` (EInvoice model)

- accountantApproved: Boolean (nullable)
  - null = Not yet reviewed by accountant
  - false = Rejected by accountant
  - true = Approved by accountant
- Used in pending invoices query → `src/app/(dashboard)/accountant/page.tsx:70`

### Expense Accountant Fields

**Relevant Fields** → `prisma/schema.prisma` (Expense model)

- accountantProcessed: Boolean (default false)
  - false = Not yet processed by accountant
  - true = Processed and categorized by accountant
- Used in pending expenses query → `src/app/(dashboard)/accountant/page.tsx:78`

## Navigation Integration

### Main Navigation Link

**Configuration** → `src/lib/navigation.ts:59`

**Section**: Suradnja (Collaboration)

**Nav Item**:

- name: "Računovođa"
- href: "/accountant"
- icon: UserCog
- No badge or children
- No module restriction

### Action Cards Entry Point

**Component** → `src/components/dashboard/action-cards.tsx:27-43`

**Card Display**:

- Title: "Workspace za računovođu"
- Description: External accountant works directly in FiskAI without exporting
- Icon: UserCog (emerald)
- Button: "Otvori workspace" → Links to /accountant

**Visibility**:

- Shown on main dashboard → `src/app/(dashboard)/dashboard/page.tsx:7`
- Available to all authenticated users
- Promotes accountant collaboration feature

## Accountant Marketing

### Landing Page

**Location** → `src/app/(marketing)/for/accountants/page.tsx:10-417`

**Target Audience**: Professional accountants and accounting firms

**Key Messages**:

1. **70% Less Processing Time** → `src/app/(marketing)/for/accountants/page.tsx:51`
   - Clean exports instead of photo receipts
   - Automated workflows

2. **Free Access for Accountants** → `src/app/(marketing)/for/accountants/page.tsx:124`
   - Unlimited clients
   - Access to all exports and reports
   - Communication platform

3. **Multi-Client Management** → `src/app/(marketing)/for/accountants/page.tsx:128`
   - View all clients in one place
   - Platform communication
   - Change notifications

**Features Highlighted**:

- Clean data exports (CSV/Excel with attachments)
- Direct client access
- Reports and analytics
- Security and control (GDPR compliant)
- E-invoicing and fiscalization support
- Office efficiency (scalability without hiring)

**Pricing** → `src/app/(marketing)/for/accountants/page.tsx:257-303`

- 0 EUR forever for certified accountants
- Unlimited clients
- Full access to exports and reports
- Dedicated account manager for offices

### Client Onboarding Process

**Steps** → `src/app/(marketing)/for/accountants/page.tsx:307-330`

1. **Registration** - Free accountant account
2. **Invite Clients** - Send invitations from app
3. **Client Uses FiskAI** - Issues invoices, scans expenses
4. **Receive Export** - Automatic or on-demand

## Validation

### Authentication

**Required** → `src/app/(dashboard)/accountant/page.tsx:47`

- User must be authenticated via requireAuth()
- Redirects to login if not authenticated

### Company Association

**Required** → `src/app/(dashboard)/accountant/page.tsx:48`

- User must have company association via requireCompany()
- Returns 404 if no company found
- Uses user.id to lookup CompanyUser relationship

### Tenant Context

**Isolation** → `src/app/(dashboard)/accountant/page.tsx:50-53`

- setTenantContext with companyId and userId
- All queries scoped to current company
- Prevents cross-company data leakage
- Essential for multi-client security

## Error Handling

### Authentication Failure

- requireAuth throws error if no session
- User redirected to /login
- Session validated via NextAuth

### Company Not Found

- requireCompany throws error if no CompanyUser
- 404 response returned
- User should not have access to /accountant without company

### VAT Threshold Calculation Error

- Wrapped in .catch() with default values → `src/app/(dashboard)/accountant/page.tsx:118-123`
- Returns safe defaults:
  - annualRevenue: 0
  - vatThreshold: 40000
  - percentage: 0
  - status: "BELOW"
- Prevents dashboard crash on calculation errors

## Performance Considerations

### Parallel Data Fetching

**Implementation** → `src/app/(dashboard)/accountant/page.tsx:55-124`

- Uses Promise.all for 7 parallel queries
- Reduces total load time significantly
- Queries are independent and non-blocking

**Queries**:

1. Pending invoices count
2. Pending expenses count
3. Pending tickets count
4. Total invoices count
5. Total expenses count
6. Monthly revenue aggregate
7. VAT threshold calculation

### Query Optimization

**Efficient Counting**:

- Uses db.count() instead of findMany for counts
- Minimal field selection for aggregates
- Indexes on status, companyId fields

**Aggregation**:

- Uses db.aggregate for revenue sum
- Single query for monthly revenue
- Efficient \_sum operation on totalAmount

## Dependencies

**Depends on**:

- [[auth-login]] - User authentication required → `src/app/(dashboard)/accountant/page.tsx:47`
- [[settings-company-switcher]] - Multi-client switching → `src/components/layout/company-switcher.tsx`
- [[reports-vat-threshold]] - VAT threshold calculation → `src/app/(dashboard)/accountant/page.tsx:118`
- [[e-invoicing-view]] - Pending invoices data → `src/app/(dashboard)/accountant/page.tsx:66`
- [[expenses-view]] - Pending expenses data → `src/app/(dashboard)/accountant/page.tsx:74`
- [[support-view]] - Pending tickets data → `src/app/(dashboard)/accountant/page.tsx:82`

**Depended by**:

- [[dashboard-action-cards]] - Entry point from main dashboard → `src/components/dashboard/action-cards.tsx:27`
- [[reports-accountant-export]] - Export functionality linked → `src/app/(dashboard)/accountant/page.tsx:367`

## Integrations

### VAT Threshold Calculation

**Function**: calculateVatThresholdProgress

**Integration** → `src/app/(dashboard)/accountant/page.tsx:118`

**Purpose**:

- Monitors Croatian VAT registration threshold (40,000 EUR)
- Calculates annual revenue progress
- Returns status and percentage

### Report Exports

**Integration Points**:

- KPR Report → /reports/kpr
- VAT Report → /reports/vat
- Export Package → /reports/export
- Accountant Export API → /api/reports/accountant-export

### Support System

**Integration** → `src/app/(dashboard)/accountant/page.tsx:82-88`

**Features**:

- Queries tickets assigned to accountant
- Filters by OPEN/IN_PROGRESS status
- Displays pending ticket count
- Links to support system

## Verification Checklist

- [ ] User can access /accountant page with authentication
- [ ] Authentication required (redirects to /login if not authenticated)
- [ ] Company association required (404 if no company)
- [ ] Tenant context properly set for data isolation
- [ ] VAT threshold card displays correctly with current year
- [ ] Progress bar shows correct color for status (blue/amber/red)
- [ ] Pending invoices count shows SENT/DELIVERED with accountantApproved null
- [ ] Pending expenses count shows APPROVED with accountantProcessed false
- [ ] Pending tickets count shows assigned to user with OPEN/IN_PROGRESS status
- [ ] Monthly revenue displays current month total
- [ ] All 7 parallel queries execute successfully
- [ ] Quick reports section links to correct report pages
- [ ] "Pregledaj račune" links to /e-invoices?status=DELIVERED
- [ ] "Obradi troškove" links to /expenses?status=APPROVED
- [ ] Important links show correct counts and badges
- [ ] Action cards on main dashboard link to /accountant
- [ ] Navigation includes "Računovođa" link in Suradnja section
- [ ] Company switcher allows accountant to switch between clients
- [ ] Multi-client companies display in switcher dropdown
- [ ] ACCOUNTANT role has read access to all financial data
- [ ] ACCOUNTANT role cannot create/update/delete without higher privileges
- [ ] Marketing page promotes free accountant access
- [ ] VAT threshold error handling returns safe defaults
- [ ] All icons display correctly (FileText, Receipt, Mail, etc.)
- [ ] Responsive layout works on mobile and desktop

## Evidence Links

1. Accountant dashboard page entry point → `src/app/(dashboard)/accountant/page.tsx:46`
2. Authentication and company validation → `src/app/(dashboard)/accountant/page.tsx:47-48`
3. Tenant context setup → `src/app/(dashboard)/accountant/page.tsx:50-53`
4. Parallel metrics fetching → `src/app/(dashboard)/accountant/page.tsx:55-124`
5. VAT threshold progress display → `src/app/(dashboard)/accountant/page.tsx:150-194`
6. Pending activities section → `src/app/(dashboard)/accountant/page.tsx:249-335`
7. Quick reports section → `src/app/(dashboard)/accountant/page.tsx:338-389`
8. Action cards entry point → `src/components/dashboard/action-cards.tsx:27-43`
9. Navigation link configuration → `src/lib/navigation.ts:59`
10. Company switcher for multi-client → `src/components/layout/company-switcher.tsx:14-89`
11. RBAC accountant permissions → `src/lib/rbac.ts:16-50`
12. Accountants marketing page → `src/app/(marketing)/for/accountants/page.tsx:10`
13. CompanyUser multi-client schema → `prisma/schema.prisma:131-145`
