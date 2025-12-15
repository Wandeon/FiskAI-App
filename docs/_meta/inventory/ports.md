# Ports Inventory

Last updated: 2025-12-15

## Summary

FiskAI uses the following network ports.

## Application Ports

| Port | Service              | Environment | Evidence         |
| ---- | -------------------- | ----------- | ---------------- |
| 3000 | Next.js (default)    | Development | Next.js default  |
| 3002 | Next.js (configured) | Production  | `.env.example:5` |

## Database Ports

| Port | Service    | Protocol | Evidence                        |
| ---- | ---------- | -------- | ------------------------------- |
| 5432 | PostgreSQL | TCP      | `.env.example:8` (DATABASE_URL) |

## External Service Ports (Outbound)

| Port | Service         | Protocol   | Evidence                                        |
| ---- | --------------- | ---------- | ----------------------------------------------- |
| 443  | Cloudflare R2   | HTTPS      | `src/lib/r2-client.ts:7`                        |
| 443  | OpenAI API      | HTTPS      | `src/lib/ai/ocr.ts:11`                          |
| 443  | Stripe API      | HTTPS      | `src/lib/billing/stripe.ts:13`                  |
| 443  | GoCardless API  | HTTPS      | `src/lib/bank-sync/providers/gocardless.ts:13`  |
| 443  | Resend API      | HTTPS      | `src/lib/email.ts:4`                            |
| 443  | PostHog         | HTTPS      | `src/lib/analytics.ts:4`                        |
| 443  | Sentry          | HTTPS      | `.env.example:68`                               |
| 443  | CRS (Porezna)   | HTTPS/SOAP | `docs/02_FEATURES/features/fiscal-fiscalize.md` |
| 443  | ie-racuni.hr    | HTTPS      | `src/lib/e-invoice/providers/ie-racuni.ts:30`   |
| 443  | Gmail API       | HTTPS      | `src/lib/email-sync/providers/gmail.ts`         |
| 443  | Microsoft Graph | HTTPS      | `src/lib/email-sync/providers/microsoft.ts`     |

## Docker Compose Configuration

```yaml
# From docker-compose configuration
services:
  fiskai:
    ports:
      - "${APP_PORT:-3002}:3000"

  fiskai-db:
    ports:
      - "5432:5432"
```

## Firewall Requirements

### Inbound (Production)

| Port      | Protocol | Source        | Purpose                           |
| --------- | -------- | ------------- | --------------------------------- |
| 443       | TCP      | Internet      | HTTPS traffic (via reverse proxy) |
| 3000/3002 | TCP      | Load balancer | Application server                |

### Outbound (Required)

| Destination                 | Port | Protocol | Purpose          |
| --------------------------- | ---- | -------- | ---------------- |
| \*.openai.com               | 443  | TCP      | AI/OCR features  |
| \*.stripe.com               | 443  | TCP      | Billing          |
| \*.gocardless.com           | 443  | TCP      | Bank sync        |
| \*.resend.com               | 443  | TCP      | Email            |
| \*.posthog.com              | 443  | TCP      | Analytics        |
| \*.sentry.io                | 443  | TCP      | Error tracking   |
| \*.r2.cloudflarestorage.com | 443  | TCP      | Document storage |
| cis.porezna-uprava.hr       | 443  | TCP      | Fiscalization    |

## Notes

- All external services communicate over HTTPS (port 443)
- Database connection should be internal/private network only
- Application port is configurable via `APP_PORT` environment variable
