# Runtime Inventory

Last updated: 2025-12-15

## Summary

FiskAI runs on **Node.js** with **Next.js 14+** App Router, deployed to **Vercel** or self-hosted via **Docker**.

## Application Runtime

| Property  | Value       | Evidence                       |
| --------- | ----------- | ------------------------------ |
| Framework | Next.js 14+ | `package.json`                 |
| Runtime   | Node.js     | Default Next.js runtime        |
| Router    | App Router  | `src/app/` directory structure |
| Language  | TypeScript  | `tsconfig.json`                |

## API Routes (72 total)

### Authentication (4 routes)

| Route                           | Method    | Purpose                       |
| ------------------------------- | --------- | ----------------------------- |
| `/api/auth/[...nextauth]`       | GET, POST | NextAuth.js handlers          |
| `/api/webauthn/register/start`  | POST      | Passkey registration start    |
| `/api/webauthn/register/finish` | POST      | Passkey registration complete |
| `/api/webauthn/login/start`     | POST      | Passkey login start           |
| `/api/webauthn/login/finish`    | POST      | Passkey login complete        |
| `/api/webauthn/passkeys`        | GET, POST | List/manage passkeys          |
| `/api/webauthn/passkeys/[id]`   | DELETE    | Remove passkey                |

### AI Features (4 routes)

| Route                      | Method | Purpose                |
| -------------------------- | ------ | ---------------------- |
| `/api/ai/extract`          | POST   | Receipt OCR extraction |
| `/api/ai/feedback`         | POST   | Extraction feedback    |
| `/api/ai/usage`            | GET    | Usage statistics       |
| `/api/ai/suggest-category` | POST   | Category suggestions   |

### Billing (3 routes)

| Route                   | Method | Purpose                 |
| ----------------------- | ------ | ----------------------- |
| `/api/billing/checkout` | POST   | Create checkout session |
| `/api/billing/portal`   | POST   | Customer portal         |
| `/api/billing/webhook`  | POST   | Stripe webhooks         |

### Banking (3 routes)

| Route                  | Method | Purpose                  |
| ---------------------- | ------ | ------------------------ |
| `/api/bank/connect`    | POST   | Initiate bank connection |
| `/api/bank/callback`   | GET    | OAuth callback           |
| `/api/bank/disconnect` | POST   | Remove connection        |

### Email (2 routes)

| Route                 | Method | Purpose               |
| --------------------- | ------ | --------------------- |
| `/api/email/connect`  | POST   | Connect email account |
| `/api/email/callback` | GET    | OAuth callback        |

### Cron Jobs (3 routes)

| Route                        | Method | Purpose                 |
| ---------------------------- | ------ | ----------------------- |
| `/api/cron/bank-sync`        | POST   | Daily bank sync         |
| `/api/cron/email-sync`       | POST   | Daily email sync        |
| `/api/cron/fiscal-processor` | POST   | Fiscal queue processing |

### Health & Status (3 routes)

| Route               | Method | Purpose         |
| ------------------- | ------ | --------------- |
| `/api/health`       | GET    | Liveness probe  |
| `/api/health/ready` | GET    | Readiness probe |
| `/api/status`       | GET    | System status   |

### Other Routes (50+ routes)

See `src/app/api/` for complete list including:

- Invoice operations
- Receipt handling
- Import/export
- Reports
- Support tickets
- Admin functions
- Webhooks

## Server Actions (8 files)

| File                                | Purpose                | Evidence                           |
| ----------------------------------- | ---------------------- | ---------------------------------- |
| `src/app/actions/auth.ts`           | Authentication actions | Password reset, email verification |
| `src/app/actions/company.ts`        | Company management     | Create, update, delete             |
| `src/app/actions/contact.ts`        | Contact management     | CRUD operations                    |
| `src/app/actions/e-invoice.ts`      | E-invoice operations   | Create, send, fiscalize            |
| `src/app/actions/expense.ts`        | Expense operations     | CRUD, categorization               |
| `src/app/actions/invoice.ts`        | Invoice operations     | CRUD, PDF generation               |
| `src/app/actions/product.ts`        | Product management     | CRUD operations                    |
| `src/app/actions/support-ticket.ts` | Support operations     | Tickets, messages                  |

## Middleware

| File                | Purpose                    | Evidence         |
| ------------------- | -------------------------- | ---------------- |
| `src/middleware.ts` | Auth protection, redirects | Route protection |

## Edge Runtime

No routes use Edge Runtime. All routes run on Node.js runtime.

## Background Processing

| Type      | Platform                 | Evidence      |
| --------- | ------------------------ | ------------- |
| Cron Jobs | Vercel Cron              | `vercel.json` |
| Queues    | None (inline processing) | -             |
| Workers   | None                     | -             |

## Deployment Targets

### Vercel (Primary)

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/bank-sync", "schedule": "0 5 * * *" },
    { "path": "/api/cron/email-sync", "schedule": "0 5 * * *" }
  ]
}
```

### Docker (Self-hosted)

```dockerfile
# Dockerfile exists for self-hosted deployment
FROM node:20-alpine
# ... build and run Next.js
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  fiskai:
    build: .
    ports:
      - "${APP_PORT:-3002}:3000"
  fiskai-db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
```

## Memory & Performance

| Setting         | Value                   | Notes                            |
| --------------- | ----------------------- | -------------------------------- |
| Node heap       | Default                 | No custom `--max-old-space-size` |
| Connection pool | pg Pool                 | `src/lib/db.ts:11`               |
| Request timeout | 10s (hobby) / 60s (pro) | Vercel limits                    |
| Body size limit | 4.5MB                   | Vercel default                   |

## Environment Detection

```typescript
// src/lib/logger.ts:5
const isDev = process.env.NODE_ENV !== "production"

// Used for:
// - Log levels
// - Cookie security
// - Error details
// - Mock providers
```
