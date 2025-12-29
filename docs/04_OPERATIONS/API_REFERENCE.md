# API Reference

## Overview

FiskAI exposes a REST API for all client operations. All authenticated endpoints require a valid session cookie from NextAuth.

**Base URL:** `https://fiskai.hr/api` (or `https://app.fiskai.hr/api` for client app)

**Authentication:** Session-based via NextAuth. Include credentials in requests.

---

## Authentication Endpoints

### POST /api/auth/register

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securepassword123"
}
```

**Validation:**
- `email`: Valid email format, unique
- `name`: Minimum 2 characters
- `password`: Minimum 8 characters

**Response (201):**
```json
{
  "success": true,
  "userId": "clxxx..."
}
```

**Errors:**
- `400`: Invalid data or email already in use
- `500`: Server error

---

### POST /api/auth/send-code

Send verification code to email for password reset or verification.

### POST /api/auth/verify-code

Verify the code sent to email.

### POST /api/auth/reset-password

Reset password after code verification.

### GET /api/auth/check-email

Check if email is already registered.

---

## Banking Endpoints

### POST /api/banking/import/upload

Upload a bank statement file for processing.

**Content-Type:** `multipart/form-data`

**Parameters:**
- `file`: PDF or XML bank statement (max 20MB)
- `accountId`: Bank account ID to associate with
- `overwrite`: `"true"` to overwrite existing duplicate

**Response (200):**
```json
{
  "success": true,
  "jobId": "clxxx...",
  "status": "PENDING",
  "tierUsed": "XML",
  "message": "Upload received. Processing will continue in the background."
}
```

**Response (409 - Duplicate):**
```json
{
  "success": false,
  "requiresOverwrite": true,
  "existingJobId": "clxxx...",
  "message": "Izvod s istim sadrzajem vec postoji. Prepisi?"
}
```

**Errors:**
- `400`: Missing file, invalid account, unsupported file type
- `404`: Company not found
- `413`: File too large (>20MB)

---

### GET /api/banking/import/jobs/[id]

Get import job status and details.

### GET /api/banking/import/jobs/[id]/status

Get processing status of an import job.

### GET /api/banking/import/jobs/[id]/file

Download the original uploaded file.

### POST /api/banking/import/process

Trigger processing of a pending import job.

---

### GET /api/banking/reconciliation

Get reconciliation data for bank transactions.

### POST /api/banking/reconciliation/match

Match a bank transaction to an invoice or expense.

---

## E-Invoice Endpoints

### GET /api/e-invoices/inbox

Get received e-invoices pending action.

**Response (200):**
```json
{
  "invoices": [
    {
      "id": "clxxx...",
      "invoiceNumber": "R-2024-001",
      "status": "DELIVERED",
      "totalAmount": 1250.00,
      "currency": "EUR",
      "lines": [...],
      "buyer": {...}
    }
  ],
  "count": 5
}
```

---

### POST /api/e-invoices/inbox?invoiceId={id}

Accept or reject a received e-invoice.

**Request Body:**
```json
{
  "accept": true,
  "reason": "Optional reason for rejection"
}
```

**Response (200):**
```json
{
  "success": true,
  "invoice": {...},
  "message": "E-invoice accepted successfully"
}
```

**Errors:**
- `400`: Missing invoiceId or invalid data
- `404`: Invoice not found or already processed

---

### PATCH /api/e-invoices/inbox?invoiceId={id}&action={archive|unarchive}

Archive or unarchive an e-invoice.

---

### POST /api/e-invoices/receive

Webhook endpoint for receiving e-invoices from providers.

---

## AI Assistant Endpoints

### POST /api/assistant/chat

Send a message to the AI assistant.

### POST /api/assistant/chat/stream

Streaming chat response from AI assistant.

### POST /api/assistant/chat/reasoning

Chat with extended reasoning capability.

### POST /api/assistant/reason

Direct reasoning query without conversation context.

---

## AI Extraction Endpoints

### POST /api/ai/extract

Extract data from uploaded documents (invoices, receipts).

### POST /api/ai/suggest-category

Get AI-suggested expense category.

### POST /api/ai/feedback

Submit feedback on AI extraction quality.

### GET /api/ai/usage

Get AI usage statistics for the company.

---

## News Endpoints

### GET /api/news

Get all published news articles.

### GET /api/news/latest

Get most recent news articles.

### GET /api/news/posts

Get paginated news posts.

### GET /api/news/posts/[slug]

Get a specific news article by slug.

### GET /api/news/categories

Get available news categories.

---

## Guidance System Endpoints

### GET /api/guidance/checklist

Get user's compliance checklist with status.

### GET /api/guidance/preferences

Get guidance preferences for the user.

### PATCH /api/guidance/preferences

Update guidance preferences.

### GET /api/guidance/insights

Get personalized regulatory insights.

---

## Deadlines Endpoints

### GET /api/deadlines

Get all compliance deadlines for the company.

### GET /api/deadlines/upcoming

Get upcoming deadlines within a specified window.

---

## Notifications Endpoints

### GET /api/notifications

Get user notifications.

### POST /api/notifications/read

Mark notifications as read.

---

## Export Endpoints

### GET /api/exports/season-pack

Export all company data for a period.

**Query Parameters:**
- `from`: Start date (YYYY-MM-DD)
- `to`: End date (YYYY-MM-DD)

**Response:** ZIP file containing:
- Invoices (CSV + PDF)
- Expenses (CSV)
- KPR (Knjiga Primitaka i Izdataka)
- Summary with totals

---

## Health & Metrics Endpoints

### GET /api/health

Liveness probe. Returns 200 if application is alive.

### GET /api/health/ready

Readiness probe. Returns 200 if ready to accept traffic, 503 if not.

### GET /api/status

Detailed system status including version, uptime, and metrics.

### GET /api/metrics

Prometheus-compatible metrics endpoint.

---

## Admin Endpoints

> These endpoints require ADMIN system role.

### GET /api/admin/staff

List all staff members.

### POST /api/admin/staff

Create a new staff member.

### GET /api/admin/staff/[userId]

Get staff member details.

### PATCH /api/admin/staff/[userId]

Update staff member.

### DELETE /api/admin/staff/[userId]

Remove staff member.

---

### GET /api/admin/support/dashboard

Get support dashboard metrics.

### POST /api/admin/send-digest

Trigger manual digest email send.

---

## Cron Endpoints

> These endpoints are triggered by scheduled jobs.

| Endpoint | Purpose | Schedule |
|----------|---------|----------|
| `/api/cron/fetch-news` | Fetch regulatory news | Every 6 hours |
| `/api/cron/deadline-reminders` | Send deadline reminders | Daily at 8 AM |
| `/api/cron/certificate-check` | Check certificate expiry | Weekly |
| `/api/cron/bank-sync` | Sync bank connections | Every 4 hours |
| `/api/cron/fiscal-processor` | Process fiscal queue | Every 5 minutes |
| `/api/cron/email-sync` | Sync email imports | Every hour |
| `/api/cron/weekly-digest` | Send weekly summary | Sunday at 6 PM |
| `/api/cron/checklist-digest` | Send checklist updates | Daily at 9 AM |

---

## Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "details": [...] // Optional: validation errors
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized (not logged in)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `409`: Conflict (duplicate resource)
- `413`: Payload Too Large
- `500`: Internal Server Error

---

## Rate Limiting

API endpoints are rate-limited:
- **Standard endpoints:** 100 requests/minute per user
- **AI endpoints:** 20 requests/minute per user
- **Upload endpoints:** 10 requests/minute per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```
