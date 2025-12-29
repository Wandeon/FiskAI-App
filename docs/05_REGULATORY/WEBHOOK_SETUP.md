# Webhook & Push Notification Setup Guide

> **Canonical Reference** - Created: 2025-12-29
>
> This document provides setup instructions for webhook and push notification subscriptions for regulatory sources.

## Table of Contents

1. [Overview](#overview)
2. [Webhook Infrastructure](#webhook-infrastructure)
3. [Supported Sources](#supported-sources)
4. [Setup Instructions](#setup-instructions)
5. [Testing & Debugging](#testing--debugging)
6. [Security](#security)

---

## Overview

The Regulatory Truth Layer now supports real-time discovery through webhooks and push notifications, in addition to scheduled polling. This enables:

- **Immediate discovery** of regulatory changes
- **Reduced polling load** on government servers
- **Lower latency** between publication and ingestion
- **Event-driven processing** for time-sensitive updates

### Discovery Triggers (Complete List)

1. **Scheduled Polling** - Daily cron jobs (06:00 Europe/Zagreb)
2. **Adaptive Re-scanning** - Based on change velocity
3. **Manual Trigger** - Via `runManually()` or CLI
4. **RSS/Atom Feeds** - Real-time feed subscriptions (NEW)
5. **HTTP Webhooks** - Push notifications from sources (NEW)
6. **Email Alerts** - Forwarded regulatory notifications (NEW)

---

## Webhook Infrastructure

### Database Models

**WebhookSubscription**
- Represents a webhook subscription to a regulatory source
- Stores configuration, authentication, and filter patterns
- Tracks success/error metrics

**WebhookEvent**
- Records each received webhook notification
- Stores raw payload for debugging
- Links to created Evidence records

### API Endpoint

**POST /api/webhooks/regulatory-truth**
- Receives webhook notifications
- Verifies signatures and authentication
- Creates WebhookEvent records
- Processes events asynchronously

**Query Parameters:**
- `provider` - Source identifier (e.g., "narodne-novine", "porezna-uprava")
- `subscription_id` - Specific subscription ID (optional)

**Headers:**
- `X-Webhook-Provider` - Alternative to query param
- `X-Webhook-Signature` - HMAC signature for verification
- `Authorization` - Bearer token for authentication

---

## Supported Sources

### 1. Narodne Novine (Official Gazette)

**Status:** RSS Feed Available

**Feed URL:** `https://narodne-novine.nn.hr/rss/`

**Setup:**
```sql
INSERT INTO "WebhookSubscription" (
  id,
  provider,
  "webhookType",
  "endpointUrl",
  "isActive",
  config,
  "filterPatterns"
) VALUES (
  gen_random_uuid(),
  'narodne-novine',
  'RSS_FEED',
  'https://narodne-novine.nn.hr/rss/',
  true,
  '{"pollIntervalMinutes": 15, "types": [1, 2]}',
  ARRAY['https://narodne-novine.nn.hr/clanci/.*']
);
```

**Configuration:**
- `pollIntervalMinutes`: How often to poll RSS feed (default: 15)
- `types`: NN content types to include (1=Zakon, 2=Uredba)

**Filter Patterns:**
- Only process URLs matching `https://narodne-novine.nn.hr/clanci/.*`

### 2. Porezna Uprava (Tax Authority)

**Status:** Email Alerts Only

**Email:** Subscribe to newsletters at https://www.porezna-uprava.hr

**Setup:**
1. Subscribe to Porezna uprava newsletter with FiskAI email
2. Configure email forwarding to webhook endpoint
3. Create webhook subscription:

```sql
INSERT INTO "WebhookSubscription" (
  id,
  provider,
  "webhookType",
  "isActive",
  config,
  "filterPatterns"
) VALUES (
  gen_random_uuid(),
  'porezna-uprava',
  'EMAIL_ALERT',
  true,
  '{"emailSource": "newsletters@porezna-uprava.hr"}',
  ARRAY['https://www.porezna-uprava.hr/.*']
);
```

**Email Forwarding:**
- Forward emails from `newsletters@porezna-uprava.hr` to webhook endpoint
- Use email service provider (SendGrid, Mailgun) for parsing
- Webhook will extract URLs from email body

### 3. FINA

**Status:** No Public Webhooks (Email Only)

**Setup:** Similar to Porezna uprava - email forwarding

```sql
INSERT INTO "WebhookSubscription" (
  id,
  provider,
  "webhookType",
  "isActive",
  config,
  "filterPatterns"
) VALUES (
  gen_random_uuid(),
  'fina',
  'EMAIL_ALERT',
  true,
  '{"emailSource": "info@fina.hr"}',
  ARRAY['https://www.fina.hr/.*']
);
```

### 4. Custom HTTP Webhooks

For sources that support custom webhook subscriptions:

```sql
INSERT INTO "WebhookSubscription" (
  id,
  "sourceId",
  provider,
  "webhookType",
  "endpointUrl",
  "isActive",
  "secretKey",
  config,
  "filterPatterns"
) VALUES (
  gen_random_uuid(),
  '<regulatory-source-id>',
  'custom-provider',
  'HTTP_WEBHOOK',
  'https://external-source.hr/api/webhook',
  true,
  '<hmac-secret>',
  '{"customField": "value"}',
  ARRAY['https://external-source.hr/.*']
);
```

**Security:**
- `secretKey`: HMAC secret for signature verification
- `authToken`: Bearer token for authorization (alternative to HMAC)
- `verifySSL`: Enable/disable SSL verification (default: true)

---

## Setup Instructions

### Step 1: Create Webhook Subscription

Use SQL or API to create a webhook subscription:

```typescript
import { db } from "@/lib/db"

const subscription = await db.webhookSubscription.create({
  data: {
    provider: "narodne-novine",
    webhookType: "RSS_FEED",
    endpointUrl: "https://narodne-novine.nn.hr/rss/",
    isActive: true,
    config: {
      pollIntervalMinutes: 15,
      types: [1, 2],
    },
    filterPatterns: ["https://narodne-novine.nn.hr/clanci/.*"],
  },
})
```

### Step 2: Configure External Webhook (if applicable)

For sources that support push webhooks:

1. Register webhook endpoint: `https://fiskai.hr/api/webhooks/regulatory-truth?provider=<provider>`
2. Configure HMAC secret in source dashboard
3. Store secret in WebhookSubscription record

### Step 3: Set Up Email Forwarding (for email alerts)

Using SendGrid Inbound Parse:

1. Configure SendGrid to parse incoming emails
2. Set webhook URL: `https://fiskai.hr/api/webhooks/regulatory-truth?provider=<provider>`
3. Forward regulatory emails to SendGrid parse address

### Step 4: Test Webhook

Send test notification:

```bash
curl -X POST 'https://fiskai.hr/api/webhooks/regulatory-truth?provider=test' \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Signature: sha256=<signature>' \
  -d '{
    "url": "https://example.hr/test-document.pdf",
    "title": "Test Notification",
    "published_at": "2025-12-29T10:00:00Z"
  }'
```

### Step 5: Monitor Webhook Events

Check webhook event log:

```sql
SELECT
  e.id,
  e."eventType",
  e.status,
  e."sourceUrl",
  e."evidenceId",
  e."receivedAt",
  e."processedAt",
  s.provider
FROM "WebhookEvent" e
JOIN "WebhookSubscription" s ON e."subscriptionId" = s.id
ORDER BY e."receivedAt" DESC
LIMIT 20;
```

---

## Testing & Debugging

### Health Check

Check webhook subscription status:

```bash
curl 'https://fiskai.hr/api/webhooks/regulatory-truth?provider=narodne-novine'
```

Response:
```json
{
  "subscription": {
    "id": "sub_123",
    "provider": "narodne-novine",
    "webhookType": "RSS_FEED",
    "isActive": true,
    "lastTriggeredAt": "2025-12-29T10:00:00Z",
    "triggerCount": 42,
    "errorCount": 0
  }
}
```

### View Webhook Events

Query recent webhook events:

```typescript
import { db } from "@/lib/db"

const events = await db.webhookEvent.findMany({
  where: {
    status: "PENDING",
  },
  include: {
    subscription: true,
  },
  orderBy: { receivedAt: "desc" },
  take: 10,
})
```

### Manual Processing

Manually trigger processing of a webhook event:

```typescript
import { processWebhookEvent } from "@/lib/regulatory-truth/webhooks/processor"

await processWebhookEvent("webhook-event-id")
```

### Common Issues

**Issue: Signature verification failed**
- Check that `secretKey` matches webhook provider configuration
- Verify signature algorithm (sha256 vs sha1)
- Ensure payload is not modified during transmission

**Issue: No URLs found in payload**
- Check `eventType` detection logic in processor
- Verify email parser is extracting URLs correctly
- Review `rawPayload` in WebhookEvent record

**Issue: Evidence not created**
- Check filter patterns - URLs may be filtered out
- Verify source exists or can be auto-created
- Review error logs in WebhookEvent

---

## Security

### Signature Verification

All webhook subscriptions should use HMAC signature verification:

```typescript
import { verifyWebhookSignature } from "@/lib/regulatory-truth/webhooks/signature-verification"

const isValid = verifyWebhookSignature(
  rawPayload,
  signature,
  secretKey,
  "sha256"
)
```

### Authentication

Options for webhook authentication:

1. **HMAC Signature** (recommended)
   - Provider signs payload with shared secret
   - We verify signature on receipt
   - Prevents tampering and replay attacks

2. **Bearer Token**
   - Provider sends token in Authorization header
   - Simple but less secure than HMAC
   - Suitable for internal webhooks

3. **IP Allowlist** (future)
   - Restrict webhooks to known IP ranges
   - Additional layer of security

### Rate Limiting

Webhook endpoint should implement rate limiting:

- Per subscription: 100 requests/minute
- Per IP: 1000 requests/hour
- Global: 10,000 requests/hour

### Replay Protection

For Stripe-style webhooks with timestamps:

```typescript
import { verifyStripeStyleSignature } from "@/lib/regulatory-truth/webhooks/signature-verification"

const isValid = verifyStripeStyleSignature(
  payload,
  signature,
  secret,
  timestamp
)
```

Rejects requests older than 5 minutes.

---

## Operational Runbook

### Adding New Webhook Source

1. Identify webhook/RSS feed capability
2. Create RegulatorySource record (if needed)
3. Create WebhookSubscription record
4. Configure external webhook (if HTTP_WEBHOOK)
5. Test with sample notification
6. Monitor for 24 hours
7. Document in this file

### Disabling Webhook

```sql
UPDATE "WebhookSubscription"
SET "isActive" = false
WHERE provider = '<provider>';
```

### Viewing Webhook Stats

```sql
SELECT
  provider,
  "webhookType",
  COUNT(*) FILTER (WHERE "lastSuccessAt" > NOW() - INTERVAL '24 hours') as recent_success,
  COUNT(*) FILTER (WHERE "lastError" IS NOT NULL) as error_count,
  AVG("triggerCount") as avg_triggers
FROM "WebhookSubscription"
WHERE "isActive" = true
GROUP BY provider, "webhookType";
```

### Debugging Failed Webhooks

1. Check WebhookEvent table for error messages
2. Review rawPayload for malformed data
3. Verify signature/auth configuration
4. Check filter patterns aren't too restrictive
5. Test URL fetching manually

---

## Future Enhancements

1. **RSS Feed Poller Worker**
   - Background job to poll RSS feeds every 15 minutes
   - Alternative to external RSS-to-webhook services

2. **Email Parsing Worker**
   - Direct IMAP connection to regulatory source mailboxes
   - No need for email forwarding

3. **Webhook Retry Queue**
   - Automatic retry with exponential backoff
   - Dead letter queue for persistent failures

4. **Webhook Dashboard**
   - Admin UI for managing subscriptions
   - Real-time event monitoring
   - Error alerting

5. **API Polling Worker**
   - Poll REST APIs that don't support webhooks
   - Store in WebhookEvent for unified processing

---

## Related Documentation

- [RTL Architecture](../01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md)
- [Sentinel Agent](../01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md#stage-1-sentinel-discovery)
- [Pipeline Details](./PIPELINE.md)
- [Security Best Practices](../04_OPERATIONS/security.md)
