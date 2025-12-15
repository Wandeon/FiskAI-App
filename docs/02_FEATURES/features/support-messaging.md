# Feature: Support Ticket Messaging (F088)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 23

## Purpose

The Support Ticket Messaging feature enables real-time communication between users and accountants within support tickets through a dedicated messaging API. Users can send messages to existing support tickets, view conversation history with author attribution and timestamps, and receive instant feedback when messages are posted. The feature maintains tenant isolation, ensures proper authentication, and automatically updates ticket timestamps to reflect the latest activity, creating a seamless in-app communication channel for support requests.

## User Entry Points

| Type      | Path                                   | Evidence                                                |
| --------- | -------------------------------------- | ------------------------------------------------------- |
| API       | POST /api/support/tickets/:id/messages | `src/app/api/support/tickets/[id]/messages/route.ts:10` |
| Page      | /support/:id                           | `src/app/(dashboard)/support/[id]/page.tsx:30`          |
| Component | SupportReplyForm                       | `src/components/support/support-reply-form.tsx:7`       |
| Action    | addSupportTicketMessage                | `src/app/actions/support-ticket.ts:303`                 |

## Core Flow

1. User navigates to ticket detail page at /support/:id → `src/app/(dashboard)/support/[id]/page.tsx:30`
2. System fetches ticket with messages and author information → `src/app/(dashboard)/support/[id]/page.tsx:34-44`
3. System displays messages in chronological order (oldest first) → `src/app/(dashboard)/support/[id]/page.tsx:37-39`
4. Each message shows author name/email and formatted timestamp → `src/app/(dashboard)/support/[id]/page.tsx:93-100`
5. User types message in reply form textarea → `src/components/support/support-reply-form.tsx:42-48`
6. User submits form, triggering POST to /api/support/tickets/:id/messages → `src/components/support/support-reply-form.tsx:15-23`
7. API validates user authentication and company context → `src/app/api/support/tickets/[id]/messages/route.ts:15-23`
8. API verifies ticket exists and belongs to user's company → `src/app/api/support/tickets/[id]/messages/route.ts:25-32`
9. API validates message body using Zod schema (min 1 char) → `src/app/api/support/tickets/[id]/messages/route.ts:34-37`
10. System creates SupportTicketMessage record with authorId → `src/app/api/support/tickets/[id]/messages/route.ts:39-45`
11. System updates ticket's updatedAt timestamp → `src/app/api/support/tickets/[id]/messages/route.ts:47-50`
12. API returns created message object → `src/app/api/support/tickets/[id]/messages/route.ts:52`
13. Client displays success toast notification → `src/components/support/support-reply-form.tsx:32`
14. Form clears message input for next reply → `src/components/support/support-reply-form.tsx:33`

## Key Modules

| Module                  | Purpose                                          | Location                                                 |
| ----------------------- | ------------------------------------------------ | -------------------------------------------------------- |
| MessagesRouteHandler    | API endpoint for creating ticket messages        | `src/app/api/support/tickets/[id]/messages/route.ts`     |
| SupportReplyForm        | Client form component for message submission     | `src/components/support/support-reply-form.tsx`          |
| SupportDetailPage       | Ticket detail page with message display          | `src/app/(dashboard)/support/[id]/page.tsx`              |
| addSupportTicketMessage | Server action for message creation (alternative) | `src/app/actions/support-ticket.ts:303-353`              |
| SupportTicketMessage    | Database model for ticket messages               | `prisma/schema.prisma:760-769`                           |
| messageSchema           | Zod validation schema for message body           | `src/app/api/support/tickets/[id]/messages/route.ts:6-8` |
| addSupportMessageSchema | Zod schema for server action validation          | `src/app/actions/support-ticket.ts:33-35`                |

## API Implementation

### POST /api/support/tickets/:id/messages

**Route Handler**: `src/app/api/support/tickets/[id]/messages/route.ts:10-53`

**Authentication**: Required (getCurrentUser) → `src/app/api/support/tickets/[id]/messages/route.ts:15-18`

**Authorization**: Requires company context → `src/app/api/support/tickets/[id]/messages/route.ts:20-23`

**Request Body**:

```json
{
  "body": "string (min 1 character)"
}
```

→ `src/app/api/support/tickets/[id]/messages/route.ts:6-8`

**Validation**:

- Message body is required (min 1 character) → `src/app/api/support/tickets/[id]/messages/route.ts:7`
- Ticket must exist and belong to user's company → `src/app/api/support/tickets/[id]/messages/route.ts:25-32`
- User must be authenticated → `src/app/api/support/tickets/[id]/messages/route.ts:16-18`

**Response**:

```json
{
  "message": {
    "id": "string",
    "ticketId": "string",
    "authorId": "string",
    "body": "string",
    "createdAt": "datetime"
  }
}
```

→ `src/app/api/support/tickets/[id]/messages/route.ts:52`

**Error Responses**:

- 401 Unauthorized: User not authenticated → `src/app/api/support/tickets/[id]/messages/route.ts:17`
- 404 Not Found: Company not found → `src/app/api/support/tickets/[id]/messages/route.ts:22`
- 404 Not Found: Ticket not found or access denied → `src/app/api/support/tickets/[id]/messages/route.ts:31`
- 400 Bad Request: Invalid message data → `src/app/api/support/tickets/[id]/messages/route.ts:36`

## Message Display

### Message List Rendering

**Container**: Card component with "Poruke" title → `src/app/(dashboard)/support/[id]/page.tsx:83-107`

**Empty State**: Displays "Još nema poruka." when no messages exist → `src/app/(dashboard)/support/[id]/page.tsx:89-90`

**Message Layout**: Each message rendered in rounded border box → `src/app/(dashboard)/support/[id]/page.tsx:94`

**Message Components**:

- **Author Display**: Shows author name or email, falls back to "Nepoznato" → `src/app/(dashboard)/support/[id]/page.tsx:96`
- **Timestamp**: Croatian locale formatted date/time → `src/app/(dashboard)/support/[id]/page.tsx:97`
- **Body**: Pre-wrapped text content → `src/app/(dashboard)/support/[id]/page.tsx:99`

**Data Loading**: Messages fetched with ticket, ordered chronologically (asc) → `src/app/(dashboard)/support/[id]/page.tsx:37-39`

**Author Inclusion**: Messages include author name, email, and ID → `src/app/(dashboard)/support/[id]/page.tsx:39`

## Reply Form Implementation

### SupportReplyForm Component

**Component Type**: Client component with form state management → `src/components/support/support-reply-form.tsx:1`

**Props**:

- ticketId: string (required) → `src/components/support/support-reply-form.tsx:7`

**State Management**:

- body: Message text state → `src/components/support/support-reply-form.tsx:8`
- pending: Transition state for async operations → `src/components/support/support-reply-form.tsx:9`

**Form Fields**:

- **Textarea**: 4 rows, full width, with placeholder "Upišite odgovor računovođi..." → `src/components/support/support-reply-form.tsx:42-48`
- **Submit Button**: Disabled during pending state, shows "Slanje..." when loading → `src/components/support/support-reply-form.tsx:50-52`

**Submission Flow**:

1. Form submit triggers transition → `src/components/support/support-reply-form.tsx:13`
2. POST request to /api/support/tickets/:id/messages → `src/components/support/support-reply-form.tsx:15`
3. Request includes trimmed message body → `src/components/support/support-reply-form.tsx:21`
4. On success: success toast and input clear → `src/components/support/support-reply-form.tsx:32-33`
5. On error: error toast with message → `src/components/support/support-reply-form.tsx:28, 35`

**Toast Notifications**:

- Success: "Poruka poslana" / "Odgovor primljen od računovodstva" → `src/components/support/support-reply-form.tsx:32`
- Error: "Greška" / Error message or "Nije uspjelo slanje poruke" → `src/components/support/support-reply-form.tsx:28, 35`

## Database Schema

### SupportTicketMessage Model

**Table**: SupportTicketMessage → `prisma/schema.prisma:760`

**Fields**:

- id: String (CUID primary key) → `prisma/schema.prisma:761`
- ticketId: String (foreign key to SupportTicket) → `prisma/schema.prisma:762`
- authorId: String (nullable, references User) → `prisma/schema.prisma:763`
- body: String (message content) → `prisma/schema.prisma:764`
- createdAt: DateTime (auto-generated timestamp) → `prisma/schema.prisma:765`

**Relations**:

- ticket: SupportTicket (many-to-one, cascade delete) → `prisma/schema.prisma:766`

**Indexes**:

- ticketId: Indexed for efficient message lookups → `prisma/schema.prisma:768`

**Migration**: Created in 20251213_add_support_tickets → `prisma/migrations/20251213_add_support_tickets/migration.sql:24-32`

**Cascade Behavior**: Messages deleted when parent ticket is deleted → `prisma/migrations/20251213_add_support_tickets/migration.sql:50`

## Server Actions Alternative

### addSupportTicketMessage Function

**Location**: `src/app/actions/support-ticket.ts:303-353`

**Purpose**: Server action alternative to API route for message creation

**Input Schema**: addSupportMessageSchema with body validation → `src/app/actions/support-ticket.ts:33-35`

**Validation**:

- Body: min 1 char, max 5000 chars → `src/app/actions/support-ticket.ts:34`
- Custom error messages in Croatian → `src/app/actions/support-ticket.ts:34`

**Implementation Flow**:

1. Require authentication → `src/app/actions/support-ticket.ts:305`
2. Run with company context (tenant isolation) → `src/app/actions/support-ticket.ts:307`
3. Verify ticket exists and belongs to company → `src/app/actions/support-ticket.ts:309-316`
4. Validate input with Zod schema → `src/app/actions/support-ticket.ts:318`
5. Create message with trimmed body → `src/app/actions/support-ticket.ts:320-326`
6. Update ticket's updatedAt timestamp → `src/app/actions/support-ticket.ts:329-332`
7. Log operation to audit trail → `src/app/actions/support-ticket.ts:334-340`
8. Return success with message data → `src/app/actions/support-ticket.ts:342`

**Error Handling**:

- Zod validation errors: Return detailed issues → `src/app/actions/support-ticket.ts:347-348`
- Generic errors: Logged and returned as failure → `src/app/actions/support-ticket.ts:345, 350`

**Logging**: Includes userId, companyId, ticketId, messageId, operation → `src/app/actions/support-ticket.ts:334-340`

## Security Features

### Tenant Isolation

**Company Verification**: All requests verify ticket belongs to user's company → `src/app/api/support/tickets/[id]/messages/route.ts:25-32`

**Query Filtering**: Ticket lookup includes companyId filter → `src/app/api/support/tickets/[id]/messages/route.ts:26`

**Author Attribution**: Messages automatically attributed to authenticated user → `src/app/api/support/tickets/[id]/messages/route.ts:42`

**Context Enforcement**: Server action uses requireCompanyWithContext → `src/app/actions/support-ticket.ts:307`

### Authentication

**User Validation**: getCurrentUser checks session → `src/app/api/support/tickets/[id]/messages/route.ts:15`

**Unauthorized Response**: Returns 401 if user not authenticated → `src/app/api/support/tickets/[id]/messages/route.ts:17`

**Company Requirement**: getCurrentCompany ensures user has company → `src/app/api/support/tickets/[id]/messages/route.ts:20`

**No Company Response**: Returns 404 if company not found → `src/app/api/support/tickets/[id]/messages/route.ts:22`

### Input Validation

**Zod Schema**: messageSchema validates request body → `src/app/api/support/tickets/[id]/messages/route.ts:6-8`

**Minimum Length**: Body must have at least 1 character → `src/app/api/support/tickets/[id]/messages/route.ts:7`

**Trimming**: Message body trimmed before storage → `src/app/api/support/tickets/[id]/messages/route.ts:43`

**Safe Parse**: Uses safeParse to prevent exceptions → `src/app/api/support/tickets/[id]/messages/route.ts:34`

**Error Messages**: Croatian error messages for validation failures → `src/app/api/support/tickets/[id]/messages/route.ts:36`

## Real-Time Updates

**Update Strategy**: Manual page refresh after message submission (no WebSocket/SSE)

**Optimistic UI**: Form clears immediately after successful POST → `src/components/support/support-reply-form.tsx:33`

**Timestamp Updates**: Ticket updatedAt field updated on each message → `src/app/api/support/tickets/[id]/messages/route.ts:47-50`

**Server-Side Rendering**: Page fetches latest messages on each load → `src/app/(dashboard)/support/[id]/page.tsx:34-44`

**No Polling**: Current implementation requires manual refresh to see new messages

**Future Enhancement**: Toast suggests manual refresh ("Osvježite da vidite promjenu") → `src/components/support/support-assign-button.tsx:38`

## Integration Points

### Ticket Detail Page

**Page Location**: /support/:id → `src/app/(dashboard)/support/[id]/page.tsx:30`

**Message Display**: Messages section within card layout → `src/app/(dashboard)/support/[id]/page.tsx:83-107`

**Reply Form**: Embedded at bottom of messages section → `src/app/(dashboard)/support/[id]/page.tsx:105`

**Related Features**: Status buttons, assign button, ticket metadata → `src/app/(dashboard)/support/[id]/page.tsx:69-80`

### Support Ticket Listing

**List Page**: /support → `src/app/(dashboard)/support/page.tsx:24`

**Latest Message**: Ticket list shows most recent message timestamp → `src/app/(dashboard)/support/page.tsx:39-43`

**Message Count**: Displayed in ticket summary (take 1, newest) → `src/app/(dashboard)/support/page.tsx:40-42`

**Sort Order**: Tickets sorted by updatedAt (reflects latest message) → `src/app/(dashboard)/support/page.tsx:30`

## API Endpoints Inventory

| Method | Path                              | Handler                                                 |
| ------ | --------------------------------- | ------------------------------------------------------- |
| POST   | /api/support/tickets/:id/messages | `src/app/api/support/tickets/[id]/messages/route.ts:10` |

**Endpoint Registration**: Listed in api-endpoints.json → `docs/_meta/inventory/api-endpoints.json:316-319`

**Related Endpoints**:

- GET/POST /api/support/tickets → `src/app/api/support/tickets/route.ts:13,52`
- PATCH /api/support/tickets/:id/status → `src/app/api/support/tickets/[id]/status/route.ts:11`

## Error Handling

### Client-Side Errors

**Network Failures**: Caught in try-catch, displays toast error → `src/components/support/support-reply-form.tsx:34-36`

**API Errors**: Parsed from response JSON, shown in toast → `src/components/support/support-reply-form.tsx:27-29`

**Validation Errors**: Displayed via toast with Croatian messages → `src/components/support/support-reply-form.tsx:28`

**User Feedback**: All errors show friendly messages in Croatian → `src/components/support/support-reply-form.tsx:28,35`

### Server-Side Errors

**Authentication Errors**: 401 with "Unauthorized" message → `src/app/api/support/tickets/[id]/messages/route.ts:17`

**Authorization Errors**: 404 with "No company" or "Ticket not found" → `src/app/api/support/tickets/[id]/messages/route.ts:22,31`

**Validation Errors**: 400 with "Neispravni podaci" → `src/app/api/support/tickets/[id]/messages/route.ts:36`

**Server Action Errors**: Logged with context and returned as failure → `src/app/actions/support-ticket.ts:345,350`

**Logging**: All errors logged with ticketId context → `src/app/actions/support-ticket.ts:345`

## UI/UX Features

### Message Styling

**Container**: Rounded border boxes with muted background → `src/app/(dashboard)/support/[id]/page.tsx:94`

**Header**: Flex layout with author and timestamp → `src/app/(dashboard)/support/[id]/page.tsx:95-98`

**Text**: Small muted text for metadata, normal for body → `src/app/(dashboard)/support/[id]/page.tsx:95-96,99`

**Whitespace**: Pre-wrap preserves line breaks in message body → `src/app/(dashboard)/support/[id]/page.tsx:99`

**Spacing**: Vertical spacing between messages (space-y-3) → `src/app/(dashboard)/support/[id]/page.tsx:92`

### Form User Experience

**Input Focus**: Ring animation on focus → `src/components/support/support-reply-form.tsx:47`

**Button States**: Disabled during submission, text changes to "Slanje..." → `src/components/support/support-reply-form.tsx:50-51`

**Transitions**: useTransition for smooth loading states → `src/components/support/support-reply-form.tsx:9`

**Auto-Clear**: Form clears on successful submission → `src/components/support/support-reply-form.tsx:33`

**Placeholder**: Helpful prompt "Upišite odgovor računovođi..." → `src/components/support/support-reply-form.tsx:45`

## Localization

**Language**: All UI text in Croatian (Serbian variant)

**Error Messages**: Validation errors in Croatian → `src/app/api/support/tickets/[id]/messages/route.ts:7,36`

**Toast Messages**: Success/error toasts in Croatian → `src/components/support/support-reply-form.tsx:32,28,35`

**Form Labels**: Placeholder and button text in Croatian → `src/components/support/support-reply-form.tsx:45,51`

**Timestamps**: Formatted using Croatian locale → `src/app/(dashboard)/support/[id]/page.tsx:97`

**Field Names**: Schema validation messages in Croatian → `src/app/actions/support-ticket.ts:34`
