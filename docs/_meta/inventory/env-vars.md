# Environment Variables Inventory

Last updated: 2025-12-15

## Summary

FiskAI uses **58 environment variables** across multiple categories. All variables are documented in `.env.example`.

## Required Variables

### Database

| Variable            | Purpose                      | Evidence           |
| ------------------- | ---------------------------- | ------------------ |
| `DATABASE_URL`      | PostgreSQL connection string | `src/lib/db.ts:11` |
| `POSTGRES_USER`     | Database username            | `.env.example:2`   |
| `POSTGRES_PASSWORD` | Database password            | `.env.example:3`   |
| `POSTGRES_DB`       | Database name                | `.env.example:4`   |

### Authentication

| Variable              | Purpose                         | Evidence                                           |
| --------------------- | ------------------------------- | -------------------------------------------------- |
| `NEXTAUTH_URL`        | Base URL for NextAuth callbacks | `src/lib/auth.ts:83`, `src/app/actions/auth.ts:41` |
| `NEXTAUTH_SECRET`     | JWT signing secret (32+ chars)  | `.env.example:10`                                  |
| `EINVOICE_KEY_SECRET` | E-invoice encryption key        | `src/lib/secrets.ts:3`                             |

### Application

| Variable               | Purpose                    | Evidence                                      |
| ---------------------- | -------------------------- | --------------------------------------------- |
| `NEXT_PUBLIC_APP_NAME` | Display name (FiskAI)      | `.env.example:11`                             |
| `NEXT_PUBLIC_APP_URL`  | Public-facing URL          | `src/app/sitemap.ts:4`, `src/app/robots.ts:4` |
| `APP_PORT`             | Server port (default 3002) | `.env.example:5`                              |
| `NODE_ENV`             | Runtime environment        | `src/lib/logger.ts:5`                         |
| `LOG_LEVEL`            | Pino log level             | `src/lib/logger.ts:10`                        |

## Optional Variables

### AI/OCR Features

| Variable              | Purpose                 | Evidence                                               |
| --------------------- | ----------------------- | ------------------------------------------------------ |
| `OPENAI_API_KEY`      | GPT-4 Vision OCR        | `src/lib/ai/ocr.ts:7-11`, `src/lib/ai/extract.ts:7-11` |
| `DEEPSEEK_API_KEY`    | Alternative AI provider | `src/lib/ai/deepseek.ts:20`                            |
| `OLLAMA_API_KEY`      | Local Ollama instance   | `src/app/api/import/process/route.ts:179`              |
| `OLLAMA_BASE_URL`     | Ollama API endpoint     | `src/app/api/import/process/route.ts:180`              |
| `OLLAMA_VISION_MODEL` | Vision model name       | `src/app/api/import/process/route.ts:181`              |

### Email (Resend)

| Variable                | Purpose                 | Evidence                                  |
| ----------------------- | ----------------------- | ----------------------------------------- |
| `RESEND_API_KEY`        | Resend email service    | `src/lib/email.ts:4`                      |
| `RESEND_FROM_EMAIL`     | Sender address          | `src/lib/email.ts:35`                     |
| `RESEND_WEBHOOK_SECRET` | Email tracking webhooks | `src/app/api/webhooks/resend/route.ts:10` |

### Analytics (PostHog)

| Variable                   | Purpose             | Evidence                 |
| -------------------------- | ------------------- | ------------------------ |
| `NEXT_PUBLIC_POSTHOG_KEY`  | PostHog project key | `src/lib/analytics.ts:3` |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host URL    | `src/lib/analytics.ts:4` |

### Error Tracking (Sentry)

| Variable                 | Purpose                 | Evidence          |
| ------------------------ | ----------------------- | ----------------- |
| `SENTRY_DSN`             | Server-side DSN         | `.env.example:68` |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side DSN         | `.env.example:69` |
| `SENTRY_ORG`             | Organization slug       | `.env.example:70` |
| `SENTRY_PROJECT`         | Project name            | `.env.example:71` |
| `SENTRY_AUTH_TOKEN`      | Source map upload token | `.env.example:73` |

### WebAuthn/Passkeys

| Variable           | Purpose            | Evidence                 |
| ------------------ | ------------------ | ------------------------ |
| `WEBAUTHN_RP_ID`   | Relying Party ID   | `src/lib/webauthn.ts:14` |
| `WEBAUTHN_RP_NAME` | Relying Party name | `src/lib/webauthn.ts:15` |

### Bank Sync (GoCardless)

| Variable                | Purpose            | Evidence                                       |
| ----------------------- | ------------------ | ---------------------------------------------- |
| `BANK_SYNC_PROVIDER`    | Provider selection | `src/lib/bank-sync/providers/index.ts:11`      |
| `GOCARDLESS_SECRET_ID`  | API credentials    | `src/lib/bank-sync/providers/gocardless.ts:23` |
| `GOCARDLESS_SECRET_KEY` | API credentials    | `src/lib/bank-sync/providers/gocardless.ts:24` |
| `GOCARDLESS_BASE_URL`   | API endpoint       | `src/lib/bank-sync/providers/gocardless.ts:13` |

### Email Import

| Variable                  | Purpose       | Evidence                                                         |
| ------------------------- | ------------- | ---------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`        | Gmail OAuth   | `src/lib/auth.ts:86`, `src/lib/email-sync/providers/gmail.ts:11` |
| `GOOGLE_CLIENT_SECRET`    | Gmail OAuth   | `src/lib/auth.ts:87`, `src/lib/email-sync/providers/gmail.ts:12` |
| `MICROSOFT_CLIENT_ID`     | Outlook OAuth | `src/lib/email-sync/providers/microsoft.ts:13`                   |
| `MICROSOFT_CLIENT_SECRET` | Outlook OAuth | `src/lib/email-sync/providers/microsoft.ts:14`                   |

### Storage (Cloudflare R2)

| Variable               | Purpose            | Evidence                  |
| ---------------------- | ------------------ | ------------------------- |
| `R2_ACCOUNT_ID`        | Cloudflare account | `src/lib/r2-client.ts:7`  |
| `R2_ACCESS_KEY_ID`     | R2 credentials     | `src/lib/r2-client.ts:9`  |
| `R2_SECRET_ACCESS_KEY` | R2 credentials     | `src/lib/r2-client.ts:10` |
| `R2_BUCKET_NAME`       | Storage bucket     | `src/lib/r2-client.ts:14` |

### Fiscalization

| Variable          | Purpose                               | Evidence                                  |
| ----------------- | ------------------------------------- | ----------------------------------------- |
| `FISCAL_CERT_KEY` | Certificate encryption (32 bytes hex) | `.env.example:57`                         |
| `FISCAL_PROVIDER` | Provider selection (mock/crs)         | `src/lib/e-invoice/fiscal-provider.ts:12` |

### E-Invoice Provider

| Variable            | Purpose               | Evidence                                      |
| ------------------- | --------------------- | --------------------------------------------- |
| `IE_RACUNI_API_KEY` | ie-racuni.hr API      | `src/lib/e-invoice/providers/ie-racuni.ts:29` |
| `IE_RACUNI_API_URL` | ie-racuni.hr endpoint | `src/lib/e-invoice/providers/ie-racuni.ts:30` |
| `IE_RACUNI_SANDBOX` | Sandbox mode flag     | `src/lib/e-invoice/providers/ie-racuni.ts:31` |

### Billing (Stripe)

| Variable                | Purpose                | Evidence                        |
| ----------------------- | ---------------------- | ------------------------------- |
| `STRIPE_SECRET_KEY`     | Stripe API key         | `src/lib/billing/stripe.ts:13`  |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification   | `src/lib/billing/stripe.ts:174` |
| `STRIPE_PRICE_PAUSALNI` | Pausalni plan price ID | `src/lib/billing/stripe.ts:32`  |
| `STRIPE_PRICE_STANDARD` | Standard plan price ID | `src/lib/billing/stripe.ts:39`  |
| `STRIPE_PRICE_PRO`      | Pro plan price ID      | `src/lib/billing/stripe.ts:46`  |

### Cron Jobs

| Variable      | Purpose                   | Evidence                                 |
| ------------- | ------------------------- | ---------------------------------------- |
| `CRON_SECRET` | Vercel cron authorization | `src/app/api/cron/bank-sync/route.ts:11` |

### Admin

| Variable         | Purpose                  | Evidence                            |
| ---------------- | ------------------------ | ----------------------------------- |
| `ADMIN_PASSWORD` | Admin panel access       | `src/app/api/admin/auth/route.ts:4` |
| `ADMIN_EMAILS`   | Allowlisted admin emails | `src/lib/admin.ts:3`                |

### OIB Lookup

| Variable                        | Purpose                    | Evidence                   |
| ------------------------------- | -------------------------- | -------------------------- |
| `SUDSKI_REGISTAR_CLIENT_ID`     | Croatian business registry | `src/lib/oib-lookup.ts:34` |
| `SUDSKI_REGISTAR_CLIENT_SECRET` | Registry credentials       | `src/lib/oib-lookup.ts:35` |

## Generation Commands

```bash
# Generate secrets
openssl rand -hex 32  # For NEXTAUTH_SECRET, EINVOICE_KEY_SECRET, FISCAL_CERT_KEY, CRON_SECRET
```

## Validation

All required variables must be set for production deployment. The application will fail to start without:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
