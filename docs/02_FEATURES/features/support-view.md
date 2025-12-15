# Feature: View Support Tickets (F086)

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 15

## Purpose

Provides a comprehensive view of all support tickets for a company with filtering capabilities and real-time updates. This feature enables users to browse their support tickets, view ticket status and priority, track recent activity, and access detailed ticket information. Users can switch between creating new tickets and viewing existing ones in a unified interface that facilitates communication with accountants without leaving the application.

## User Entry Points

| Type        | Path                           | Evidence                                            |
| ----------- | ------------------------------ | --------------------------------------------------- |
| Navigation  | `/support`                     | `src/lib/navigation.ts:60`                          |
| API List    | `/api/support/tickets`         | `src/app/api/support/tickets/route.ts:13-50`        |
| API Summary | `/api/support/tickets/summary` | `src/app/api/support/tickets/summary/route.ts:6-56` |
| Detail      | `/support/:id`                 | `src/app/(dashboard)/support/[id]/page.tsx:30-110`  |
| Mobile Nav  | Bottom navigation (mobile)     | `src/components/layout/bottom-nav.tsx:23,92,115`    |

## Core Flow

### Main List View Flow

1. User navigates to `/support` via sidebar or bottom navigation -> `src/app/(dashboard)/support/page.tsx:25-114`
2. Page requires authentication and company context -> `src/app/(dashboard)/support/page.tsx:26-27`
3. System fetches tickets for company ordered by last update -> `src/app/(dashboard)/support/page.tsx:29-46`
4. Query retrieves up to 50 most recent tickets with status, priority, assignee, and last message -> `src/app/(dashboard)/support/page.tsx:32-46`
5. Header displays page title and description -> `src/app/(dashboard)/support/page.tsx:50-56`
6. Layout splits into two-column grid: ticket list (left) and create form (right) -> `src/app/(dashboard)/support/page.tsx:58`
7. Ticket count badge displays total number of tickets -> `src/app/(dashboard)/support/page.tsx:65`
8. Empty state shown if no tickets exist, prompting user to create first ticket -> `src/app/(dashboard)/support/page.tsx:68-74`
9. Each ticket displays as clickable card showing title, status, priority, last update, assignee, and last message author -> `src/app/(dashboard)/support/page.tsx:76-97`
10. User clicks ticket to navigate to detail view -> `src/app/(dashboard)/support/page.tsx:77-79`

### Ticket Detail View Flow

1. User clicks ticket from list or navigates to `/support/:id` -> `src/app/(dashboard)/support/[id]/page.tsx:30-110`
2. System verifies ticket belongs to user's company -> `src/app/(dashboard)/support/[id]/page.tsx:34-35`
3. Query fetches ticket with all messages and related user information -> `src/app/(dashboard)/support/[id]/page.tsx:36-44`
4. If ticket not found or unauthorized, redirect to support list -> `src/app/(dashboard)/support/[id]/page.tsx:46-48`
5. Breadcrumb navigation displays at top with link back to list -> `src/app/(dashboard)/support/[id]/page.tsx:53-58`
6. Header shows ticket title, status badge, priority badge -> `src/app/(dashboard)/support/[id]/page.tsx:60-63`
7. Metadata row displays creator, assignee information -> `src/app/(dashboard)/support/[id]/page.tsx:64-68`
8. Action buttons allow assigning ticket, closing, or reopening -> `src/app/(dashboard)/support/[id]/page.tsx:69-80`
9. Message thread displays in chronological order (oldest first) -> `src/app/(dashboard)/support/[id]/page.tsx:83-103`
10. Reply form enables adding new messages to ticket -> `src/app/(dashboard)/support/[id]/page.tsx:105`

### API Fetch Flow

1. Client makes GET request to `/api/support/tickets` -> `src/app/api/support/tickets/route.ts:13-50`
2. System authenticates user and retrieves company context -> `src/app/api/support/tickets/route.ts:14-22`
3. Optional status filter parsed from query parameters (defaults to OPEN, IN_PROGRESS) -> `src/app/api/support/tickets/route.ts:24-32`
4. Database query filters tickets by company and status -> `src/app/api/support/tickets/route.ts:34-47`
5. Results include last message metadata for each ticket -> `src/app/api/support/tickets/route.ts:41-46`
6. Response returns tickets array ordered by update time -> `src/app/api/support/tickets/route.ts:49`

### Server Action Fetch Flow

1. Client calls `getSupportTickets()` server action -> `src/app/actions/support-ticket.ts:167-232`
2. Action requires authentication and company context -> `src/app/actions/support-ticket.ts:174-176`
3. Pagination calculated from page and limit parameters -> `src/app/actions/support-ticket.ts:177`
4. Optional filters applied for status and priority arrays -> `src/app/actions/support-ticket.ts:179-187`
5. Parallel queries fetch ticket list and total count -> `src/app/actions/support-ticket.ts:189-206`
6. Results include last message timestamp for each ticket -> `src/app/actions/support-ticket.ts:196-202`
7. Response includes pagination metadata (totalPages, hasNextPage, etc.) -> `src/app/actions/support-ticket.ts:216-226`
8. Operation logged for audit trail -> `src/app/actions/support-ticket.ts:208-214`

### Summary/Badge Flow

1. Client component uses `useTicketSummary()` hook -> `src/hooks/use-ticket-summary.ts:10-38`
2. Hook fetches from `/api/support/tickets/summary` on mount -> `src/hooks/use-ticket-summary.ts:19`
3. Polling refreshes data every 60 seconds -> `src/hooks/use-ticket-summary.ts:30`
4. API endpoint fetches open and in-progress tickets only -> `src/app/api/support/tickets/summary/route.ts:11-26`
5. System calculates counts: openCount, assignedToMe, unassigned, unread -> `src/app/api/support/tickets/summary/route.ts:28-43`
6. Unread determined by last message author not being current user -> `src/app/api/support/tickets/summary/route.ts:38-41`
7. Summary returned with all metrics -> `src/app/api/support/tickets/summary/route.ts:45-51`
8. Bottom navigation displays unread or open count as badge -> `src/components/layout/bottom-nav.tsx:92,115`

## Key Modules

| Module                    | Purpose                                      | Location                                                |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| SupportPage               | Main support page with ticket list and form  | `src/app/(dashboard)/support/page.tsx`                  |
| SupportDetailPage         | Individual ticket detail with message thread | `src/app/(dashboard)/support/[id]/page.tsx`             |
| CreateSupportTicketForm   | Form component for creating new tickets      | `src/components/support/create-support-ticket-form.tsx` |
| SupportReplyForm          | Form component for replying to tickets       | `src/components/support/support-reply-form.tsx`         |
| SupportStatusButtons      | Close and reopen ticket action buttons       | `src/components/support/support-status-buttons.tsx`     |
| AssignSupportTicketButton | Assign ticket to user action button          | `src/components/support/support-assign-button.tsx`      |
| TicketsAPI                | REST API for listing tickets with filters    | `src/app/api/support/tickets/route.ts`                  |
| TicketSummaryAPI          | REST API for ticket count summaries          | `src/app/api/support/tickets/summary/route.ts`          |
| TicketMessagesAPI         | REST API for adding messages to tickets      | `src/app/api/support/tickets/[id]/messages/route.ts`    |
| TicketStatusAPI           | REST API for updating ticket status          | `src/app/api/support/tickets/[id]/status/route.ts`      |
| supportTicketActions      | Server actions for ticket CRUD operations    | `src/app/actions/support-ticket.ts`                     |
| useTicketSummary          | React hook for real-time ticket summaries    | `src/hooks/use-ticket-summary.ts`                       |
| AdminSupportDashboard     | Admin-only support metrics dashboard         | `src/app/api/admin/support/dashboard/route.ts`          |

## Data

### Database Tables

#### SupportTicket Table

Primary ticket storage table -> `prisma/schema.prisma:741-758`

Key fields:

- `id` (String, CUID): Unique identifier
- `companyId` (String): Tenant isolation -> `prisma/schema.prisma:743`
- `createdById` (String?): User who created ticket -> `prisma/schema.prisma:744`
- `assignedToId` (String?): User assigned to handle ticket -> `prisma/schema.prisma:745`
- `title` (String): Ticket subject/title -> `prisma/schema.prisma:746`
- `body` (String?): Initial ticket description -> `prisma/schema.prisma:747`
- `status` (SupportTicketStatus): Current status, default OPEN -> `prisma/schema.prisma:748,920-925`
- `priority` (SupportTicketPriority): Urgency level, default NORMAL -> `prisma/schema.prisma:749,927-932`
- `createdAt` (DateTime): Creation timestamp -> `prisma/schema.prisma:750`
- `updatedAt` (DateTime): Last update timestamp -> `prisma/schema.prisma:751`

Relations:

- `company` (Company): Owner company relation -> `prisma/schema.prisma:752`
- `messages` (SupportTicketMessage[]): Associated messages -> `prisma/schema.prisma:753`

Indexes:

- `companyId`: Tenant filtering -> `prisma/schema.prisma:755`
- `status`: Status-based queries -> `prisma/schema.prisma:756`
- `priority`: Priority-based queries -> `prisma/schema.prisma:757`

#### SupportTicketMessage Table

Message/conversation storage table -> `prisma/schema.prisma:760-769`

Key fields:

- `id` (String, CUID): Unique identifier
- `ticketId` (String): Parent ticket reference -> `prisma/schema.prisma:762`
- `authorId` (String?): Message author user ID -> `prisma/schema.prisma:763`
- `body` (String): Message content -> `prisma/schema.prisma:764`
- `createdAt` (DateTime): Message timestamp -> `prisma/schema.prisma:765`

Relations:

- `ticket` (SupportTicket): Parent ticket relation -> `prisma/schema.prisma:766`

Indexes:

- `ticketId`: Fast message lookup by ticket -> `prisma/schema.prisma:768`

### Enums

#### SupportTicketStatus

Ticket lifecycle states -> `prisma/schema.prisma:920-925`

- `OPEN`: Newly created, awaiting response
- `IN_PROGRESS`: Being actively worked on
- `RESOLVED`: Solution provided, awaiting confirmation
- `CLOSED`: Completed and closed

#### SupportTicketPriority

Urgency classification -> `prisma/schema.prisma:927-932`

- `LOW`: Non-urgent request
- `NORMAL`: Standard priority (default)
- `HIGH`: Elevated priority
- `URGENT`: Critical issue requiring immediate attention

### Query Patterns

#### Ticket List Query

Server-side query for main support page -> `src/app/(dashboard)/support/page.tsx:29-46`

```typescript
db.supportTicket.findMany({
  where: { companyId: company.id },
  orderBy: { updatedAt: "desc" },
  take: 50,
  select: {
    id: true,
    title: true,
    status: true,
    priority: true,
    updatedAt: true,
    assignedTo: { select: { name: true, email: true } },
    messages: {
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { createdAt: true, author: { select: { name: true, email: true } } },
    },
  },
})
```

#### API List Query with Filters

REST API query with status filtering -> `src/app/api/support/tickets/route.ts:34-47`

```typescript
db.supportTicket.findMany({
  where: {
    companyId: company.id,
    status: { in: statusFilter }, // Default: [OPEN, IN_PROGRESS]
  },
  orderBy: { updatedAt: "desc" },
  include: {
    messages: {
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { id: true, body: true, createdAt: true, authorId: true },
    },
  },
})
```

#### Ticket Detail Query

Full ticket with message thread -> `src/app/(dashboard)/support/[id]/page.tsx:34-44`

```typescript
db.supportTicket.findFirst({
  where: { id: params.id, companyId: company.id },
  include: {
    messages: {
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true, email: true, id: true } } },
    },
    createdBy: { select: { name: true, email: true } },
    assignedTo: { select: { name: true, email: true, id: true } },
  },
})
```

#### Summary Query

Count and categorization for badges -> `src/app/api/support/tickets/summary/route.ts:11-26`

```typescript
db.supportTicket.findMany({
  where: {
    companyId: company.id,
    status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
  },
  select: {
    id: true,
    assignedToId: true,
    updatedAt: true,
    messages: {
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { authorId: true, createdAt: true },
    },
  },
})
```

### Status and Priority Labels

Croatian translations for UI display -> `src/app/(dashboard)/support/page.tsx:11-23`

```typescript
const statusLabels: Record<SupportTicketStatus, string> = {
  OPEN: "Otvoren",
  IN_PROGRESS: "U tijeku",
  RESOLVED: "Riješen",
  CLOSED: "Zatvoren",
}

const priorityLabels: Record<SupportTicketPriority, string> = {
  LOW: "Nizak prioritet",
  NORMAL: "Standard",
  HIGH: "Visok",
  URGENT: "Hitno",
}
```

## Dependencies

### Depends On

- **Authentication System**: User and company context -> `src/lib/auth-utils.ts:requireAuth, requireCompany`
- **Tenant Context**: Multi-tenant data isolation -> `src/lib/auth-utils.ts:requireCompanyWithContext`
- **User System**: Ticket creators and assignees -> `prisma/schema.prisma:User`
- **Company System**: Ticket ownership and isolation -> `prisma/schema.prisma:Company`
- **Toast Notifications**: User feedback for actions -> `src/lib/toast.ts`

### Depended By

- **Support Ticket Creation**: Users create tickets to populate list -> Feature F085
- **Support Ticket Messaging**: Messages update ticket timestamps -> Feature F088
- **Admin Support Dashboard**: Aggregates ticket metrics -> Feature F091
- **Navigation System**: Links to support pages from multiple locations -> `src/lib/navigation.ts`

## Integrations

### Internal Integrations

#### Navigation System

Primary navigation under "Suradnja" section -> `src/lib/navigation.ts:56-62`

```typescript
{
  title: "Suradnja",
  items: [
    { name: "Računovođa", href: "/accountant", icon: UserCog },
    { name: "Podrška", href: "/support", icon: LifeBuoy },
  ],
}
```

#### Bottom Navigation (Mobile)

Mobile navigation with badge for unread/open tickets -> `src/components/layout/bottom-nav.tsx:23,92,115`

```typescript
{ href: "/support", icon: LifeBuoy, label: "Support" }
// Badge shows: summary?.unread || summary?.openCount || undefined
```

#### Real-time Polling

Client-side hook polls for updates every 60 seconds -> `src/hooks/use-ticket-summary.ts:14-34`

- Fetches summary on component mount
- Sets 60-second interval for automatic refresh
- Cleans up interval on component unmount
- Provides loading state and summary data

#### Server Actions

Alternative to REST API for server-side operations -> `src/app/actions/support-ticket.ts:167-232`

- `getSupportTickets()`: Fetch with filters and pagination
- `getSupportTicket()`: Fetch single ticket by ID
- `createSupportTicket()`: Create new ticket
- `updateSupportTicket()`: Update ticket fields
- `addSupportTicketMessage()`: Add message to thread
- `closeSupportTicket()`: Close ticket with optional note
- `reopenSupportTicket()`: Reopen closed/resolved ticket
- `assignSupportTicket()`: Assign ticket to user

#### Empty State

Contextual empty state when no tickets exist -> `src/app/(dashboard)/support/page.tsx:68-74`

```typescript
<EmptyState
  icon={<MessageCircle className="h-8 w-8" />}
  title="Još nema otvorenih tiketa"
  description="Koristite obrazac desno za komunikaciju s računovođom..."
/>
```

### External Integrations

None currently. Support tickets are an internal communication feature without external API integrations.

## Verification Checklist

### List View

- [ ] User can access support page via `/support`
- [ ] Page displays up to 50 most recent tickets
- [ ] Tickets ordered by last update (newest first)
- [ ] Each ticket card shows: title, status badge, priority badge
- [ ] Ticket card displays last update timestamp in Croatian locale
- [ ] Assignee name or email shown (or "Nije dodijeljeno")
- [ ] Last message author displayed if messages exist
- [ ] Ticket count badge shows total number of tickets
- [ ] Empty state displays when no tickets exist
- [ ] Empty state has message icon and contextual description
- [ ] Create ticket form visible in right column on desktop
- [ ] Grid layout responsive (stacks on mobile)
- [ ] All queries filter by companyId (tenant isolation)

### Navigation

- [ ] Support link appears in sidebar under "Suradnja"
- [ ] LifeBuoy icon displays next to "Podrška" label
- [ ] Bottom navigation shows support on mobile devices
- [ ] Badge displays unread count when messages waiting
- [ ] Badge falls back to open count if no unread
- [ ] Badge hidden when no tickets require attention
- [ ] Clicking ticket navigates to detail page with correct ID

### Ticket Detail

- [ ] Detail page accessible via `/support/:id`
- [ ] Breadcrumb shows "Support / {ticket title}"
- [ ] Back link returns to support list
- [ ] Header displays ticket title prominently
- [ ] Status badge shows current status with Croatian label
- [ ] Priority badge displays priority level
- [ ] Metadata shows ticket creator (name or email)
- [ ] Metadata shows assignee (name or email or "Nije dodijeljeno")
- [ ] Assign button visible and functional
- [ ] Close button visible when status is OPEN or IN_PROGRESS
- [ ] Reopen button visible when status is RESOLVED or CLOSED
- [ ] Messages display in chronological order (oldest first)
- [ ] Each message shows author name/email and timestamp
- [ ] Message body preserves whitespace and line breaks
- [ ] Empty message state shows when no messages exist
- [ ] Reply form appears at bottom of message thread
- [ ] Reply form has textarea and submit button

### API Functionality

- [ ] GET `/api/support/tickets` returns filtered tickets
- [ ] Default status filter includes OPEN and IN_PROGRESS
- [ ] Custom status filter accepts comma-separated values
- [ ] Status filter validates against enum values
- [ ] API returns tickets with last message metadata
- [ ] API enforces authentication (401 if unauthorized)
- [ ] API enforces company context (404 if no company)
- [ ] GET `/api/support/tickets/summary` returns counts
- [ ] Summary includes: openCount, assignedToMe, unassigned, unread
- [ ] Unread calculation based on last message author
- [ ] Summary only includes OPEN and IN_PROGRESS tickets

### Server Actions

- [ ] `getSupportTickets()` accepts status and priority filters
- [ ] Server action supports pagination (page, limit)
- [ ] Response includes pagination metadata (totalPages, hasNextPage)
- [ ] All operations require authentication
- [ ] All operations filter by company context
- [ ] Operations log audit trail with structured data
- [ ] Validation errors return structured error responses
- [ ] Database errors caught and logged appropriately

### Status Management

- [ ] Tickets created with OPEN status by default
- [ ] Status can transition: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
- [ ] Closed/resolved tickets can be reopened to OPEN
- [ ] Status update via PATCH `/api/support/tickets/:id/status`
- [ ] Status validation prevents invalid enum values
- [ ] Status changes update `updatedAt` timestamp
- [ ] Close button sends status: 'CLOSED'
- [ ] Reopen button sends status: 'OPEN'

### Priority Management

- [ ] Tickets created with NORMAL priority by default
- [ ] Priority levels: LOW, NORMAL, HIGH, URGENT
- [ ] Priority displayed with Croatian labels
- [ ] Priority filter works in server actions
- [ ] Priority badges color-coded appropriately

### Real-time Updates

- [ ] `useTicketSummary` hook fetches on mount
- [ ] Hook polls every 60 seconds automatically
- [ ] Hook handles fetch errors gracefully
- [ ] Hook provides loading state
- [ ] Hook cleanup prevents memory leaks on unmount
- [ ] Badge updates reflect new unread counts
- [ ] Badge updates within 60 seconds of new message

### Data Integrity

- [ ] All ticket queries filter by companyId
- [ ] Users cannot access tickets from other companies
- [ ] Ticket list limited to 50 results (performance)
- [ ] Message queries join author information correctly
- [ ] Timestamps display in Croatian locale format
- [ ] Status and priority use enum validation
- [ ] Assignee selection validates user IDs
- [ ] Empty assignedToId treated as unassigned
- [ ] Message count accurate for last message display
- [ ] Delete cascade works for messages when ticket deleted

### UI/UX

- [ ] Card hover shows subtle background color change
- [ ] Badges use appropriate semantic colors
- [ ] Typography follows design system (text-sm, text-base)
- [ ] Spacing consistent across cards
- [ ] Croatian locale used throughout interface
- [ ] Form validation shows inline error messages
- [ ] Success toasts appear after actions complete
- [ ] Error toasts display when actions fail
- [ ] Loading states show during async operations
- [ ] Buttons disable during form submission

## Evidence Links

1. `src/app/(dashboard)/support/page.tsx:25-114` - Main support page with ticket list and create form
2. `src/app/(dashboard)/support/[id]/page.tsx:30-110` - Ticket detail page with message thread and actions
3. `src/app/api/support/tickets/route.ts:13-50` - REST API for listing tickets with status filters
4. `src/app/api/support/tickets/summary/route.ts:6-56` - REST API for ticket count summaries with unread detection
5. `src/app/actions/support-ticket.ts:167-232` - Server action for fetching tickets with pagination and filters
6. `src/hooks/use-ticket-summary.ts:10-38` - React hook for real-time ticket summary polling
7. `src/components/support/create-support-ticket-form.tsx:10-91` - Form component for creating support tickets
8. `src/components/support/support-reply-form.tsx:7-56` - Form component for replying to tickets
9. `src/components/support/support-status-buttons.tsx:7-79` - Close and reopen ticket action buttons
10. `src/lib/navigation.ts:60` - Navigation menu entry for support in "Suradnja" section
11. `src/components/layout/bottom-nav.tsx:23,92,115` - Mobile bottom navigation with support badge
12. `prisma/schema.prisma:741-758` - SupportTicket model schema with fields, relations, and indexes
13. `prisma/schema.prisma:760-769` - SupportTicketMessage model schema for conversation threads
14. `prisma/schema.prisma:920-932` - SupportTicketStatus and SupportTicketPriority enum definitions
15. `src/app/api/admin/support/dashboard/route.ts:32-129` - Admin-only support metrics and dashboard API
