# Stripe Payment and Terminal Integration Failure Runbook

## Component
- **ID:** integration-stripe
- **Type:** INTEGRATION
- **Owner:** team:platform

## Health Check
- **Endpoint:** /api/health/stripe
- **Expected:** 200 OK with API connectivity status

## Common Issues

### Issue 1: API Connection Failures
**Symptoms:** Payment operations failing, Stripe API errors
**Resolution:**
1. Check Stripe API status: https://status.stripe.com
2. Verify API keys in environment variables
3. Check for API version compatibility issues
4. Review rate limiting status

### Issue 2: Webhook Signature Verification Failures
**Symptoms:** Webhooks rejected, events not processing
**Resolution:**
1. Verify STRIPE_WEBHOOK_SECRET is correct
2. Check webhook endpoint URL in Stripe dashboard
3. Review webhook signing secret rotation
4. Check for clock skew (signature validation window)

### Issue 3: Terminal Reader Connection Issues
**Symptoms:** POS terminals not connecting, reader offline
**Resolution:**
1. Check terminal registration status
2. Verify location configuration
3. Review network connectivity from terminal
4. Check terminal firmware version

### Issue 4: Payment Intent Failures
**Symptoms:** Payments not completing, customers seeing errors
**Resolution:**
1. Check card network availability
2. Review 3D Secure authentication flow
3. Check for blocked payments in Stripe Radar
4. Review payment method configuration

## Escalation
- Primary: team:platform
- Backup: #ops-critical

## References
- Code: src/lib/stripe/
- Dependents: module-pos, route-group-billing, route-group-terminal, route-group-webhooks, lib-billing
- Critical Path: path-billing
- Features: billing, terminal, webhooks
