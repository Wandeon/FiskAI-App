# Feature: F085 - Create Support Ticket

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 26
- Complexity: Medium

## Purpose

Create Support Ticket enables users to open support tickets directly within FiskAI, facilitating seamless communication between clients and accountants without leaving the application. Users can describe their issue, set priority levels, and track the ticket through its lifecycle. This feature eliminates the need for external email or ticketing systems and keeps all financial support communication within the secure, tenant-isolated FiskAI environment.

## User Entry Points

| Type      | Path     | Evidence                                           |
| --------- | -------- | -------------------------------------------------- |
| Page      | /support | `src/app/(dashboard)/support/page.tsx:25`          |
| Component | Header   | `src/components/layout/header-actions.tsx:229-236` |
| Nav Menu  | Sidebar  | `src/lib/navigation.ts:60`                         |

## Core Flow

1. User navigates to Support page via navigation menu or header user menu → `src/lib/navigation.ts:60`, `src/components/layout/header-actions.tsx:230`
2. Support page loads with two-column layout: ticket list (left) and create form (right) → `src/app/(dashboard)/support/page.tsx:58-111`
3. User fills out the create ticket form with title, description, and priority → `src/components/support/create-support-ticket-form.tsx:50-89`
4. Form validates required fields (title minimum 3 characters) → `src/app/actions/support-ticket.ts:21`
5. On submit, form sends POST request to `/api/support/tickets` → `src/components/support/create-support-ticket-form.tsx:20-30`
6. API validates input using Zod schema → `src/app/api/support/tickets/route.ts:7-11`
7. System creates ticket in database with OPEN status and NORMAL default priority → `src/app/api/support/tickets/route.ts:70-78`
8. Success toast confirms ticket creation → `src/components/support/create-support-ticket-form.tsx:39`
9. Form clears for next ticket → `src/components/support/create-support-ticket-form.tsx:40-42`
10. Ticket appears in the list for the user to view and track → `src/app/(dashboard)/support/page.tsx:76-97`

## Key Modules

| Module                    | Purpose                                           | Location                                                |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| CreateSupportTicketForm   | Client form component for creating tickets        | `src/components/support/create-support-ticket-form.tsx` |
| SupportPage               | Main support dashboard with list and create form  | `src/app/(dashboard)/support/page.tsx`                  |
| POST /api/support/tickets | API endpoint to create new tickets                | `src/app/api/support/tickets/route.ts`                  |
| createSupportTicket       | Server action for ticket creation with validation | `src/app/actions/support-ticket.ts:84-126`              |
| SupportTicketDetailPage   | Individual ticket view with messages and actions  | `src/app/(dashboard)/support/[id]/page.tsx`             |
| SupportReplyForm          | Form component for adding messages to tickets     | `src/components/support/support-reply-form.tsx`         |

## Data

**Tables**: `SupportTicket`, `SupportTicketMessage`

**SupportTicket Schema** (`prisma/schema.prisma:741-758`):

```prisma
model SupportTicket {
  id           String                 @id @default(cuid())
  companyId    String
  createdById  String?
  assignedToId String?
  title        String
  body         String?
  status       SupportTicketStatus    @default(OPEN)
  priority     SupportTicketPriority  @default(NORMAL)
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt
  company      Company                @relation(fields: [companyId], references: [id], onDelete: Cascade)
  messages     SupportTicketMessage[]
}
```

**SupportTicketMessage Schema** (`prisma/schema.prisma:760-769`):

```prisma
model SupportTicketMessage {
  id        String        @id @default(cuid())
  ticketId  String
  authorId  String?
  body      String
  createdAt DateTime      @default(now())
  ticket    SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
}
```

**Enums**:

- `SupportTicketStatus`: OPEN, IN_PROGRESS, RESOLVED, CLOSED → `prisma/schema.prisma:920-925`
- `SupportTicketPriority`: LOW, NORMAL, HIGH, URGENT → `prisma/schema.prisma:927-932`

## Validation Rules

| Field       | Rules                                              | Evidence                                  |
| ----------- | -------------------------------------------------- | ----------------------------------------- |
| title       | Required, min 3 chars, max 200 chars               | `src/app/actions/support-ticket.ts:21`    |
| body        | Optional, max 5000 chars                           | `src/app/actions/support-ticket.ts:22`    |
| priority    | Enum: LOW, NORMAL, HIGH, URGENT (default: NORMAL)  | `src/app/actions/support-ticket.ts:23`    |
| status      | Auto-set to OPEN on creation                       | `src/app/actions/support-ticket.ts:98`    |
| companyId   | Auto-populated from current user's company context | `src/app/api/support/tickets/route.ts:72` |
| createdById | Auto-populated from current authenticated user     | `src/app/api/support/tickets/route.ts:73` |

## Form Fields

### Title Field

- **Type**: Text input
- **Label**: "Naslov" (Title)
- **Placeholder**: "Npr. Trebam pomoć oko PDV evidencije" (e.g., I need help with VAT records)
- **Required**: Yes
- **Evidence**: `src/components/support/create-support-ticket-form.tsx:52-59`

### Description Field

- **Type**: Textarea (4 rows)
- **Label**: "Opis" (Description)
- **Placeholder**: "Dodajte detalje i eventualne rokove..." (Add details and any deadlines...)
- **Required**: No
- **Evidence**: `src/components/support/create-support-ticket-form.tsx:62-70`

### Priority Field

- **Type**: Select dropdown
- **Label**: "Prioritet" (Priority)
- **Options**:
  - Nizak (LOW)
  - Standard (NORMAL) - default
  - Visok (HIGH)
  - Hitno (URGENT)
- **Evidence**: `src/components/support/create-support-ticket-form.tsx:72-85`

### Submit Button

- **Text**: "Otvori tiket" (Open ticket)
- **Pending Text**: "Spremanje..." (Saving...)
- **Full width**: Yes
- **Evidence**: `src/components/support/create-support-ticket-form.tsx:86-88`

## API Endpoints

### POST /api/support/tickets

**Purpose**: Create a new support ticket

**Request Body**:

```typescript
{
  title: string;      // min 3 chars
  body?: string;      // optional
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}
```

**Response**:

```typescript
{
  ticket: {
    id: string
    companyId: string
    createdById: string
    title: string
    body: string | null
    priority: SupportTicketPriority
    status: "OPEN"
    createdAt: Date
    updatedAt: Date
  }
}
```

**Evidence**: `src/app/api/support/tickets/route.ts:52-81`

### GET /api/support/tickets

**Purpose**: Retrieve support tickets for the current company

**Query Params**:

- `status`: Comma-separated status values (default: "OPEN,IN_PROGRESS")

**Response**:

```typescript
{
  tickets: Array<{
    id: string
    title: string
    status: SupportTicketStatus
    priority: SupportTicketPriority
    updatedAt: Date
    assignedTo: { name: string; email: string } | null
    messages: Array<{
      id: string
      body: string
      createdAt: Date
      authorId: string
    }>
  }>
}
```

**Evidence**: `src/app/api/support/tickets/route.ts:13-50`

### GET /api/support/tickets/summary

**Purpose**: Get ticket statistics for accountant dashboard

**Response**:

```typescript
{
  openCount: number
  assignedToMe: number
  unassigned: number
  unread: number
  companyId: string
}
```

**Evidence**: `src/app/api/support/tickets/summary/route.ts:6-56`

## Related Features

### Ticket Detail and Messaging

After creating a ticket, users can:

- View ticket details at `/support/{ticketId}` → `src/app/(dashboard)/support/[id]/page.tsx:30-110`
- Add messages to the ticket thread → `src/components/support/support-reply-form.tsx:7-56`
- View all messages in chronological order → `src/app/(dashboard)/support/[id]/page.tsx:92-102`
- Track ticket status and priority → `src/app/(dashboard)/support/[id]/page.tsx:61-68`

### Ticket Assignment

Accountants can:

- Assign tickets to themselves → `src/components/support/support-assign-button.tsx:7-50`
- Unassign tickets → `src/components/support/support-assign-button.tsx:27`
- See assignment status → `src/app/(dashboard)/support/[id]/page.tsx:65-67`

### Ticket Status Management

Users can:

- Close tickets → `src/components/support/support-status-buttons.tsx:7-42`
- Reopen closed/resolved tickets → `src/components/support/support-status-buttons.tsx:44-79`
- Change status via API → `src/app/api/support/tickets/[id]/status/route.ts:11-46`

## Security & Tenant Isolation

1. **Authentication Required**: All endpoints require authenticated user → `src/app/api/support/tickets/route.ts:14-16`
2. **Company Context**: Tickets are scoped to user's current company → `src/app/api/support/tickets/route.ts:19-21`
3. **Tenant Filtering**: Database queries automatically filter by `companyId` → `src/app/(dashboard)/support/page.tsx:29-30`
4. **Cascade Delete**: Tickets and messages deleted when company is deleted → `prisma/schema.prisma:752-753,766`
5. **Author Tracking**: System records who created each ticket → `src/app/api/support/tickets/route.ts:73`

## Dependencies

- **Depends on**:
  - [[auth-session]] - User must be authenticated to create tickets
  - [[settings-company]] - Requires active company context for tenant isolation
  - Database - Prisma ORM for ticket persistence
  - Zod - Input validation schema
  - Toast notifications - User feedback system

- **Depended by**:
  - Accountant workspace - Shows pending support ticket counts
  - Notifications - May trigger notifications for accountants

## Integrations

### UI Components

- **shadcn/ui**: Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input, Label, Button → `src/app/(dashboard)/support/page.tsx:5-6`
- **Lucide Icons**: MessageCircle, LifeBuoy, HelpCircle → `src/app/(dashboard)/support/page.tsx:9`, `src/lib/navigation.ts:10`

### State Management

- **React useTransition**: Optimistic UI updates during form submission → `src/components/support/create-support-ticket-form.tsx:14`
- **useState**: Form field state management → `src/components/support/create-support-ticket-form.tsx:11-13`

### Data Fetching

- **Server Components**: Support page fetches tickets server-side → `src/app/(dashboard)/support/page.tsx:25`
- **API Routes**: Client-side form submissions via fetch → `src/components/support/create-support-ticket-form.tsx:20`

### Logging

- **Pino Logger**: Structured logging for ticket operations → `src/app/actions/support-ticket.ts:108-113`

## User Experience

### Empty State

When no tickets exist, users see:

- MessageCircle icon
- Title: "Još nema otvorenih tiketa" (No open tickets yet)
- Description: "Koristite obrazac desno za komunikaciju s računovođom..." (Use the form on the right to communicate with your accountant...)
- **Evidence**: `src/app/(dashboard)/support/page.tsx:68-74`

### Success Feedback

- Toast message: "Tiket otvoren" (Ticket opened)
- Description: "Računovođa će odgovoriti unutar aplikacije" (Accountant will respond within the application)
- Form resets to empty state
- **Evidence**: `src/components/support/create-support-ticket-form.tsx:39-42`

### Error Handling

- Invalid data: "Greška - Nije uspjelo kreiranje tiketa" → `src/components/support/create-support-ticket-form.tsx:35`
- Network failure: "Greška - Nije uspjelo slanje zahtjeva" → `src/components/support/create-support-ticket-form.tsx:44`
- Server validation errors returned with details → `src/app/actions/support-ticket.ts:121`

## Navigation Access Points

### Main Navigation

- Section: "Suradnja" (Collaboration)
- Label: "Podrška" (Support)
- Icon: LifeBuoy
- Path: `/support`
- **Evidence**: `src/lib/navigation.ts:56-62`

### User Menu (Header)

- Menu item: "Pomoć i podrška" (Help and Support)
- Icon: HelpCircle
- Path: `/support`
- Position: Above logout, below settings
- **Evidence**: `src/components/layout/header-actions.tsx:229-236`

## Verification Checklist

- [x] User can navigate to /support from sidebar and user menu
- [x] Create ticket form displays with all required fields
- [x] Title field enforces minimum 3 character requirement
- [x] Priority selector shows all 4 options with correct default
- [x] Form submission creates ticket in database
- [x] Ticket auto-assigned to user's company (tenant isolation)
- [x] New ticket appears in ticket list immediately
- [x] Success toast displays with Croatian message
- [x] Form clears after successful submission
- [x] Empty state shows when no tickets exist
- [x] Ticket list shows status, priority, and metadata
- [x] Clicking ticket navigates to detail page
- [x] Error handling shows appropriate messages
- [x] Authentication required for all operations
- [x] Logging captures ticket creation events

## Evidence Links

1. `src/components/support/create-support-ticket-form.tsx:1-91` - Complete create ticket form component
2. `src/app/(dashboard)/support/page.tsx:25-114` - Main support page with list and form
3. `src/app/api/support/tickets/route.ts:52-81` - POST endpoint for ticket creation
4. `src/app/actions/support-ticket.ts:84-126` - Server action with validation and database logic
5. `src/app/actions/support-ticket.ts:20-24` - Zod validation schema for ticket creation
6. `prisma/schema.prisma:741-758` - SupportTicket database model
7. `prisma/schema.prisma:760-769` - SupportTicketMessage database model
8. `src/lib/navigation.ts:60` - Support navigation menu item
9. `src/components/layout/header-actions.tsx:229-236` - Support link in user menu
10. `src/app/(dashboard)/support/[id]/page.tsx:30-110` - Ticket detail page
11. `src/components/support/support-reply-form.tsx:7-56` - Reply form for adding messages
12. `src/components/support/support-status-buttons.tsx:7-79` - Close/reopen ticket buttons
13. `src/components/support/support-assign-button.tsx:7-50` - Ticket assignment button
14. `src/app/api/support/tickets/[id]/messages/route.ts:10-53` - POST endpoint for adding messages
15. `src/app/api/support/tickets/[id]/status/route.ts:11-46` - PATCH endpoint for status updates
16. `src/app/api/support/tickets/summary/route.ts:6-56` - GET endpoint for ticket statistics
17. `src/hooks/use-ticket-summary.ts:10-38` - React hook for polling ticket summary
18. `src/app/(dashboard)/support/page.tsx:11-23` - Status and priority label mappings
19. `src/app/(dashboard)/support/page.tsx:29-46` - Server-side ticket query with filters
20. `src/app/(dashboard)/support/page.tsx:68-74` - Empty state UI component
21. `src/app/(dashboard)/support/page.tsx:76-97` - Ticket list rendering with metadata
22. `src/components/support/create-support-ticket-form.tsx:16-47` - Form submission handler
23. `src/components/support/create-support-ticket-form.tsx:50-89` - Form JSX with all fields
24. `src/app/actions/support-ticket.ts:108-113` - Structured logging for ticket creation
25. `src/app/api/support/tickets/route.ts:13-50` - GET endpoint for retrieving tickets
26. `src/app/api/support/tickets/route.ts:63-65` - Zod validation in API route
