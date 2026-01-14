# FiskAI System Snapshot

**Date:** 2026-01-05
**Auditor:** Claude Opus 4.5
**Method:** 7 parallel haiku subagents
**Canonical Rule:** Runtime > Source > Schema > Migrations > Config > Tests > Docs

---

## Executive Summary

FiskAI is a production-ready Croatian business compliance platform serving paušalni obrt owners. The system consists of 4 web portals, 17 feature modules, 184 database models, and 15 background workers.

---

## System Metrics

| Category           | Count | Notes                                    |
| ------------------ | ----- | ---------------------------------------- |
| **Database**       |       |                                          |
| Prisma Models      | 182   | Multi-tenant with companyId              |
| Enums              | 80+   | SystemRole, CompanyRole, LegalForm, etc. |
| **Code**           |       |                                          |
| Modules            | 17    | 8 default-enabled, 9 opt-in              |
| API Route Files    | 241   | Under src/app/api/                       |
| HTTP Endpoints     | ~216  | REST + webhooks                          |
| RTL Workers        | 15    | BullMQ-based pipeline                    |
| **Portals**        |       |                                          |
| Marketing Pages    | ~45   | fiskai.hr                                |
| Client App Pages   | ~85   | app.fiskai.hr                            |
| Staff Portal Pages | 12    | app.fiskai.hr/staff                      |
| Admin Portal Pages | ~22   | app.fiskai.hr/admin                      |

---

## Module Status Summary

### Fully Implemented (10)

- platform-core, invoicing, e-invoicing, contacts, products
- expenses, banking, reconciliation, reports-basic, pausalni

### Partially Implemented (4)

- reports-advanced (40%), vat (40%), pos (30%), ai-assistant (70%)

### Planned (3)

- corporate-tax (10%), fiscalization needs cert polish

---

## Integration Status

### Production Integrations

- **ePoslovanje v2** - Primary e-invoice provider
- **Porezna CIS** - Fiscalization (SOAP)
- **GoCardless** - PSD2 banking
- **Stripe** - Billing + Terminal
- **Resend** - Transactional email
- **Cloudflare** - R2 storage, CDN, Turnstile
- **PostHog/Sentry** - Analytics + errors

### Planned Integrations

- IE-Racuni (stub exists)
- SaltEdge (not started)
- Moj-eRacun (not started)

---

## Access Control

### SystemRole (Portal Access)

| Role  | Marketing | App | Staff | Admin |
| ----- | --------- | --- | ----- | ----- |
| USER  | ✅        | ✅  | -     | -     |
| STAFF | ✅        | ✅  | ✅    | -     |
| ADMIN | ✅        | ✅  | ✅    | ✅    |

### CompanyRole (Tenant Permissions)

| Role       | Description                    |
| ---------- | ------------------------------ |
| OWNER      | Full access including billing  |
| ADMIN      | Manage resources, invite users |
| MEMBER     | Create/edit, limited delete    |
| ACCOUNTANT | Read + exports                 |
| VIEWER     | Read-only                      |

---

## Regulatory Truth Layer Pipeline

```
Sentinel → OCR → Extractor → Composer → Reviewer → Arbiter → Releaser
                                                          ↓
                                                  Content-Sync
```

**Workers (14):**

1. sentinel.worker.ts
2. ocr.worker.ts
3. extractor.worker.ts
4. composer.worker.ts
5. reviewer.worker.ts
6. arbiter.worker.ts
7. releaser.worker.ts
8. content-sync.worker.ts
9. evidence-embedding.worker.ts
10. embedding.worker.ts
11. article.worker.ts
12. consolidator.worker.ts
13. orchestrator.worker.ts
14. continuous-drainer.worker.ts

---

## Known Gaps

### Critical (Must Fix)

- EN 16931 schema validation missing
- No automated data retention enforcement

### High Priority

- Certificate upload UX polish
- Multi-client staff workspace incomplete
- Corporate tax module planned only

### Technical Debt

- Bull Board disabled (ARM64)
- 2 soft-delete models only (SourcePointer, FeatureFlag)

---

## Documentation Updated

| Document                  | Version     |
| ------------------------- | ----------- |
| 00-INDEX.md               | 5.0.0       |
| 01-VISION-ARCHITECTURE.md | 5.0.0       |
| 02-USERS-JOURNEYS.md      | 3.0.0       |
| 03-LEGAL-COMPLIANCE.md    | 3.0.0       |
| 04-ACCESS-CONTROL.md      | 3.0.0       |
| 05-UI-EXPERIENCE.md       | 3.0.0       |
| 06-INTEGRATIONS.md        | 3.0.0       |
| 07-DATA-API.md            | 3.0.0       |
| 08-APPENDIXES.md          | 3.0.0       |
| FISKAI_SALES_DOCTRINE.md  | 1.0.0 (new) |

---

## Next Audit

**Recommended:** Monthly or after major releases
**Focus Areas:** Module completion status, integration health, security gaps
