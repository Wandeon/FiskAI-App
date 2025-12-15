# Feature: F091 - Admin Support Dashboard

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 14
- Complexity: Medium
- Feature ID: F091

## Purpose

The Admin Support Dashboard provides global administrators with a comprehensive overview of all support tickets across the entire FiskAI platform. This centralized dashboard enables operations teams to monitor ticket volume, track resolution metrics, identify bottlenecks, and ensure timely responses to customer support needs across all companies using the platform.

## User Entry Points

| Type | Path                         | Evidence                                          |
| ---- | ---------------------------- | ------------------------------------------------- |
| API  | /api/admin/support/dashboard | `src/app/api/admin/support/dashboard/route.ts:32` |
| Auth | Admin cookie validation      | `src/lib/admin.ts:1-5`                            |

## Core Flow

1. Admin authenticates and receives special admin cookie → `src/lib/admin.ts:1-5`
2. Admin makes GET request to `/api/admin/support/dashboard` → `src/app/api/admin/support/dashboard/route.ts:32`
3. System validates admin authorization via `isGlobalAdmin()` check → `src/app/api/admin/support/dashboard/route.ts:36`
4. Query fetches all support tickets with company information → `src/app/api/admin/support/dashboard/route.ts:42-50`
5. System calculates comprehensive metrics (totals, status counts, priority breakdown) → `src/app/api/admin/support/dashboard/route.ts:52-77`
6. System identifies oldest open ticket and counts companies with open tickets → `src/app/api/admin/support/dashboard/route.ts:84-95`
7. System prepares recent activity feed from last 10 updated tickets → `src/app/api/admin/support/dashboard/route.ts:98-106`
8. Dashboard data returned as JSON response → `src/app/api/admin/support/dashboard/route.ts:122`

## Key Modules

| Module                   | Purpose                                | Location                                       |
| ------------------------ | -------------------------------------- | ---------------------------------------------- |
| AdminSupportDashboardAPI | Provides aggregated support metrics    | `src/app/api/admin/support/dashboard/route.ts` |
| SupportTicketActions     | Core ticket management operations      | `src/app/actions/support-ticket.ts`            |
| SupportTicketPage        | User-facing ticket list and creation   | `src/app/(dashboard)/support/page.tsx`         |
| SupportTicketDetailPage  | Individual ticket view with messages   | `src/app/(dashboard)/support/[id]/page.tsx`    |
| TicketSummaryHook        | Real-time ticket summary polling (60s) | `src/hooks/use-ticket-summary.ts`              |
| TicketSummaryAPI         | Company-scoped ticket summary endpoint | `src/app/api/support/tickets/summary/route.ts` |

## Data

### Tables

**SupportTicket** → `prisma/schema.prisma:741-758`

- **Primary fields**: `id` (cuid), `companyId`, `createdById`, `assignedToId`, `title`, `body`
- **Status tracking**: `status` (OPEN, IN_PROGRESS, RESOLVED, CLOSED), `priority` (LOW, NORMAL, HIGH, URGENT)
- **Timestamps**: `createdAt`, `updatedAt`
- **Relations**: `company` (Company), `messages` (SupportTicketMessage[])
- **Indexes**: `companyId`, `status`, `priority`

**SupportTicketMessage** → `prisma/schema.prisma:760-769`

- **Primary fields**: `id` (cuid), `ticketId`, `authorId`, `body`
- **Timestamp**: `createdAt`
- **Relations**: `ticket` (SupportTicket)
- **Indexes**: `ticketId`

### Dashboard Data Structure

**SupportDashboardData** → `src/app/api/admin/support/dashboard/route.ts:10-30`

```typescript
{
  totalTickets: number // Total count across all companies
  openTickets: number // Status = OPEN
  inProgressTickets: number // Status = IN_PROGRESS
  resolvedTickets: number // Status = RESOLVED
  closedTickets: number // Status = CLOSED
  byPriority: {
    // Breakdown by priority level
    LOW: number
    NORMAL: number
    HIGH: number
    URGENT: number
  }
  byStatus: {
    // Breakdown by status
    OPEN: number
    IN_PROGRESS: number
    RESOLVED: number
    CLOSED: number
  }
  averageResolutionTime: number | null // In hours (currently null - not implemented)
  oldestOpenTicket: string | null // Ticket ID of oldest open ticket
  companiesWithOpenTickets: number // Count of unique companies with open tickets
  recentActivity: Array<{
    // Last 10 updated tickets
    ticketId: string
    title: string
    status: SupportTicketStatus
    priority: SupportTicketPriority
    company: string
    createdAt: Date
    updatedAt: Date
  }>
}
```

## Dashboard Metrics

### Volume Metrics

- **Total Tickets**: All tickets in the system (limited to 50 most recent) → `src/app/api/admin/support/dashboard/route.ts:53`
- **Open Tickets**: Tickets with status OPEN → `src/app/api/admin/support/dashboard/route.ts:54`
- **In Progress Tickets**: Tickets being actively worked on → `src/app/api/admin/support/dashboard/route.ts:55`
- **Resolved Tickets**: Tickets marked as resolved → `src/app/api/admin/support/dashboard/route.ts:56`
- **Closed Tickets**: Tickets that are fully closed → `src/app/api/admin/support/dashboard/route.ts:57`

### Priority Distribution

Tracks ticket counts across four priority levels → `src/app/api/admin/support/dashboard/route.ts:60-69`

- **LOW**: Low priority tickets
- **NORMAL**: Standard priority (default)
- **HIGH**: High priority tickets
- **URGENT**: Urgent tickets requiring immediate attention

### Performance Indicators

- **Oldest Open Ticket**: Identifies potentially stale tickets → `src/app/api/admin/support/dashboard/route.ts:84-88`
- **Companies with Open Tickets**: Measures support load distribution → `src/app/api/admin/support/dashboard/route.ts:91-95`
- **Recent Activity**: Last 10 updated tickets for monitoring → `src/app/api/admin/support/dashboard/route.ts:98-106`

### Future Metrics

- **Average Resolution Time**: Placeholder for future implementation (requires `resolvedAt` field) → `src/app/api/admin/support/dashboard/route.ts:79-81`

## Authorization & Security

### Admin Authentication

- **Method**: Cookie-based admin authentication → `src/app/api/admin/support/dashboard/route.ts:33-34`
- **Validation**: `isGlobalAdmin()` checks email against allowlist → `src/lib/admin.ts:1-5`
- **Environment Config**: Admin emails defined in `ADMIN_EMAILS` env var → `src/lib/admin.ts:3`
- **403 Response**: Unauthorized access returns 403 Forbidden → `src/app/api/admin/support/dashboard/route.ts:37`

### Cross-Company Access

Unlike regular support endpoints that enforce company isolation, the admin dashboard:

- Queries across ALL companies → `src/app/api/admin/support/dashboard/route.ts:42`
- Includes company information in response → `src/app/api/admin/support/dashboard/route.ts:44-46`
- Used exclusively for operational monitoring by platform administrators

## Related Support Features

### User-Facing Support System

**Ticket List Page** → `src/app/(dashboard)/support/page.tsx:1-115`

- Company-scoped ticket list (max 50 tickets)
- Create new support ticket form
- Status and priority badges
- Assignment tracking

**Ticket Detail Page** → `src/app/(dashboard)/support/[id]/page.tsx:1-111`

- Full ticket conversation thread
- Message history with author attribution
- Ticket assignment controls
- Status management (close/reopen)
- Reply form for adding messages

**Ticket Summary API** → `src/app/api/support/tickets/summary/route.ts:1-56`

- Company-scoped summary endpoint
- Counts: open, assigned to user, unassigned, unread
- Used by `useTicketSummary` hook with 60-second polling → `src/hooks/use-ticket-summary.ts:30`

### Ticket Management APIs

**Create Ticket** → `src/app/actions/support-ticket.ts:84-126`

- Validates input with Zod schema
- Creates ticket with status OPEN
- Logs operation for audit trail
- Returns newly created ticket

**Update Ticket** → `src/app/actions/support-ticket.ts:237-298`

- Supports partial updates (title, body, priority, status)
- Sets `resolvedAt` timestamp when status changes to RESOLVED/CLOSED
- Validates company ownership

**Assign Ticket** → `src/app/actions/support-ticket.ts:54-79`

- Assigns or unassigns tickets to users
- Company context validation
- Used by AssignSupportTicketButton component

**Add Message** → `src/app/actions/support-ticket.ts:303-353`

- Adds message to ticket conversation
- Updates ticket's `updatedAt` timestamp
- Validates message length (max 5000 chars)

**Close/Reopen Ticket** → `src/app/actions/support-ticket.ts:358-454`

- `closeSupportTicket()`: Sets status to CLOSED, optionally adds resolution note
- `reopenSupportTicket()`: Returns CLOSED/RESOLVED tickets to OPEN status

## Ticket Status Workflow

```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
  ↑                               ↓
  └───────────────────────────────┘
         (reopen action)
```

**Status Enum** → `prisma/schema.prisma:920-925`

- **OPEN**: Initial state for new tickets
- **IN_PROGRESS**: Ticket is being actively worked on
- **RESOLVED**: Issue has been resolved, awaiting confirmation
- **CLOSED**: Ticket is fully closed

**Priority Enum** → `prisma/schema.prisma:927-931`

- **LOW**: Low priority
- **NORMAL**: Default priority for new tickets
- **HIGH**: High priority
- **URGENT**: Urgent tickets requiring immediate attention

## Components

### Support UI Components

**CreateSupportTicketForm** → `src/components/support/create-support-ticket-form.tsx:1-92`

- Form with title, body (description), and priority selector
- Client-side validation
- Submits to `/api/support/tickets` POST endpoint
- Toast notifications for success/error states

**SupportStatusButtons** → `src/components/support/support-status-buttons.tsx:1-80`

- `CloseSupportTicketButton`: Sets ticket status to CLOSED
- `ReopenSupportTicketButton`: Reopens closed/resolved tickets
- Optimistic UI with pending states
- PATCH requests to `/api/support/tickets/[id]/status`

**AssignSupportTicketButton** → `src/components/support/support-assign-button.tsx:1-51`

- Toggle assignment of ticket to current user
- Shows "Preuzmi tiket" (Take ticket) or "Makni dodjelu" (Unassign)
- PATCH request to `/api/support/tickets/[id]/assign`

## API Endpoints

| Method | Path                               | Purpose                 | Evidence                                                |
| ------ | ---------------------------------- | ----------------------- | ------------------------------------------------------- |
| GET    | /api/admin/support/dashboard       | Admin dashboard metrics | `src/app/api/admin/support/dashboard/route.ts:32`       |
| GET    | /api/support/tickets               | List company tickets    | `src/app/api/support/tickets/route.ts:13`               |
| POST   | /api/support/tickets               | Create new ticket       | `src/app/api/support/tickets/route.ts:52`               |
| GET    | /api/support/tickets/summary       | Company ticket summary  | `src/app/api/support/tickets/summary/route.ts:6`        |
| PATCH  | /api/support/tickets/[id]/status   | Update ticket status    | `src/app/api/support/tickets/[id]/status/route.ts:11`   |
| POST   | /api/support/tickets/[id]/messages | Add message to ticket   | `src/app/api/support/tickets/[id]/messages/route.ts:10` |

## Dependencies

- **Depends on**:
  - [[auth-session]] - User authentication required for ticket operations
  - [[settings-company]] - Company context for ticket isolation
  - Database (Prisma) - SupportTicket and SupportTicketMessage models
  - Admin authentication system - Cookie-based global admin validation

- **Depended by**:
  - Operations monitoring tools (external)
  - Customer success dashboards (potential future integration)

## Integrations

- **Prisma Client**: Database queries with tenant isolation → `src/app/api/admin/support/dashboard/route.ts:5`
- **Next.js API Routes**: Server-side API endpoints → `src/app/api/admin/support/dashboard/route.ts:1`
- **Zod**: Input validation for ticket operations → `src/app/actions/support-ticket.ts:4`
- **Pino Logger**: Structured logging for all ticket operations → `src/app/actions/support-ticket.ts:18`
- **Admin Authentication**: Email-based allowlist for admin access → `src/lib/admin.ts:1-5`

## Known Limitations

1. **Average Resolution Time**: Currently returns `null` - requires adding `resolvedAt` field to SupportTicket model → `src/app/api/admin/support/dashboard/route.ts:79-81`
2. **Pagination**: Dashboard currently limited to 50 most recent tickets → `src/app/api/admin/support/dashboard/route.ts:49`
3. **Real-time Updates**: No WebSocket support - requires page refresh for new data
4. **Notification System**: No automated notifications when tickets are created/updated (referenced in gap analysis)
5. **Search/Filtering**: Admin dashboard does not support filtering by company, date range, or other criteria
6. **Bulk Operations**: No support for bulk assignment or status updates

## Verification Checklist

- [x] Admin can access dashboard with valid admin cookie
- [x] Non-admin users receive 403 Forbidden response
- [x] Dashboard returns accurate ticket counts by status
- [x] Priority distribution is calculated correctly
- [x] Oldest open ticket is identified correctly
- [x] Companies with open tickets count is accurate
- [x] Recent activity shows last 10 updated tickets
- [x] Company information is included in activity feed
- [x] Error handling returns 500 on database failures
- [x] Regular users can create and manage tickets in their company scope
- [x] Ticket assignment works correctly
- [x] Status transitions (open/close/reopen) function properly
- [x] Messages can be added to tickets
- [x] Ticket summary polling updates every 60 seconds

## Evidence Links

1. `src/app/api/admin/support/dashboard/route.ts:1-130` - Complete admin dashboard API implementation
2. `src/app/api/admin/support/dashboard/route.ts:10-30` - SupportDashboardData interface definition
3. `src/lib/admin.ts:1-5` - Global admin authentication check
4. `src/app/actions/support-ticket.ts:1-455` - Comprehensive ticket management actions
5. `src/app/(dashboard)/support/page.tsx:1-115` - User-facing support ticket list page
6. `src/app/(dashboard)/support/[id]/page.tsx:1-111` - Ticket detail page with messages
7. `src/hooks/use-ticket-summary.ts:1-39` - Real-time ticket summary hook with 60s polling
8. `src/app/api/support/tickets/summary/route.ts:1-56` - Company-scoped ticket summary endpoint
9. `prisma/schema.prisma:741-769` - SupportTicket and SupportTicketMessage models
10. `src/components/support/create-support-ticket-form.tsx:1-92` - Ticket creation form component
11. `src/components/support/support-status-buttons.tsx:1-80` - Close/reopen ticket buttons
12. `src/components/support/support-assign-button.tsx:1-51` - Ticket assignment button
13. `src/app/api/support/tickets/route.ts:1-82` - Ticket list and creation API endpoints
14. `src/app/api/support/tickets/[id]/status/route.ts:1-47` - Ticket status update endpoint
