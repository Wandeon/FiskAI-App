# Audit Task List (FiskAI)

Prioritized tasks for the upcoming audit, aligned with the audit playbook and system invariants.

## 1. Security Audit
| Priority | Task | Assignee | Est. Effort | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| P0 | Verify multi-tenant isolation (INV-001, INV-002) across Prisma extensions and API routes; confirm `companyId` filtering and membership checks. | Security lead (e.g., Ana) | 1.5d | All audited queries/actions show enforced `companyId` filters; membership guard present in sampled routes; no cross-tenant data leakage evidence. |
| P0 | Validate fiscal certificate security (INV-008, INV-015) and secrets handling; ensure AES-256-GCM at rest and no plaintext keys. | Security lead | 1d | Crypto config matches spec; certificates stored encrypted; `.env.example` variables documented; no plaintext secrets in repo. |
| P0 | Confirm rate limiting for AI/extraction endpoints (INV-017) per subscription tiers and global OWASP A10 controls. | Backend (e.g., Luka) | 1d | Rate limiter configuration matches tier limits; tests or logs showing enforcement; 429 responses for overages; OWASP logging guidance followed. |
| P1 | OWASP Top 10 sweep (A01–A10) focusing on injection, auth, access control, XSS, and dependency hygiene. | Security lead + QA | 2d | Checklist completed with evidence; critical/high findings filed; dependency scan up to date. |
| P1 | Secrets management review against `.env.example` and deployment configs for completeness and rotation readiness. | DevOps (e.g., Petra) | 0.5d | All required env vars documented; no drift between `.env.example` and inventory; rotation steps documented. |

## 2. Data Integrity Audit
| Priority | Task | Assignee | Est. Effort | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| P0 | Validate database schema enforces `companyId` on business tables and cascade deletes (INV-001, INV-012). | Backend | 1d | Schema review confirms fields and cascades; sample migrations verified; no tables missing tenant scoping. |
| P1 | Recompute sample invoice totals/VAT to confirm INV-009/INV-010 enforcement server-side. | Accounting SME (e.g., Ivana) | 0.5d | Sample calculations match expected totals/rates; discrepancies logged as findings. |
| P1 | Check currency consistency and invoice numbering uniqueness (INV-011, INV-013). | Backend | 0.5d | No mixed-currency invoices in samples; numbering uniqueness validated per company. |
| P2 | Validate OIB/IBAN format enforcement (INV-014) and date validations in action schemas. | QA | 0.5d | Zod schemas enforce OIB/IBAN rules; failing test cases rejected; results recorded. |

## 3. Compliance Audit (Croatian)
| Priority | Task | Assignee | Est. Effort | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| P0 | Confirm fiscalization pipeline (ZKI/JIR) correctness (INV-006, INV-007) and immutability post-JIR. | Compliance lead (e.g., Marko) | 1.5d | ZKI generation aligns with spec; JIR stored and prevents edits; retries and error handling verified. |
| P0 | Verify Croatian fiscal certificate handling (CRS) and retention requirements (INV-019) across storage and backups. | Compliance lead + DevOps | 1d | Certificates encrypted; retention rules documented and enforced for invoices/fiscal requests/audit logs; evidence collected. |
| P1 | Cross-check EN 16931 validator and XML builder against required fields and schema validation paths. | Compliance lead | 1d | Validator passes required fields; sample XML validated; missing fields logged. |

## 4. Performance Audit
| Priority | Task | Assignee | Est. Effort | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| P1 | Check N+1 mitigation and pagination on high-traffic queries; ensure connection pooling configured. | Backend | 1d | Query samples show includes/pagination; pool settings documented; no unbounded scans in logs. |
| P2 | Benchmark key API routes against SLAs (list <500ms, detail <200ms); include AI extraction <30s. | QA | 1d | Benchmark report with p95 metrics; regressions flagged with issues. |
| P2 | Review bundle size/build output for duplicate dependencies and heavy components lacking dynamic imports. | Frontend (e.g., Sara) | 0.5d | Bundle analysis report with actions for >max thresholds; dynamic imports plan drafted. |

## 5. Reliability Audit
| Priority | Task | Assignee | Est. Effort | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| P1 | Validate error handling patterns and Sentry integration across APIs and background jobs. | QA | 0.5d | Sample routes show try/catch with user-friendly responses; Sentry events received for forced errors. |
| P1 | Health/ready endpoints verification, including DB connectivity checks. | DevOps | 0.5d | `/api/health` and `/api/health/ready` return expected statuses; simulated DB outage reflects failure state. |
| P2 | Cron/queue job idempotency and authorization (INV-005) validation. | Backend | 0.5d | Cron routes enforce `CRON_SECRET`; reruns are idempotent; logs capture failures. |

## 6. Documentation Audit
| Priority | Task | Assignee | Est. Effort | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| P0 | Validate inventory files (env-vars, services, integrations, databases, runtimes) against current code/config. | Docs (e.g., Elena) | 1d | Inventory diffs captured; mismatches resolved or filed; counts (env vars, models, enums, routes) reconciled. |
| P0 | Spot-check feature evidence links (108 docs) for validity and traceability to code/tests. | Docs + QA | 1.5d | Sampled links resolve; broken/missing evidence logged; representative coverage across modules. |
| P1 | Ensure API documentation completeness for all exposed routes and error formats (INV-020, INV-021). | Docs | 1d | Routes listed with request/response schemas; error format documented; pagination defaults stated. |

## 7. Cross-Cutting Tasks
| Priority | Task | Assignee | Est. Effort | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| P0 | Consolidate findings into issue tracker with severity, owner, and due dates per playbook. | PM (e.g., Lea) | 0.5d | All findings logged with severity (Critical/High/Medium/Low), owner, and target dates. |
| P0 | Prepare audit evidence pack covering invariants, OWASP, fiscalization, and retention controls. | PM + Leads | 0.5d | Evidence archive assembled; links to code/docs/tests included; ready for external review. |
