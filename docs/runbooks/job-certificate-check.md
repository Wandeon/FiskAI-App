# Certificate Check Cron Failure Runbook

## Component
- **ID:** job-certificate-check
- **Type:** JOB
- **Owner:** team:compliance

## Health Check
- **Endpoint:** /api/cron/certificate-check
- **Expected:** 200 OK with certificate status

## Common Issues

### Issue 1: Expiring Certificates Not Detected
**Symptoms:** No alerts for certificates expiring soon, surprise expirations
**Resolution:**
1. Check certificate check job execution logs
2. Verify notification thresholds (30, 14, 7 days)
3. Review certificate metadata parsing
4. Check email notification delivery

### Issue 2: False Positive Expiration Alerts
**Symptoms:** Alerts for valid certificates, incorrect expiration dates
**Resolution:**
1. Verify certificate parsing logic
2. Check timezone handling for dates
3. Review certificate format (PEM, PKCS12)
4. Validate against actual certificate

### Issue 3: Notification Delivery Failures
**Symptoms:** Certificates expiring without notifications, email failures
**Resolution:**
1. Check Resend integration status
2. Verify recipient email addresses
3. Review email template rendering
4. Check notification queue processing

## Escalation
- Primary: team:compliance
- Backup: #ops-critical

## References
- Code: src/app/api/cron/certificate-check/route.ts
- Dependencies: lib-fiscal
- Critical Path: path-fiscalization
- Alert Thresholds: 30, 14, 7, 3, 1 days before expiration
