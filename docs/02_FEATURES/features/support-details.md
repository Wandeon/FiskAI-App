# Feature: Support Ticket Details

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 13

## Purpose

The Support Ticket Details page (`/support/:id`) provides a comprehensive view of individual support tickets with full conversation history. Users can view ticket metadata (status, priority, assignment), read all messages chronologically, reply to tickets, manage ticket status (close/reopen), and assign/unassign tickets to themselves. This creates a self-contained communication channel between business users and their accountants without requiring external email or communication tools.

## User Entry Points

| Type         | Path          | Evidence                                      |
| ------------ | ------------- | --------------------------------------------- |
| Page         | /support/:id  | `src/app/(dashboard)/support/[id]/page.tsx:1` |
| Link         | Support list  | `src/app/(dashboard)/support/page.tsx:79`     |
| Notification | Ticket alerts | `src/lib/notifications.ts:321`                |

## Core Flow

1. User navigates to ticket detail page from support list → `src/app/(dashboard)/support/page.tsx:77-79`
2. System authenticates user and fetches company → `src/app/(dashboard)/support/[id]/page.tsx:31-32`
3. System loads ticket with full conversation history → `src/app/(dashboard)/support/[id]/page.tsx:34-44`
4. If ticket not found or belongs to different company → redirect to /support → `src/app/(dashboard)/support/[id]/page.tsx:46-48`
5. Page displays ticket header with breadcrumb navigation → `src/app/(dashboard)/support/[id]/page.tsx:52-60`
6. Page shows ticket metadata: status badge, priority badge, creator, assignee → `src/app/(dashboard)/support/[id]/page.tsx:61-68`
7. Action buttons displayed: Assign/Unassign, Close/Reopen → `src/app/(dashboard)/support/[id]/page.tsx:69-80`
8. Messages card shows all conversation messages chronologically → `src/app/(dashboard)/support/[id]/page.tsx:83-103`
9. Reply form at bottom allows adding new messages → `src/app/(dashboard)/support/[id]/page.tsx:105`
10. On reply submission → POST to `/api/support/tickets/:id/messages` → `src/components/support/support-reply-form.tsx:15`
11. On status change → PATCH to `/api/support/tickets/:id/status` → `src/components/support/support-status-buttons.tsx:17,54`
12. On assign/unassign → PATCH to `/api/support/tickets/:id/assign` → `src/components/support/support-assign-button.tsx:21`

## Key Modules

| Module                    | Purpose                                          | Location                                                  |
| ------------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| SupportDetailPage         | Main ticket detail page with conversation view   | `src/app/(dashboard)/support/[id]/page.tsx`               |
| SupportReplyForm          | Form component for adding message replies        | `src/components/support/support-reply-form.tsx`           |
| CloseSupportTicketButton  | Button to close open tickets                     | `src/components/support/support-status-buttons.tsx:7-42`  |
| ReopenSupportTicketButton | Button to reopen closed/resolved tickets         | `src/components/support/support-status-buttons.tsx:44-79` |
| AssignSupportTicketButton | Button to assign/unassign ticket to current user | `src/components/support/support-assign-button.tsx`        |
| MessagesAPI               | POST endpoint for creating new messages          | `src/app/api/support/tickets/[id]/messages/route.ts`      |
| StatusAPI                 | PATCH endpoint for updating ticket status        | `src/app/api/support/tickets/[id]/status/route.ts`        |

## Current Implementation

### Page Structure

The ticket detail page is organized into three main sections:

#### 1. Header Section → `src/app/(dashboard)/support/[id]/page.tsx:52-81`

**Breadcrumb Navigation**

- Shows "Support / [Ticket Title]" → `src/app/(dashboard)/support/[id]/page.tsx:53-59`
- Support link navigates back to ticket list → `src/app/(dashboard)/support/[id]/page.tsx:54`

**Ticket Title**

- H1 heading displays ticket title → `src/app/(dashboard)/support/[id]/page.tsx:60`

**Metadata Badges**

- Status badge with Croatian labels → `src/app/(dashboard)/support/[id]/page.tsx:62`
  - OPEN: "Otvoren"
  - IN_PROGRESS: "U tijeku"
  - RESOLVED: "Riješen"
  - CLOSED: "Zatvoren" → `src/app/(dashboard)/support/[id]/page.tsx:16-21`
- Priority badge with Croatian labels → `src/app/(dashboard)/support/[id]/page.tsx:63`
  - LOW: "Nizak prioritet"
  - NORMAL: "Standard"
  - HIGH: "Visok"
  - URGENT: "Hitno" → `src/app/(dashboard)/support/[id]/page.tsx:23-28`
- Creator name/email → `src/app/(dashboard)/support/[id]/page.tsx:64`
- Assignee name/email or "Nije dodijeljeno" → `src/app/(dashboard)/support/[id]/page.tsx:65-67`

**Action Buttons**

- Assign/Unassign button → `src/app/(dashboard)/support/[id]/page.tsx:70-74`
  - Shows "Preuzmi tiket" if unassigned → `src/components/support/support-assign-button.tsx:47`
  - Shows "Makni dodjelu" if assigned → `src/components/support/support-assign-button.tsx:47`
- Close/Reopen button (conditional) → `src/app/(dashboard)/support/[id]/page.tsx:75-79`
  - Shows "Ponovno otvori" for CLOSED/RESOLVED tickets → `src/components/support/support-status-buttons.tsx:76`
  - Shows "Zatvori tiket" for open tickets → `src/components/support/support-status-buttons.tsx:39`

#### 2. Messages Card → `src/app/(dashboard)/support/[id]/page.tsx:83-107`

**Card Header**

- Title: "Poruke" → `src/app/(dashboard)/support/[id]/page.tsx:85`
- Description: "Razgovor ostaje unutar aplikacije." → `src/app/(dashboard)/support/[id]/page.tsx:86`

**Message Display**

- Empty state: "Još nema poruka." → `src/app/(dashboard)/support/[id]/page.tsx:90`
- Messages ordered chronologically (oldest first) → `src/app/(dashboard)/support/[id]/page.tsx:38`
- Each message shows:
  - Author name/email → `src/app/(dashboard)/support/[id]/page.tsx:96`
  - Timestamp in Croatian format (hr-HR) → `src/app/(dashboard)/support/[id]/page.tsx:97`
  - Message body with preserved whitespace → `src/app/(dashboard)/support/[id]/page.tsx:99`
- Message styling: rounded border box with muted background → `src/app/(dashboard)/support/[id]/page.tsx:94`

**Reply Form**

- Always visible at bottom of messages card → `src/app/(dashboard)/support/[id]/page.tsx:105`
- Textarea with 4 rows → `src/components/support/support-reply-form.tsx:42-47`
- Placeholder: "Upišite odgovor računovođi..." → `src/components/support/support-reply-form.tsx:45`
- Submit button: "Pošalji odgovor" / "Slanje..." → `src/components/support/support-reply-form.tsx:51`

### API Endpoints

#### POST /api/support/tickets/:id/messages

**Purpose**: Create new message on ticket → `src/app/api/support/tickets/[id]/messages/route.ts:10-53`

**Request Body**:

```json
{
  "body": "string (min 1 char required)"
}
```

→ `src/app/api/support/tickets/[id]/messages/route.ts:6-8`

**Process**:

1. Verify user authentication → `src/app/api/support/tickets/[id]/messages/route.ts:15-18`
2. Get user's company → `src/app/api/support/tickets/[id]/messages/route.ts:20-23`
3. Verify ticket exists and belongs to company → `src/app/api/support/tickets/[id]/messages/route.ts:25-32`
4. Validate message body → `src/app/api/support/tickets/[id]/messages/route.ts:34-37`
5. Create message record → `src/app/api/support/tickets/[id]/messages/route.ts:39-45`
6. Update ticket's updatedAt timestamp → `src/app/api/support/tickets/[id]/messages/route.ts:47-50`
7. Return created message → `src/app/api/support/tickets/[id]/messages/route.ts:52`

**Success Toast**: "Poruka poslana" - "Odgovor primljen od računovodstva" → `src/components/support/support-reply-form.tsx:32`

#### PATCH /api/support/tickets/:id/status

**Purpose**: Update ticket status (close/reopen) → `src/app/api/support/tickets/[id]/status/route.ts:11-46`

**Request Body**:

```json
{
  "status": "OPEN | IN_PROGRESS | RESOLVED | CLOSED"
}
```

→ `src/app/api/support/tickets/[id]/status/route.ts:7-9`

**Process**:

1. Verify user authentication → `src/app/api/support/tickets/[id]/status/route.ts:16-19`
2. Get user's company → `src/app/api/support/tickets/[id]/status/route.ts:21-24`
3. Verify ticket exists and belongs to company → `src/app/api/support/tickets/[id]/status/route.ts:26-33`
4. Validate status enum value → `src/app/api/support/tickets/[id]/status/route.ts:35-38`
5. Update ticket status → `src/app/api/support/tickets/[id]/status/route.ts:40-43`
6. Return updated ticket → `src/app/api/support/tickets/[id]/status/route.ts:45`

**Success Toasts**:

- Close: "Tiket zatvoren" - "Zatvoreno od strane računovodstva" → `src/components/support/support-status-buttons.tsx:32`
- Reopen: "Tiket ponovno otvoren" - "Otvoreno od strane računovodstva" → `src/components/support/support-status-buttons.tsx:69`

### Component Interactions

#### SupportReplyForm

**State Management** → `src/components/support/support-reply-form.tsx:8-9`

- `body`: textarea content state
- `pending`: submission loading state via useTransition

**Submission Flow** → `src/components/support/support-reply-form.tsx:11-38`

1. Prevent default form submission
2. Start transition (sets pending state)
3. POST to `/api/support/tickets/${ticketId}/messages` with trimmed body
4. On success: show success toast, clear textarea, trigger page refresh
5. On error: show error toast with server message or generic error

**Validation**:

- Body is trimmed before submission → `src/components/support/support-reply-form.tsx:21`
- No explicit client-side minimum length (validated server-side)

#### Status Buttons

**CloseSupportTicketButton** → `src/components/support/support-status-buttons.tsx:7-42`

- Displayed when status is OPEN or IN_PROGRESS → `src/app/(dashboard)/support/[id]/page.tsx:75-78`
- On click: PATCH with `{ status: 'CLOSED' }` → `src/components/support/support-status-buttons.tsx:22`
- Uses useTransition for optimistic UI updates
- Disabled during pending state

**ReopenSupportTicketButton** → `src/components/support/support-status-buttons.tsx:44-79`

- Displayed when status is CLOSED or RESOLVED → `src/app/(dashboard)/support/[id]/page.tsx:75-76`
- On click: PATCH with `{ status: 'OPEN' }` → `src/components/support/support-status-buttons.tsx:59`
- Uses same pattern as close button

#### AssignSupportTicketButton

**Props** → `src/components/support/support-assign-button.tsx:7-15`

- `ticketId`: Ticket to assign/unassign
- `currentAssigneeId`: Currently assigned user ID (null if unassigned)
- `currentUserId`: Current authenticated user ID

**Assignment Logic** → `src/components/support/support-assign-button.tsx:18-43`

- If currently assigned: send `{ userId: null }` to unassign → `src/components/support/support-assign-button.tsx:27`
- If unassigned: send `{ userId: currentUserId }` to assign → `src/components/support/support-assign-button.tsx:27`
- Button text changes based on state → `src/components/support/support-assign-button.tsx:47`

**Note**: Assign endpoint appears to be referenced but not found in source:

- Referenced at `/api/support/tickets/:id/assign` → `src/components/support/support-assign-button.tsx:21`
- Not listed in API endpoints inventory → `docs/_meta/inventory/api-endpoints.json:311-329`
- May be planned or implemented differently

### Data Loading

**Database Query** → `src/app/(dashboard)/support/[id]/page.tsx:34-44`

```typescript
db.supportTicket.findFirst({
  where: { id: params.id, companyId: company.id },
  include: {
    messages: {
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name, email, id } } },
    },
    createdBy: { select: { name, email } },
    assignedTo: { select: { name, email, id } },
  },
})
```

**Security**:

- Tickets are filtered by company ID → `src/app/(dashboard)/support/[id]/page.tsx:35`
- Only users within same company can view tickets
- 404 redirect if ticket not found or unauthorized → `src/app/(dashboard)/support/[id]/page.tsx:46-48`

## Business Context

### Croatian Market Focus

All UI text is in Croatian:

- Status labels: "Otvoren", "U tijeku", "Riješen", "Zatvoren" → `src/app/(dashboard)/support/[id]/page.tsx:16-21`
- Priority labels: "Nizak prioritet", "Standard", "Visok", "Hitno" → `src/app/(dashboard)/support/[id]/page.tsx:23-28`
- Action buttons: "Preuzmi tiket", "Zatvori tiket", "Ponovno otvori" → `src/components/support/support-assign-button.tsx:47`, `src/components/support/support-status-buttons.tsx:39,76`
- Form placeholder: "Upišite odgovor računovođi..." → `src/components/support/support-reply-form.tsx:45`
- Timestamps formatted with hr-HR locale → `src/app/(dashboard)/support/[id]/page.tsx:97`

### Support as Core Feature

FiskAI treats support as first-class feature:

- **In-app Communication**: Eliminates need for external email → `src/app/(dashboard)/support/[id]/page.tsx:86`
- **Notification Integration**: Tickets appear in notification feed → `src/lib/notifications.ts:314-321`
- **Assignment System**: Tickets can be claimed by accountants → `src/components/support/support-assign-button.tsx:1`
- **Status Workflow**: Clear lifecycle from OPEN → IN_PROGRESS → RESOLVED → CLOSED

### Use Cases

1. **Bookkeeping Questions**: Users ask accountants about PDV, expenses, invoices
2. **Document Clarification**: Resolve questions about uploaded receipts or invoices
3. **Feature Requests**: Request new capabilities or report issues
4. **Compliance Help**: Ask about Croatian tax regulations and Fiskalizacija
5. **Onboarding Support**: Get help setting up company data and integrations

## Data

### Database Models

**SupportTicket** → `prisma/schema.prisma:741-758`

- `id`: String (cuid) - Primary key
- `companyId`: String - Foreign key to Company
- `createdById`: String? - Foreign key to User (ticket creator)
- `assignedToId`: String? - Foreign key to User (assigned accountant)
- `title`: String - Ticket subject
- `body`: String? - Optional initial description
- `status`: SupportTicketStatus - Current status (default: OPEN)
- `priority`: SupportTicketPriority - Urgency level (default: NORMAL)
- `createdAt`: DateTime - Creation timestamp
- `updatedAt`: DateTime - Last update timestamp (auto-updated)
- Indexes: `[companyId]`, `[status]`, `[priority]`

**SupportTicketMessage** → `prisma/schema.prisma:760-769`

- `id`: String (cuid) - Primary key
- `ticketId`: String - Foreign key to SupportTicket
- `authorId`: String? - Foreign key to User (message author)
- `body`: String - Message content
- `createdAt`: DateTime - Message timestamp
- Index: `[ticketId]`

**Enums**:

SupportTicketStatus → `prisma/schema.prisma:920-925`

- OPEN: Newly created ticket
- IN_PROGRESS: Being worked on
- RESOLVED: Solution provided
- CLOSED: Ticket archived

SupportTicketPriority → `prisma/schema.prisma:927-932`

- LOW: Non-urgent question
- NORMAL: Standard priority (default)
- HIGH: Important issue
- URGENT: Critical, needs immediate attention

### Relations

**Note**: Schema shows foreign key fields but explicit relations to User model are not defined:

- `createdById` → Should relate to User model → `prisma/schema.prisma:744`
- `assignedToId` → Should relate to User model → `prisma/schema.prisma:745`
- `authorId` → Should relate to User model → `prisma/schema.prisma:763`

These are accessed in queries but may rely on implicit joins:

- `ticket.createdBy` → `src/app/(dashboard)/support/[id]/page.tsx:41`
- `ticket.assignedTo` → `src/app/(dashboard)/support/[id]/page.tsx:42`
- `message.author` → `src/app/(dashboard)/support/[id]/page.tsx:39`

## Dependencies

**Depends on**:

- [[auth-session]] - User authentication required → `src/app/(dashboard)/support/[id]/page.tsx:31`
- [[company-context]] - Ticket scoped to company → `src/app/(dashboard)/support/[id]/page.tsx:32`
- [[support-list]] - Primary navigation path → `src/app/(dashboard)/support/page.tsx:79`
- [[notifications]] - Ticket alerts and updates → `src/lib/notifications.ts:314-321`

**Depended by**:

- [[admin-support]] - Admin view of all tickets across companies
- [[notifications]] - Shows ticket alerts in notification feed

## Integrations

### Notification System

Tickets generate notifications in multiple scenarios → `src/lib/notifications.ts:229-258`:

**Alert Types**:

1. **Open Tickets Alert**: "X ticket(a) čeka odgovor" → Links to /support → `src/lib/notifications.ts:229-238`
2. **Unassigned Tickets Alert**: "X ticket(a) bez dodjele" → Links to /support → `src/lib/notifications.ts:240-248`
3. **Stale Tickets Alert**: "X ticket(a) čeka >48h" → Links to /support → `src/lib/notifications.ts:251-259`

**Individual Ticket Notifications** → `src/lib/notifications.ts:314-322`:

- ID: `ticket-${ticket.id}`
- Type: "support"
- Title: `Ticket: ${ticket.title}`
- Description: Shows status and priority
- Timestamp: Relative time format
- Action: "Otvori ticket" → Links to `/support/${ticket.id}`

### Dashboard Metrics

Support data feeds into company-wide metrics → `src/lib/notifications.ts:127-159`:

- Open ticket count: OPEN + IN_PROGRESS statuses
- Recent tickets: Last 5 updated tickets
- Stale ticket count: Tickets updated >48 hours ago
- Unassigned ticket count: Tickets with no assignee

## Verification Checklist

- [x] /support/:id route accessible to authenticated users
- [x] Ticket detail page shows breadcrumb navigation
- [x] Ticket metadata displays correctly (status, priority, creator, assignee)
- [x] Status badges show Croatian labels
- [x] Priority badges show Croatian labels
- [x] Messages display in chronological order (oldest first)
- [x] Message timestamps formatted in Croatian locale
- [x] Empty state shows when no messages exist
- [x] Reply form textarea has correct placeholder text
- [x] Reply submission posts to /api/support/tickets/:id/messages
- [x] Close button appears for open tickets
- [x] Reopen button appears for closed/resolved tickets
- [x] Assign/unassign button shows correct text based on state
- [x] Status changes trigger toast notifications
- [x] Redirect to /support if ticket not found
- [x] Company-scoped security prevents cross-company access
- [ ] Assign endpoint implementation (referenced but not found)
- [ ] User relations explicitly defined in Prisma schema

## Evidence Links

1. `src/app/(dashboard)/support/[id]/page.tsx:1-110` - Main ticket detail page implementation
2. `src/components/support/support-reply-form.tsx:1-56` - Reply form component with message submission
3. `src/components/support/support-status-buttons.tsx:1-80` - Close and reopen button components
4. `src/components/support/support-assign-button.tsx:1-50` - Assign/unassign ticket functionality
5. `src/app/api/support/tickets/[id]/messages/route.ts:1-54` - POST endpoint for creating messages
6. `src/app/api/support/tickets/[id]/status/route.ts:1-47` - PATCH endpoint for updating status
7. `prisma/schema.prisma:741-769` - Database models for SupportTicket and SupportTicketMessage
8. `prisma/schema.prisma:920-932` - Enums for status and priority values
9. `src/lib/notifications.ts:229-258` - Support ticket notification alerts
10. `src/lib/notifications.ts:314-322` - Individual ticket notification items
11. `src/app/(dashboard)/support/page.tsx:77-79` - Link from support list to detail page
12. `docs/_meta/inventory/routes.json:438-442` - Route registration for /support/:id
13. `docs/_meta/inventory/components.json:384-406` - Component inventory for support modules
