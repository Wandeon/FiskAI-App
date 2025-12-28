# Staff Portal

> **Last Updated:** 2025-12-28
> **Status:** Partial Implementation
> **Portal URL:** `staff.fiskai.hr`

---

## Overview

The Staff Portal is designed to be a multi-client workspace for accountants and bookkeepers who manage multiple client companies. It provides staff members with a unified interface to access all their assigned clients without needing separate logins.

---

## Implementation Status

### What's Implemented

#### Routes (2 pages)

| Route              | Component                          | Status      |
| ------------------ | ---------------------------------- | ----------- |
| `/staff-dashboard` | `src/components/staff/dashboard.tsx` | Implemented |
| `/clients`         | `src/components/staff/clients-list.tsx` | Implemented |

#### Layout & Navigation

| Component                | Path                                          | Status      |
| ------------------------ | --------------------------------------------- | ----------- |
| Staff Layout             | `src/app/(staff)/layout.tsx`                  | Implemented |
| Staff Sidebar            | `src/components/staff/sidebar.tsx`            | Implemented |
| Staff Header             | `src/components/staff/header.tsx`             | Implemented |
| Staff Client Provider    | `src/components/staff/staff-client-provider.tsx` | Shell only  |
| Staff Client Context     | `src/contexts/staff-client-context.tsx`       | Implemented |

#### API Endpoints

| Endpoint                          | Method | Purpose                      | Status      |
| --------------------------------- | ------ | ---------------------------- | ----------- |
| `/api/staff/clients`              | GET    | List assigned clients        | Implemented |
| `/api/staff/clients/[companyId]`  | GET    | Get single client details    | Implemented |

#### Authentication & Authorization

- **Layout-level auth check:** Requires STAFF or ADMIN systemRole
- **Non-staff redirect:** Users without STAFF/ADMIN role redirected to `/dashboard`
- **API route protection:** Both endpoints verify STAFF/ADMIN role
- **Assignment verification:** Staff can only access companies they're assigned to (ADMIN bypasses)

#### Dashboard Features

| Feature                | Description                                       | Status      |
| ---------------------- | ------------------------------------------------- | ----------- |
| Assigned Clients Count | Shows number of companies assigned to staff member | Implemented |
| Pending Tickets Count  | Shows accounting-related open support tickets     | Implemented |
| Upcoming Deadlines     | Placeholder (returns 0)                           | Stub only   |
| Items Need Attention   | Hardcoded to 0                                    | Stub only   |
| Recent Activity        | Shows recent staff assignments                    | Implemented |

#### Client List Features

| Feature               | Description                                    | Status      |
| --------------------- | ---------------------------------------------- | ----------- |
| Client Cards          | Display client name, OIB, invoice/expense counts | Implemented |
| Open Ticket Badges    | Red badge showing open support tickets per client | Implemented |
| Client Search         | Search input present but not wired             | UI only     |
| Empty State           | Message when no clients assigned               | Implemented |

---

### What's Missing

#### Missing Pages (Navigation links exist, pages don't)

| Route        | Expected Functionality                              | Status  |
| ------------ | --------------------------------------------------- | ------- |
| `/clients/[id]` | Client detail view with company info, actions    | Missing |
| `/calendar`  | Shared calendar with deadlines across all clients   | Missing |
| `/tasks`     | Task management for accountant workflows            | Missing |
| `/tickets`   | Support tickets filtered to assigned clients        | Missing |
| `/documents` | Document management across clients                  | Missing |
| `/settings`  | Staff-specific settings                             | Missing |

#### Missing Multi-Client Features

| Feature                      | Description                                        | Priority |
| ---------------------------- | -------------------------------------------------- | -------- |
| Client Context Integration   | Layout uses shell provider, not actual context     | High     |
| Client Switching UX          | Select client and work in their context            | High     |
| Batch Operations             | Perform actions across multiple clients at once    | Medium   |
| Aggregated Financial Views   | Combined P&L, VAT summary across all clients       | Medium   |
| Cross-Client Search          | Search invoices/expenses across all clients        | Medium   |

#### Missing Accountant Workflows

| Workflow                     | Description                                        | Priority |
| ---------------------------- | -------------------------------------------------- | -------- |
| Monthly Close Checklist      | Guided steps for closing books per client          | High     |
| VAT Return Preparation       | Multi-client VAT aggregation and submission        | High     |
| Year-End Processing          | Annual reports and filings for all clients         | Medium   |
| Document Collection          | Request missing documents from clients             | Medium   |
| Client Communication Log     | Track interactions and notes per client            | Low      |

---

## Technical Architecture

### Database Schema

```prisma
model StaffAssignment {
  id         String   @id @default(cuid())
  staffId    String
  companyId  String
  assignedAt DateTime @default(now())
  notes      String?
  staff      User     @relation(fields: [staffId], references: [id])
  company    Company  @relation(fields: [companyId], references: [id])
  @@unique([staffId, companyId])
}
```

### Context Architecture

The `StaffClientContext` provides:
- `currentClient` - Currently selected client (null = overview mode)
- `switchClient(clientId)` - Fetch client details and navigate
- `clearClient()` - Return to staff dashboard overview
- `isWorkingOnClient` - Boolean indicating if working on specific client

### Authorization Flow

```
Request → Middleware (subdomain routing)
    ↓
Staff Layout (auth check)
    ↓
Check session.user.systemRole === "STAFF" | "ADMIN"
    ↓
If not: redirect to /dashboard
If yes: render staff portal
    ↓
API calls verify assignment before data access
```

---

## Gap Analysis Summary

### Current State (30% Complete)

**Implemented:**
- Basic scaffold with layout, sidebar, header
- Authentication and authorization
- Dashboard with stats (mostly stubs)
- Client list with basic info
- API endpoints for client data
- Client switching context infrastructure

**Not Implemented:**
- Any page beyond dashboard and client list
- Client detail/editing views
- Multi-client batch operations
- Aggregated financial views
- Accountant-specific workflows
- Search functionality
- Deadline tracking
- Real "attention items" detection

### Recommended Priority

1. **P0 - Core Navigation:** Add missing pages (client detail, calendar, tasks)
2. **P1 - Client Context:** Wire actual context provider into layout
3. **P2 - Workflows:** Monthly close checklist, VAT preparation
4. **P3 - Batch Ops:** Multi-client operations
5. **P4 - Analytics:** Aggregated views, cross-client search

---

## API Reference

### GET /api/staff/clients

List all companies assigned to the authenticated staff member.

**Authentication:** Required (STAFF or ADMIN systemRole)

**Request:** No body required

**Response (200):**
```json
[
  {
    "id": "clxxx...",
    "name": "Acme d.o.o.",
    "oib": "12345678901",
    "entitlements": ["invoicing", "expenses", "banking"],
    "subscriptionStatus": "active",
    "assignedAt": "2025-01-15T10:00:00.000Z",
    "notes": "Primary contact: Ivan"
  }
]
```

**Errors:**
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - User lacks STAFF/ADMIN role

**Source:** `src/app/api/staff/clients/route.ts`

---

### GET /api/staff/clients/[companyId]

Get detailed information for a specific assigned client.

**Authentication:** Required (STAFF or ADMIN systemRole)

**Path Parameters:**
- `companyId` (string) - Company UUID

**Response (200):**
```json
{
  "id": "clxxx...",
  "name": "Acme d.o.o.",
  "oib": "12345678901",
  "vatNumber": "HR12345678901",
  "address": "Ilica 1",
  "city": "Zagreb",
  "postalCode": "10000",
  "email": "info@acme.hr",
  "phone": "+385 1 1234567",
  "entitlements": ["invoicing", "expenses", "banking"],
  "subscriptionStatus": "active",
  "subscriptionPlan": "professional",
  "legalForm": "DOO",
  "isVatPayer": true
}
```

**Errors:**
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - User lacks STAFF/ADMIN role or not assigned to company
- `404 Not Found` - Company does not exist

**Source:** `src/app/api/staff/clients/[companyId]/route.ts`

---

## File References

| File | Purpose |
| ---- | ------- |
| `src/app/(staff)/layout.tsx` | Staff portal layout with auth |
| `src/app/(staff)/staff-dashboard/page.tsx` | Dashboard page |
| `src/app/(staff)/clients/page.tsx` | Clients list page |
| `src/components/staff/dashboard.tsx` | Dashboard component |
| `src/components/staff/clients-list.tsx` | Client list component |
| `src/components/staff/sidebar.tsx` | Navigation sidebar |
| `src/components/staff/header.tsx` | Portal header |
| `src/contexts/staff-client-context.tsx` | Client switching context |
| `src/app/api/staff/clients/route.ts` | List clients API |
| `src/app/api/staff/clients/[companyId]/route.ts` | Get client API |

---

## Changelog

| Date       | Change                              |
| ---------- | ----------------------------------- |
| 2025-12-28 | Initial documentation from audit   |
