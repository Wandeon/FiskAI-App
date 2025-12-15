# Audit Playbook

Last updated: 2025-12-15

## Purpose

Step-by-step guide for auditing FiskAI's codebase, configuration, and runtime behavior.

---

## Pre-Audit Checklist

- [ ] Access to source code repository
- [ ] Access to `.env.example` and documentation
- [ ] Understanding of Croatian fiscalization requirements
- [ ] Familiarity with Next.js App Router patterns
- [ ] Review of `docs/_meta/invariants.md`

---

## 1. Security Audit

### 1.1 Authentication

**Check**:

- [ ] All protected routes call `auth()` or `requireAuth()`
- [ ] Session tokens use secure, httpOnly cookies
- [ ] Password hashing uses bcrypt with sufficient rounds
- [ ] Rate limiting on login endpoints

**Files**:

- `src/lib/auth.ts`
- `src/middleware.ts`
- `src/app/api/auth/[...nextauth]/route.ts`

### 1.2 Authorization

**Check**:

- [ ] Role checks via `requirePermission()`
- [ ] Company membership validated via `requireCompany()`
- [ ] No privilege escalation paths

**Files**:

- `src/lib/rbac.ts`
- `src/lib/auth-utils.ts`

### 1.3 Data Access

**Check**:

- [ ] All queries filter by `companyId`
- [ ] No raw SQL without parameterization
- [ ] Input validation via Zod schemas

**Files**:

- `src/lib/db.ts`
- `src/lib/prisma-extensions.ts`
- All `src/app/actions/*.ts`

### 1.4 Secrets Management

**Check**:

- [ ] No secrets in source code
- [ ] `.env.example` documents all required variables
- [ ] Certificates encrypted at rest
- [ ] Webhook secrets validated

**Files**:

- `src/lib/secrets.ts`
- `.env.example`
- `src/app/api/webhooks/*/route.ts`

### 1.5 OWASP Top 10

**Check**:

- [ ] Injection: Parameterized queries, input validation
- [ ] Broken Auth: Session management, MFA support
- [ ] Sensitive Data: Encryption, secure transmission
- [ ] XXE: No XML parsing vulnerabilities
- [ ] Broken Access Control: RBAC enforcement
- [ ] Security Misconfiguration: Secure defaults
- [ ] XSS: React escaping, CSP headers
- [ ] Insecure Deserialization: JSON only, schema validation
- [ ] Vulnerable Components: Regular dependency updates
- [ ] Logging: Audit trail, no sensitive data in logs

---

## 2. Data Integrity Audit

### 2.1 Database Schema

**Check**:

- [ ] All business tables have `companyId`
- [ ] Cascade deletes configured correctly
- [ ] Indexes on frequently queried columns
- [ ] Enums match business requirements

**Files**:

- `prisma/schema.prisma`

### 2.2 Calculations

**Check**:

- [ ] Invoice totals calculated server-side
- [ ] VAT amounts use correct rates
- [ ] Currency handling consistent

**Files**:

- `src/app/actions/e-invoice.ts`
- `src/app/actions/expense.ts`

### 2.3 Validation

**Check**:

- [ ] OIB validation (11 digits, MOD 11)
- [ ] IBAN validation (Croatian format)
- [ ] Date range validation

**Files**:

- `src/lib/oib-lookup.ts`
- Zod schemas in action files

---

## 3. Compliance Audit (Croatian)

### 3.1 Fiscalization

**Check**:

- [ ] ZKI calculation matches specification
- [ ] JIR stored after successful submission
- [ ] Fiscalized invoices immutable
- [ ] Retry mechanism for failed requests
- [ ] Certificate encryption correct

**Files**:

- `src/lib/e-invoice/zki.ts`
- `src/lib/fiscal/fiscal-pipeline.ts`
- `src/lib/fiscal/xml-builder.ts`
- `src/lib/fiscal/xml-signer.ts`

### 3.2 E-Invoice (EN 16931)

**Check**:

- [ ] XML/UBL generation compliant
- [ ] Required fields present
- [ ] Validation against schema

**Files**:

- `src/lib/compliance/en16931-validator.ts`
- `src/lib/e-invoice/providers/ie-racuni.ts`

### 3.3 Data Retention

**Check**:

- [ ] Invoices retained 11 years
- [ ] Audit logs retained 7 years
- [ ] GDPR deletion respects retention

---

## 4. Performance Audit

### 4.1 Database

**Check**:

- [ ] N+1 queries avoided (use `include`)
- [ ] Large queries paginated
- [ ] Connection pooling configured

**Tools**: Prisma query logging, database explain

### 4.2 API Response Times

**Check**:

- [ ] List endpoints < 500ms
- [ ] Detail endpoints < 200ms
- [ ] AI extraction < 30s

**Tools**: `/api/metrics`, Vercel analytics

### 4.3 Bundle Size

**Check**:

- [ ] Client bundle reasonable size
- [ ] Dynamic imports for heavy components
- [ ] No duplicate dependencies

**Tools**: `next build`, bundle analyzer

---

## 5. Reliability Audit

### 5.1 Error Handling

**Check**:

- [ ] Try-catch in all async operations
- [ ] User-friendly error messages
- [ ] Sentry integration working
- [ ] Graceful degradation

**Files**:

- All API routes
- `src/lib/logger.ts`

### 5.2 Health Checks

**Check**:

- [ ] `/api/health` returns 200 when healthy
- [ ] `/api/health/ready` checks database
- [ ] Proper status codes for failures

**Files**:

- `src/app/api/health/route.ts`
- `src/app/api/health/ready/route.ts`

### 5.3 Background Jobs

**Check**:

- [ ] Cron jobs run on schedule
- [ ] Failures logged and alerted
- [ ] Idempotent operations

**Files**:

- `vercel.json`
- `src/app/api/cron/*/route.ts`

---

## 6. Documentation Audit

### 6.1 Feature Documentation

**Check**:

- [ ] All 108 features documented
- [ ] Evidence links valid
- [ ] Flows match implementation

**Files**:

- `docs/02_FEATURES/features/*.md`

### 6.2 API Documentation

**Check**:

- [ ] All endpoints documented
- [ ] Request/response schemas
- [ ] Error codes explained

### 6.3 Inventory Files

**Check**:

- [ ] Environment variables complete
- [ ] Services list accurate
- [ ] Integration status current

**Files**:

- `docs/_meta/inventory/*.md`

---

## 7. Post-Audit Actions

### For Each Finding

1. **Document** - Issue description, severity, evidence
2. **Classify** - Security, compliance, performance, reliability
3. **Prioritize** - Critical, high, medium, low
4. **Assign** - Owner and deadline
5. **Track** - Add to issue tracker

### Severity Definitions

| Severity | Response Time | Example                                 |
| -------- | ------------- | --------------------------------------- |
| Critical | 24 hours      | Authentication bypass, data leak        |
| High     | 1 week        | Privilege escalation, calculation error |
| Medium   | 1 month       | Minor compliance gap, performance issue |
| Low      | Next release  | Documentation gap, code style           |

---

## 8. Audit Schedule

| Audit Type    | Frequency   | Trigger                    |
| ------------- | ----------- | -------------------------- |
| Security      | Quarterly   | Also on major releases     |
| Compliance    | Annually    | Also on regulation changes |
| Performance   | Monthly     | Also on user complaints    |
| Documentation | Per release | Part of release checklist  |

---

## Quick Reference Commands

```bash
# Validate evidence links
./scripts/validate-evidence.sh

# Run security linter
npm run lint:security

# Check for outdated dependencies
npm outdated

# Analyze bundle size
npm run analyze

# Run all tests
npm test

# Check database schema
npx prisma validate

# Generate Prisma client
npx prisma generate
```
