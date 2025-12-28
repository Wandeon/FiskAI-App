# Billing API Failure Runbook

## Component
- **ID:** route-group-billing
- **Type:** ROUTE_GROUP
- **Owner:** team:platform

## Health Check
- **Endpoint:** /api/health/billing
- **Expected:** 200 OK

## Common Issues

### Issue 1: Subscription Creation Failures
**Symptoms:** New subscriptions not being created, Stripe errors in logs
**Resolution:**
1. Check Stripe API key validity in environment
2. Verify Stripe webhook secret is configured correctly
3. Review customer creation payload for missing required fields
4. Check Stripe dashboard for API errors

### Issue 2: Payment Processing Failures
**Symptoms:** Payments failing, cards being declined unexpectedly
**Resolution:**
1. Check Stripe payment method configuration
2. Verify 3D Secure handling is implemented correctly
3. Review card network availability (Visa, Mastercard, etc.)
4. Check for Stripe outages at status.stripe.com

### Issue 3: Webhook Processing Delays
**Symptoms:** Subscription status not updating, events missing
**Resolution:**
1. Check webhook endpoint accessibility from Stripe
2. Review webhook signature verification
3. Check for pending webhooks in Stripe dashboard
4. Verify webhook handler is processing events correctly

## Escalation
- Primary: team:platform
- Backup: #ops-critical

## References
- Code: src/app/api/billing/
- Dependencies: lib-billing, integration-stripe
- Critical Path: path-billing
- SLO: 99.95% uptime, webhooks processed <30s
