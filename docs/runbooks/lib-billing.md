# Billing Library Failure Runbook

## Component
- **ID:** lib-billing
- **Type:** LIB
- **Owner:** team:platform

## Health Check
- **Endpoint:** /api/health/billing
- **Expected:** 200 OK with billing status

## Common Issues

### Issue 1: Subscription Sync Failures
**Symptoms:** Stripe subscription status not matching local database
**Resolution:**
1. Check Stripe webhook processing
2. Review subscription sync logic
3. Force sync from Stripe API
4. Check for webhook replay needs

### Issue 2: Price/Plan Lookup Failures
**Symptoms:** Pricing pages broken, plan selection failing
**Resolution:**
1. Verify Stripe price IDs in configuration
2. Check product/price sync with Stripe
3. Review price caching logic
4. Check for archived products in Stripe

### Issue 3: Entitlement Grant Failures
**Symptoms:** Users not getting module access after payment
**Resolution:**
1. Check webhook processing for subscription.created
2. Verify entitlement mapping from plan to modules
3. Review company.entitlements update logic
4. Check for transaction failures

### Issue 4: Invoice Generation Issues
**Symptoms:** Stripe invoices not matching expected amounts
**Resolution:**
1. Check proration settings
2. Review tax calculation
3. Verify discount/coupon application
4. Check currency settings

## Escalation
- Primary: team:platform
- Backup: #ops-critical

## References
- Code: src/lib/billing/
- Dependencies: integration-stripe
- Critical Path: path-billing
