# Troubleshooting Guide

## Quick Diagnosis

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Fiscalization fails | Certificate expired or CIS down | Check certificate, retry queue |
| Bank import stuck | PDF parsing failed | Retry with XML format |
| E-invoice rejected | EN16931 validation error | Check validation details |
| AI assistant slow | Rate limit or model load | Wait 60s, retry |
| Login loop | Session expired mid-action | Clear cookies, re-login |

---

## Fiscalization Errors

### Error: "Certifikat istekao" (Certificate Expired)

**Cause:** FINA certificate has expired.

**Diagnosis:**
```bash
# Check certificate expiry via API
curl -s https://fiskai.hr/api/cron/certificate-check | jq .
```

**Resolution:**
1. Obtain new certificate from FINA
2. Upload via Admin portal > Settings > Fiscalization
3. Re-test with a test invoice

---

### Error: "CIS nedostupan" (CIS Unavailable)

**Cause:** Croatian Tax Authority CIS service is down.

**Diagnosis:**
1. Check CIS status at https://cis.porezna-uprava.hr
2. Review `/api/health` for external dependency status

**Resolution:**
1. Invoices are queued automatically
2. Monitor queue: `GET /api/admin/fiscal-queue`
3. CIS usually recovers within 1-2 hours
4. Manual retry: `POST /api/cron/fiscal-processor`

---

### Error: "Nevaljan OIB" (Invalid OIB)

**Cause:** Customer OIB format invalid or doesn't pass checksum.

**Resolution:**
1. Verify OIB at https://oib.oib.hr
2. OIB must be exactly 11 digits
3. Last digit is MOD11 checksum
4. Update customer record with correct OIB

---

### Error: "Duplikat racuna" (Duplicate Invoice)

**Cause:** Invoice with same number already fiscalized.

**Resolution:**
1. Check if invoice was actually fiscalized (has JIR)
2. If yes: Use the existing fiscalized invoice
3. If no: Generate new invoice number and retry

---

## Banking Import Failures

### Error: "Unsupported file format"

**Cause:** PDF doesn't contain extractable text layer.

**Diagnosis:**
- Check if PDF is scanned image vs text-based
- Text PDFs work immediately
- Scanned PDFs need OCR processing

**Resolution:**
1. Request XML format from bank (preferred)
2. Use SEPA XML camt.053 format if available
3. OCR processing takes longer but should work

---

### Error: "Duplicate statement"

**Cause:** Same statement already uploaded (checksum match).

**Resolution:**
1. If intentional: Set `overwrite: true` in request
2. If accidental: No action needed, statement already exists
3. Check existing import: `GET /api/banking/import/jobs`

---

### Error: "Failed to parse transactions"

**Cause:** Unexpected statement format from bank.

**Diagnosis:**
```bash
# Check import job details
curl -s https://app.fiskai.hr/api/banking/import/jobs/{jobId} | jq .
```

**Resolution:**
1. Check bank name matches supported banks
2. Some banks have multiple formats - try different export option
3. Contact support with statement sample (redacted)

---

## E-Invoice Errors

### Error: EN16931 Validation Failed

**Cause:** Invoice doesn't meet EU e-invoice standard.

**Common issues:**
- Missing required fields (seller VAT, buyer address)
- Invalid currency code
- Tax calculation rounding errors
- Missing line item details

**Resolution:**
1. Check validation details in API response
2. Common fixes:
   - Add seller VAT ID
   - Complete buyer address (street, city, postal code, country)
   - Verify tax amounts sum correctly
   - Each line needs quantity, unit price, and tax category

---

### Error: "Provider rejected"

**Cause:** E-invoice provider (Moj-eRacun, FINA, etc.) rejected the invoice.

**Diagnosis:**
```sql
-- Check provider error
SELECT "providerStatus", "providerError"
FROM "EInvoice"
WHERE id = 'xxx';
```

**Resolution:**
1. Check `providerError` field for specific reason
2. Common causes:
   - Recipient not registered for e-invoices
   - Invalid recipient VAT ID
   - Attachment too large (>10MB)

---

### Error: "Recipient not found"

**Cause:** Recipient company isn't registered for e-invoices.

**Resolution:**
1. Verify recipient is registered at https://moj-eracun.hr/provjera
2. If not registered, send invoice via email/mail instead
3. Update contact preference in customer record

---

## AI Assistant Issues

### Slow or no response

**Cause:** Rate limiting, high load, or API timeout.

**Diagnosis:**
1. Check AI usage: `GET /api/ai/usage`
2. Review rate limit headers in response
3. Check `/api/assistant/reasoning/health`

**Resolution:**
1. Wait 60 seconds for rate limit reset
2. Try non-streaming endpoint if streaming fails
3. Simplify the query (shorter context)

---

### Incorrect extraction

**Cause:** Document quality or unusual format.

**Resolution:**
1. Submit feedback: `POST /api/ai/feedback`
2. Ensure document is clear and readable
3. Use original document (not scanned copy of copy)
4. Manually correct and re-train

---

### "Quota exceeded"

**Cause:** Monthly AI usage limit reached.

**Resolution:**
1. Check plan limits in billing
2. Upgrade plan for more AI queries
3. Essential operations (fiscalization) continue without AI

---

## Authentication Issues

### Login loop / Session expired

**Cause:** Session cookie expired or corrupted.

**Resolution:**
1. Clear all fiskai.hr cookies
2. Clear browser cache
3. Try incognito/private window
4. If persistent, check server time sync

---

### "Access denied" after login

**Cause:** User lacks permission for resource.

**Diagnosis:**
```sql
-- Check user role
SELECT "systemRole" FROM "User" WHERE email = 'xxx';

-- Check company role
SELECT role FROM "CompanyUser" WHERE "userId" = 'xxx';
```

**Resolution:**
1. Verify user has correct system role (USER, STAFF, ADMIN)
2. Check company-level role assignment
3. For staff: Ensure assignment to client company exists

---

### Multi-factor authentication issues

**Cause:** Code expired or sync issue.

**Resolution:**
1. Wait for new code (codes expire in 5 minutes)
2. Check email spam folder
3. Request code resend: `POST /api/auth/send-code`

---

## Database Issues

### Slow queries

**Diagnosis:**
```sql
-- Check slow queries
SELECT query, calls, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check missing indexes
SELECT schemaname, tablename, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

**Resolution:**
1. Add indexes for frequently queried columns
2. Optimize N+1 queries with includes
3. Consider query caching for hot paths

---

### Connection pool exhausted

**Symptoms:** "Too many connections" errors, timeouts.

**Diagnosis:**
```sql
SELECT count(*) FROM pg_stat_activity;
```

**Resolution:**
1. Restart application to reset pool
2. Increase pool size if sustained load
3. Check for connection leaks in code

---

## General Debugging

### Check application logs

```bash
# Via Docker
docker logs fiskai-app --tail 100

# Via Coolify
# Dashboard > Application > Logs
```

### Check worker logs

```bash
docker logs fiskai-worker-ocr --tail 50
docker logs fiskai-worker-extractor --tail 50
```

### Check queue status

```bash
npx tsx scripts/queue-status.ts
```

### Test endpoint health

```bash
# Basic health
curl -s https://fiskai.hr/api/health | jq .

# Detailed status
curl -s https://fiskai.hr/api/status | jq .

# Readiness
curl -s https://fiskai.hr/api/health/ready | jq .
```

---

## When to Escalate

Escalate to development team if:

1. **Data corruption** - Records showing impossible values
2. **Security incident** - Unauthorized access suspected
3. **Persistent failures** - Same error after 3 retries
4. **New error types** - Errors not in this guide
5. **Compliance risk** - Fiscalization down >4 hours

**Escalation contacts:**
- Technical issues: dev@fiskai.hr
- Security incidents: security@fiskai.hr
- Urgent production issues: [On-call rotation]
