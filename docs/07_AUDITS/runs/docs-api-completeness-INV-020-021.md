# API Documentation Completeness Audit (INV-020 & INV-021)

## Summary
- Total API routes detected: 72
- Routes with non-meta documentation: 63
- Routes missing documentation beyond inventory listings: 9

## Methodology
- Enumerated all Next.js API route handlers under src/app/api.
- Parsed exported HTTP methods from each route file to build the route list.
- Searched the docs/ directory for occurrences of each path (colon and [bracket] variants).
- Counted only documentation files outside docs/_meta/inventory/* as substantive coverage.

## Route coverage table
| Path | Methods | Documentation references |
| --- | --- | --- |
| /api/admin/auth | DELETE,POST | docs/02_FEATURES/features/admin-company.md<br>docs/02_FEATURES/features/admin-dashboard.md |
| /api/admin/companies/:companyId/audit | GET | docs/02_FEATURES/features/admin-company.md |
| /api/admin/support/dashboard | GET | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/admin-dashboard.md<br>docs/02_FEATURES/features/admin-support.md<br>docs/02_FEATURES/features/support-view.md |
| /api/ai/extract | POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/ai-receipt-extraction.md<br>docs/02_FEATURES/features/ai-usage.md<br>docs/02_FEATURES/features/expenses-create.md<br>docs/02_FEATURES/features/expenses-receipt-scanner.md<br>docs/AI_FEATURES.md<br>docs/AI_USAGE_TRACKING.md<br>docs/plans/2025-12-11-remaining-modules-design.md |
| /api/ai/feedback | GET,POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/ai-category-suggestions.md<br>docs/02_FEATURES/features/ai-feedback.md<br>docs/02_FEATURES/features/expenses-receipt-scanner.md |
| /api/ai/suggest-category | POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/ai-category-suggestions.md<br>docs/02_FEATURES/features/expenses-categories.md<br>docs/02_FEATURES/features/expenses-create.md<br>docs/02_FEATURES/features/expenses-receipt-scanner.md<br>docs/AI_FEATURES.md |
| /api/ai/usage | GET | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/ai-usage.md<br>docs/AI_USAGE_TRACKING.md |
| /api/auth/:...nextauth | GET,POST | None (inventory references only) |
| /api/bank/callback | GET | docs/02_FEATURES/features/banking-connect.md<br>docs/02_FEATURES/features/integrations-bank-sync.md<br>docs/plans/2024-12-14-bank-sync-ais-design.md<br>docs/plans/2024-12-14-bank-sync-implementation.md |
| /api/bank/connect | POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/banking-accounts.md<br>docs/02_FEATURES/features/banking-connect.md<br>docs/02_FEATURES/features/banking-disconnect.md<br>docs/02_FEATURES/features/integrations-bank-sync.md<br>docs/plans/2024-12-14-bank-sync-ais-design.md<br>docs/plans/2024-12-14-bank-sync-implementation.md |
| /api/bank/disconnect | POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/banking-accounts.md<br>docs/02_FEATURES/features/banking-connect.md<br>docs/02_FEATURES/features/banking-disconnect.md<br>docs/plans/2024-12-14-bank-sync-ais-design.md<br>docs/plans/2024-12-14-bank-sync-implementation.md |
| /api/banking/import/jobs/:id | DELETE,GET,PATCH | docs/02_FEATURES/features/banking-documents.md<br>docs/02_FEATURES/features/documents-details.md |
| /api/banking/import/jobs/:id/file | GET | docs/02_FEATURES/features/banking-documents.md<br>docs/02_FEATURES/features/documents-details.md |
| /api/banking/import/jobs/:id/status | POST | docs/02_FEATURES/features/documents-details.md |
| /api/banking/import/process | POST | docs/02_FEATURES/features/banking-import.md |
| /api/banking/import/upload | POST | docs/02_FEATURES/features/banking-documents.md<br>docs/02_FEATURES/features/banking-import.md |
| /api/banking/reconciliation | GET | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/banking-auto-match.md<br>docs/02_FEATURES/features/banking-manual-match.md<br>docs/02_FEATURES/features/banking-reconciliation.md<br>docs/02_FEATURES/features/invoicing-mark-paid.md<br>docs/bank-reconciliation.md |
| /api/banking/reconciliation/match | POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/banking-auto-match.md<br>docs/02_FEATURES/features/banking-manual-match.md<br>docs/02_FEATURES/features/banking-reconciliation.md<br>docs/02_FEATURES/features/invoicing-mark-paid.md<br>docs/bank-reconciliation.md |
| /api/billing/checkout | POST | docs/02_FEATURES/features/settings-billing.md |
| /api/billing/portal | POST | docs/02_FEATURES/features/settings-billing.md |
| /api/billing/webhook | POST | docs/02_FEATURES/features/settings-billing.md |
| /api/capabilities | GET | docs/02_FEATURES/features/auth-session.md |
| /api/compliance/en16931 | GET,POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/e-invoicing-compliance.md |
| /api/cron/bank-sync | GET,POST | docs/02_FEATURES/features/banking-connect.md<br>docs/plans/2024-12-14-bank-sync-ais-design.md<br>docs/plans/2024-12-14-bank-sync-implementation.md<br>docs/plans/2025-12-15-email-import.md |
| /api/cron/email-sync | GET | docs/02_FEATURES/features/integrations-email.md<br>docs/02_FEATURES/features/settings-email.md<br>docs/plans/2025-12-15-email-import.md |
| /api/cron/fiscal-processor | GET | docs/02_FEATURES/features/e-invoicing-send.md<br>docs/02_FEATURES/features/fiscal-fiscalize.md<br>docs/02_FEATURES/features/fiscal-status.md<br>docs/DEPLOYMENT.md<br>docs/plans/2025-12-15-fiscal-certificates.md |
| /api/e-invoices/inbox | GET,PATCH,POST | docs/02_FEATURES/features/e-invoicing-receive.md |
| /api/e-invoices/receive | GET,POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/e-invoicing-receive.md |
| /api/email/:connectionId/disconnect | DELETE | None (inventory references only) |
| /api/email/callback | GET | docs/02_FEATURES/features/integrations-email.md<br>docs/02_FEATURES/features/settings-email.md<br>docs/plans/2025-12-15-email-import.md |
| /api/email/connect | POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/integrations-email.md<br>docs/02_FEATURES/features/settings-email.md<br>docs/plans/2025-12-15-email-import.md |
| /api/email/rules | GET,POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/integrations-email-rules.md<br>docs/02_FEATURES/features/settings-email.md<br>docs/plans/2025-12-15-email-import.md |
| /api/email/rules/:id | DELETE,PUT | docs/02_FEATURES/features/integrations-email-rules.md |
| /api/exports/company | GET | docs/02_FEATURES/features/system-status.md |
| /api/exports/expenses | GET | docs/02_FEATURES/features/expenses-filtering.md<br>docs/02_FEATURES/features/expenses-view.md<br>docs/02_FEATURES/features/reports-accountant-export.md<br>docs/02_FEATURES/features/reports-export.md |
| /api/exports/invoices | GET | docs/02_FEATURES/features/invoicing-view.md<br>docs/02_FEATURES/features/reports-accountant-export.md<br>docs/02_FEATURES/features/reports-export.md |
| /api/exports/season-pack | GET | docs/02_FEATURES/features/reports-accountant-export.md<br>docs/02_FEATURES/features/reports-export.md<br>docs/02_FEATURES/features/reports-pausalni-obrt.md<br>docs/OPERATIONS_RUNBOOK.md |
| /api/health | GET | docs/02_FEATURES/features/system-status.md<br>docs/DEPLOYMENT.md<br>docs/LAUNCH_GAPS.md<br>docs/OPERATIONS_RUNBOOK.md<br>docs/_meta/audit-playbook.md<br>docs/deployment/docker-compose-health.yaml<br>docs/deployment/health-checks-k8s.yaml<br>docs/monitoring-architecture.md<br>docs/plans/2025-12-11-audit-phase2-implementation.md<br>docs/plans/2025-12-11-audit-phase4-final.md |
| /api/health/ready | GET | docs/02_FEATURES/features/system-status.md<br>docs/OPERATIONS_RUNBOOK.md<br>docs/_meta/audit-playbook.md<br>docs/deployment/docker-compose-health.yaml<br>docs/deployment/health-checks-k8s.yaml<br>docs/monitoring-architecture.md<br>docs/plans/2025-12-11-audit-phase2-implementation.md<br>docs/plans/2025-12-11-audit-phase4-final.md |
| /api/import/jobs/:id | GET | docs/02_FEATURES/features/documents-upload.md |
| /api/import/jobs/:id/confirm | PUT | None (inventory references only) |
| /api/import/jobs/:id/file | GET | None (inventory references only) |
| /api/import/jobs/:id/reject | PUT | None (inventory references only) |
| /api/import/jobs/:id/type | PUT | None (inventory references only) |
| /api/import/process | POST | docs/02_FEATURES/features/documents-upload.md<br>docs/plans/2024-12-14-universal-document-import-implementation.md<br>docs/plans/2024-12-14-universal-document-import.md |
| /api/import/upload | POST | docs/02_FEATURES/features/documents-management.md<br>docs/02_FEATURES/features/documents-upload.md<br>docs/plans/2024-12-14-universal-document-import-implementation.md<br>docs/plans/2024-12-14-universal-document-import.md |
| /api/invoices/:id/pdf | GET | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/documents-details.md<br>docs/02_FEATURES/features/invoicing-pdf.md<br>docs/02_FEATURES/features/invoicing-view.md |
| /api/metrics | GET | docs/02_FEATURES/features/admin-dashboard.md<br>docs/_meta/audit-playbook.md<br>docs/plans/2025-12-11-audit-phase4-final.md |
| /api/notifications | GET | None (inventory references only) |
| /api/notifications/read | POST | None (inventory references only) |
| /api/oib/lookup | POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/contacts-create.md<br>docs/02_FEATURES/features/contacts-oib-lookup.md |
| /api/products/import | POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/products-create.md<br>docs/02_FEATURES/features/products-import.md<br>docs/02_FEATURES/features/products-view.md |
| /api/receipts/upload | POST | docs/02_FEATURES/features/ai-receipt-extraction.md<br>docs/02_FEATURES/features/documents-upload.md<br>docs/02_FEATURES/features/expenses-create.md<br>docs/02_FEATURES/features/expenses-receipt-scanner.md |
| /api/receipts/view | GET | docs/02_FEATURES/features/invoicing-pdf.md |
| /api/reports/accountant-export | GET | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/accountant-dashboard.md<br>docs/02_FEATURES/features/reports-accountant-export.md<br>docs/02_FEATURES/features/reports-export.md |
| /api/reports/kpr | GET | docs/02_FEATURES/features/reports-kpr.md |
| /api/reports/kpr/excel | GET | docs/02_FEATURES/features/reports-kpr.md |
| /api/reports/kpr/pdf | GET | docs/02_FEATURES/features/reports-kpr.md |
| /api/reports/vat-threshold | GET,POST | docs/02_FEATURES/features/reports-pausalni-obrt.md<br>docs/02_FEATURES/features/reports-vat-threshold.md |
| /api/sandbox/e-invoice | POST | docs/02_FEATURES/features/e-invoicing-compliance.md |
| /api/status | GET | docs/02_FEATURES/features/system-status.md<br>docs/OPERATIONS_RUNBOOK.md<br>docs/deployment/docker-compose-health.yaml<br>docs/monitoring-architecture.md |
| /api/support/tickets | GET,POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/admin-support.md<br>docs/02_FEATURES/features/support-create.md<br>docs/02_FEATURES/features/support-details.md<br>docs/02_FEATURES/features/support-messaging.md<br>docs/02_FEATURES/features/support-view.md |
| /api/support/tickets/:id/messages | POST | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/support-details.md<br>docs/02_FEATURES/features/support-messaging.md |
| /api/support/tickets/:id/status | PATCH | docs/02_FEATURES/features/support-details.md<br>docs/02_FEATURES/features/support-messaging.md<br>docs/02_FEATURES/features/support-view.md |
| /api/support/tickets/summary | GET | docs/02_FEATURES/features/admin-support.md<br>docs/02_FEATURES/features/support-create.md<br>docs/02_FEATURES/features/support-view.md |
| /api/webauthn/login/finish | POST | docs/02_FEATURES/features/auth-2fa.md<br>docs/02_FEATURES/features/auth-login.md<br>docs/02_FEATURES/features/auth-passkeys.md |
| /api/webauthn/login/start | POST | docs/02_FEATURES/features/auth-2fa.md<br>docs/02_FEATURES/features/auth-login.md<br>docs/02_FEATURES/features/auth-passkeys.md |
| /api/webauthn/passkeys | GET | docs/02_FEATURES/FEATURE_REGISTRY.md<br>docs/02_FEATURES/features/auth-2fa.md<br>docs/02_FEATURES/features/auth-passkeys.md |
| /api/webauthn/passkeys/:id | DELETE | None (inventory references only) |
| /api/webauthn/register/finish | POST | docs/02_FEATURES/features/auth-2fa.md<br>docs/02_FEATURES/features/auth-passkeys.md |
| /api/webauthn/register/start | POST | docs/02_FEATURES/features/auth-2fa.md<br>docs/02_FEATURES/features/auth-passkeys.md |
| /api/webhooks/resend | POST | docs/02_FEATURES/features/invoicing-email.md |

## Missing documentation
- /api/auth/:...nextauth (GET,POST)
- /api/email/:connectionId/disconnect (DELETE)
- /api/import/jobs/:id/confirm (PUT)
- /api/import/jobs/:id/file (GET)
- /api/import/jobs/:id/reject (PUT)
- /api/import/jobs/:id/type (PUT)
- /api/notifications (GET)
- /api/notifications/read (POST)
- /api/webauthn/passkeys/:id (DELETE)

## Gap observations
- Most routes that do have mentions are covered by feature narratives rather than API references; request/response schemas, error formats, and pagination defaults are rarely specified.
- A few routes (for example, support ticket messaging) include full API details with method, auth, validation, and response structure.
- Several authentication and notification endpoints lack any feature-level documentation beyond their presence in the inventory list.

## Evidence
- Support ticket messaging documentation includes method, auth, request schema, response shape, and explicit error cases, demonstrating the expected level of API completeness.【F:docs/02_FEATURES/features/support-messaging.md†L51-L99】
- Banking connection documentation focuses on narrative flow and module references without request/response payloads or error format definitions, illustrating the gap for many endpoints.【F:docs/02_FEATURES/features/banking-connect.md†L13-L79】
- Route coverage and missing lists above are derived from a scan of `src/app/api` handlers paired with doc-path matches in `docs/`, distinguishing substantive feature docs from inventory listings.【F:docs/07_AUDITS/runs/docs-api-completeness-INV-020-021.md†L1-L53】
