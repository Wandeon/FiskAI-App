# FiskAI-App Repository Clean State Report

**Audit Date:** 2026-01-22  
**Auditor:** Automated CI Pipeline + Manual Verification  
**Repo:** Wandeon/FiskAI (to be renamed FiskAI-App)  
**Status:** ✅ CLEAN - Intelligence/Regulatory code fully externalized

---

## Executive Summary

This audit proves that the FiskAI repository contains **only Accounting/ERP code** with no embedded intelligence or regulatory ownership. All regulatory truth layer processing has been externalized to:

- `fiskai-intelligence` - Intelligence API for rule resolution
- `fiskai-workers` - Background workers for regulatory data processing

The application communicates with intelligence services **only via HTTP API**.

---

## 1. Forbidden Modules - Proof of Non-Existence

### Forbidden Patterns Scanned

| Pattern                      | Count | Status   | Notes                    |
| ---------------------------- | ----- | -------- | ------------------------ |
| `regulatory-truth` (in src/) | 0     | ✅ CLEAN | Only in docs/comments    |
| `nn-mirror` (in src/)        | 0     | ✅ CLEAN | Only in scripts/         |
| `InstrumentEvidenceLink`     | 0     | ✅ CLEAN | Not in application code  |
| `ProvisionNode`              | 0     | ✅ CLEAN | Not in application code  |
| `ParsedDocument`             | 0     | ✅ CLEAN | Not in application code  |
| `dbReg`                      | 0     | ✅ CLEAN | Removed from application |
| `prisma/regulatory.prisma`   | 0     | ✅ CLEAN | File does not exist      |
| `migrations-regulatory/`     | 0     | ✅ CLEAN | Directory does not exist |
| `@/lib/regulatory`           | 0     | ✅ CLEAN | Module does not exist    |
| `RegulatoryClient`           | 0     | ✅ CLEAN | Not present              |
| `regulatory_db`              | 0     | ✅ CLEAN | Not present              |
| `regulatoryPrisma`           | 0     | ✅ CLEAN | Not present              |

### Evidence Command

```bash
rg -l "regulatory-truth|nn-mirror|InstrumentEvidenceLink|ProvisionNode|ParsedDocument|dbReg" \
  --glob '!node_modules/**' --glob '!.git/**' --glob '!dist/**' --glob '!.next/**' \
  --glob '*.ts' --glob '*.tsx' src/
# Returns: 0 matches
```

---

## 2. Database Connection Proof

### Application Database

- **Env Var:** `DATABASE_URL`
- **Schema:** `prisma/schema.prisma` (public schema)
- **Used By:** All application code via `@/lib/db`

### Regulatory Database

- **Env Var:** `REGULATORY_DATABASE_URL`
- **Status:** ❌ NOT USED in application code
- **Location:** Only in CI build args (dummy values) and operational scripts

### Evidence

```bash
grep -r "REGULATORY_DATABASE_URL" src/
# Returns: 0 matches in /src/ directory
```

---

## 3. External Calls - Intelligence API Only

### Allowed Intelligence Coupling

| Env Var                     | Purpose                   | Location                         |
| --------------------------- | ------------------------- | -------------------------------- |
| `INTELLIGENCE_API_BASE_URL` | Intelligence API endpoint | `src/lib/intelligence/client.ts` |
| `INTELLIGENCE_API_TOKEN`    | Bearer auth token         | `src/lib/intelligence/client.ts` |

### API Client Contract

```typescript
// src/lib/intelligence/client.ts
export function isIntelligenceConfigured(): boolean {
  return Boolean(process.env.INTELLIGENCE_API_BASE_URL && process.env.INTELLIGENCE_API_TOKEN)
}
```

### No Other Intelligence Dependencies

- ❌ No embedded LLM/AI runtime
- ❌ No regulatory rule evaluation logic
- ❌ No document parsing code
- ❌ No evidence linking logic

---

## 4. CI Jobs Audited

### Workflow Status

| Workflow                       | Status   | Notes                     |
| ------------------------------ | -------- | ------------------------- |
| `ci.yml`                       | ✅ CLEAN | No regulatory generation  |
| `build-and-publish-images.yml` | ✅ FIXED | Regulatory checks removed |
| `assistant-quality-gates.yml`  | ✅ CLEAN | Only env var for build    |
| `fiscal-validator.yml`         | ✅ CLEAN | No regulatory refs        |
| `registry-check.yml`           | ✅ CLEAN | No regulatory refs        |
| `schema-ownership.yml`         | ✅ CLEAN | No regulatory refs        |

### Guard Scripts in CI

| Script                                | Purpose                   | Status         |
| ------------------------------------- | ------------------------- | -------------- |
| `check-no-regulatory.ts`              | Blocks regulatory imports | ✅ Added to CI |
| `check-no-direct-core-ruleversion.ts` | Blocks direct rule usage  | ✅ Active      |
| `check-legacy-secrets.ts`             | Blocks legacy env access  | ✅ Active      |
| `check-test-db-boundary.ts`           | Ensures test isolation    | ✅ Active      |

---

## 5. Build & Docker Audited

### Dockerfile

- **Base:** `node:22-alpine`
- **Prisma:** Only generates from `prisma/schema.prisma`
- **No Regulatory:** REGULATORY_DATABASE_URL removed from build

### Image Naming

- **Standard:** `ghcr.io/wandeon/fiskai-app`
- **Tags:** `<sha>`, `latest`, `arm64`

### Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', ...)"
```

---

## 6. Dependencies Removed

### Prisma Schemas

- ✅ `prisma/schema.prisma` - Core app schema (kept)
- ❌ `prisma/regulatory.prisma` - Does not exist (removed)

### Generated Clients

- ✅ `src/generated/client/` - Core Prisma client (kept)
- ❌ `src/generated/regulatory-client/` - Removed

### Worker Code

- ❌ `src/lib/regulatory-truth/workers/` - Moved to fiskai-workers
- ❌ `src/lib/nn-mirror/` - Moved to fiskai-intelligence
- ❌ `src/lib/assistant/` - Moved to fiskai-intelligence

---

## 7. Health Endpoints

| Endpoint                       | Status Codes  | Purpose                       |
| ------------------------------ | ------------- | ----------------------------- |
| `GET /api/health`              | 200           | Liveness probe                |
| `GET /api/health/ready`        | 200, 503      | Readiness probe               |
| `GET /api/health/intelligence` | 200, 424, 503 | Intelligence API connectivity |

### Status Code Contract

- **200 OK** - Service healthy
- **424 Dependency Failed** - Intelligence API not configured
- **503 Service Unavailable** - Intelligence API unreachable

---

## 8. Non-Negotiable Boundaries Enforced

### App Repo MUST NOT Contain

| Item                      | Status    | Verification        |
| ------------------------- | --------- | ------------------- |
| NN Mirror parsing         | ✅ Absent | grep returns 0      |
| Regulatory truth layer    | ✅ Absent | grep returns 0      |
| Instrument linking        | ✅ Absent | grep returns 0      |
| Regulatory Prisma schemas | ✅ Absent | File does not exist |
| dbReg code                | ✅ Absent | grep returns 0      |
| Assistant/agent runtime   | ✅ Absent | grep returns 0      |

### App Repo IS Allowed To

| Item                        | Status     | Implementation                   |
| --------------------------- | ---------- | -------------------------------- |
| Call Intelligence API       | ✅ Present | `src/lib/intelligence/client.ts` |
| Store ruleVersionId markers | ✅ Present | Opaque foreign references only   |
| Read from regulatory schema | ✅ Via API | Not direct DB access             |

---

## Conclusion

**The FiskAI-App repository is PROVABLY CLEAN.**

- Zero forbidden imports in application code
- No regulatory database access from application
- Intelligence coupling limited to HTTP API calls
- All CI guards active and passing
- Build/Docker properly configured

This audit confirms the architectural split is complete and enforced.
