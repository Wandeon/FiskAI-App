# External Integrations Inventory

Last updated: 2025-12-15

## Summary

FiskAI integrates with **15+ external services** for AI, payments, banking, government compliance, and infrastructure.

## Croatian Government Integrations

### Croatian Tax Authority (CRS/Porezna Uprava)

| Property       | Value                                           |
| -------------- | ----------------------------------------------- |
| Purpose        | Invoice fiscalization (fiskalizacija)           |
| Protocol       | SOAP over HTTPS                                 |
| Endpoint       | `https://cis.porezna-uprava.hr/`                |
| Authentication | P12 certificate (encrypted)                     |
| Evidence       | `docs/02_FEATURES/features/fiscal-fiscalize.md` |

**Data Flow**:

1. Invoice created with PENDING_FISCALIZATION status
2. XML request built with ZKI (protective code)
3. Signed with P12 certificate
4. Submitted to CRS SOAP endpoint
5. JIR (unique identifier) returned
6. Invoice updated with JIR and FISCALIZED status

### Croatian Business Registry (Sudski Registar)

| Property       | Value                             |
| -------------- | --------------------------------- |
| Purpose        | OIB validation and company lookup |
| Protocol       | REST API                          |
| Authentication | Client ID/Secret                  |
| Evidence       | `src/lib/oib-lookup.ts:34-35`     |

### ie-racuni.hr (E-Invoice Provider)

| Property | Value                                            |
| -------- | ------------------------------------------------ |
| Purpose  | E-invoice exchange (EN 16931)                    |
| Protocol | REST API                                         |
| Endpoint | `https://api.ie-racuni.hr/v1`                    |
| Evidence | `src/lib/e-invoice/providers/ie-racuni.ts:29-31` |

## AI/ML Integrations

### OpenAI

| Property | Value                            |
| -------- | -------------------------------- |
| Purpose  | Receipt OCR, document extraction |
| Model    | GPT-4 Vision                     |
| Endpoint | OpenAI API                       |
| Evidence | `src/lib/ai/ocr.ts:7-11`         |

**Usage**:

- Receipt image analysis
- Invoice data extraction
- Category suggestions

### DeepSeek (Alternative)

| Property | Value                       |
| -------- | --------------------------- |
| Purpose  | Alternative AI provider     |
| Evidence | `src/lib/ai/deepseek.ts:20` |

### Ollama (Self-hosted)

| Property | Value                                         |
| -------- | --------------------------------------------- |
| Purpose  | Local vision model                            |
| Model    | qwen3-vl (configurable)                       |
| Evidence | `src/app/api/import/process/route.ts:179-181` |

## Payment Integrations

### Stripe

| Property | Value                               |
| -------- | ----------------------------------- |
| Purpose  | Subscription billing                |
| Features | Checkout, Customer Portal, Webhooks |
| Evidence | `src/lib/billing/stripe.ts:13-174`  |

**Endpoints**:

- `POST /api/billing/checkout` - Create checkout session
- `POST /api/billing/portal` - Customer portal redirect
- `POST /api/billing/webhook` - Handle Stripe events

**Plans**:

- Pausalni (39 EUR/month)
- Standard (99 EUR/month)
- Pro (199 EUR/month)

## Banking Integrations

### GoCardless (Open Banking)

| Property | Value                                             |
| -------- | ------------------------------------------------- |
| Purpose  | Bank account connection and sync                  |
| Protocol | REST API                                          |
| Endpoint | `https://bankaccountdata.gocardless.com/api/v2`   |
| Evidence | `src/lib/bank-sync/providers/gocardless.ts:13-24` |

**Flow**:

1. User initiates connection
2. Redirect to bank authorization
3. Callback with requisition ID
4. Store encrypted credentials
5. Cron job syncs transactions daily

## Email Integrations

### Resend (Transactional Email)

| Property | Value                                     |
| -------- | ----------------------------------------- |
| Purpose  | Send invoices, notifications, auth emails |
| Features | Sending, webhooks (tracking)              |
| Evidence | `src/lib/email.ts:4-35`                   |

**Endpoints**:

- `POST /api/webhooks/resend` - Email tracking events

### Gmail API

| Property | Value                                         |
| -------- | --------------------------------------------- |
| Purpose  | Email import (invoices from inbox)            |
| Protocol | OAuth 2.0 + REST                              |
| Evidence | `src/lib/email-sync/providers/gmail.ts:11-33` |

### Microsoft Graph (Outlook)

| Property | Value                                            |
| -------- | ------------------------------------------------ |
| Purpose  | Outlook email import                             |
| Protocol | OAuth 2.0 + REST                                 |
| Evidence | `src/lib/email-sync/providers/microsoft.ts:3-25` |

## Storage Integrations

### Cloudflare R2

| Property | Value                        |
| -------- | ---------------------------- |
| Purpose  | Document and receipt storage |
| Protocol | S3-compatible API            |
| Evidence | `src/lib/r2-client.ts:7-14`  |

## Analytics & Monitoring

### PostHog

| Property | Value                      |
| -------- | -------------------------- |
| Purpose  | Product analytics          |
| Host     | EU (eu.i.posthog.com)      |
| Evidence | `src/lib/analytics.ts:3-4` |

### Sentry

| Property | Value                         |
| -------- | ----------------------------- |
| Purpose  | Error tracking and monitoring |
| Features | Error capture, source maps    |
| Evidence | `.env.example:68-73`          |

## Authentication Integrations

### Google OAuth

| Property | Value                   |
| -------- | ----------------------- |
| Purpose  | Social login            |
| Evidence | `src/lib/auth.ts:83-87` |

### WebAuthn/Passkeys

| Property | Value                       |
| -------- | --------------------------- |
| Purpose  | Passwordless authentication |
| Standard | FIDO2/WebAuthn              |
| Evidence | `src/lib/webauthn.ts:14-16` |

## Integration Status Matrix

| Integration | Required | Fallback            | Evidence               |
| ----------- | -------- | ------------------- | ---------------------- |
| PostgreSQL  | Yes      | None                | Core database          |
| OpenAI      | No       | Ollama, DeepSeek    | AI features degrade    |
| Stripe      | No       | Free tier only      | Billing disabled       |
| GoCardless  | No       | Manual import       | Bank sync disabled     |
| Resend      | No       | Console logging     | Emails not sent        |
| R2          | No       | Local storage (dev) | File uploads fail      |
| CRS         | No       | Mock provider       | Fiscalization disabled |
| PostHog     | No       | None                | Analytics disabled     |
| Sentry      | No       | Console errors      | No remote tracking     |

## Rate Limits

| Service    | Limit                      | Evidence                     |
| ---------- | -------------------------- | ---------------------------- |
| OpenAI     | Plan-based (20-5000/month) | `src/lib/ai/rate-limiter.ts` |
| GoCardless | Bank-dependent             | Provider docs                |
| Resend     | Plan-based                 | Provider docs                |
| Stripe     | 100 req/s                  | Provider docs                |
