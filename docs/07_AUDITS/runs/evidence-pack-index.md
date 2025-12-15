# Evidence Pack Index

## Table of contents
- [Quick-open checklist](#quick-open-checklist)
- [Core references](#core-references)
  - [Invariants](#invariants)
  - [OWASP checklist](#owasp-checklist)
- [Audit run reports](#audit-run-reports)
- [Inventories used](#inventories-used)
- [Evidence by area](#evidence-by-area)
  - [Security](#security)
  - [Compliance and fiscalization](#compliance-and-fiscalization)
  - [Data retention controls](#data-retention-controls)
- [Evidence highlights](#evidence-highlights)

## Quick-open checklist
1. Open the invariants to understand non-negotiable system rules: `../../_meta/invariants.md`.
2. Review the OWASP Top 10 checklist in `../../_meta/audit-playbook.md` to see expected security controls.
3. Scan the latest audit run reports under `/audit` to view security, performance, and UX findings.
4. Consult inventories in `../../_meta/inventory/` to trace routes, actions, services, and data stores.
5. Verify fiscalization pipeline evidence in `../../../FISCALIZATION.md`, `../../../README-FISCALIZATION.md`, and `../../../src/lib/fiscal/`.
6. Confirm retention controls through `../../../src/lib/archive/archive-manager.ts` and supporting retention notes in `../../02_FEATURES/features/legal-privacy.md`.

## Core references

### Invariants
- Canonical invariants: `../../_meta/invariants.md`.

### OWASP checklist
- Security checklist (OWASP Top 10): `../../_meta/audit-playbook.md#15-owasp-top-10`.

## Audit run reports
- Accessibility: `/audit/accessibility-audit.md`
- Architecture and code quality: `/audit/code-quality-architecture.md`
- DevEx & CI: `/audit/devex-ci-audit.md`
- Domain & data: `/audit/domain-data-audit.md`
- Fiscalization and modularization readiness: `/audit/modularization-legal-forms.md`
- Gap analysis: `/audit/gap-analysis.md` and `/audit/gap-analysis-jira.md`
- Implementation plan overview: `/audit/implementation-plan.md`
- Passkeys and WebAuthn: `/audit/passkeys-webauthn-plan.md`
- Performance: `/audit/performance-audit.md`
- Security: `/audit/security-audit.md`
- UI/UX (including refresh runs): `/audit/ui-ux-audit.md`, `/audit/ui-ux-refresh-2025-12-10.md`, `/audit/ui-ux-refresh-2025-12-10-v2.md`
- Work log reference: `/audit/work-log-2025-02-14.md`

## Inventories used
- Actions and server logic: `../../_meta/inventory/actions.json`
- API endpoints: `../../_meta/inventory/api-endpoints.json`
- Routes and components: `../../_meta/inventory/routes.json`, `../../_meta/inventory/components.json`
- Data layer: `../../_meta/inventory/db-tables.json`, `../../_meta/inventory/databases.md`
- Services and integrations: `../../_meta/inventory/services.md`, `../../_meta/inventory/integrations.md`
- Runtime and environment references: `../../_meta/inventory/runtimes.md`, `../../_meta/inventory/env-vars.md`, `../../_meta/inventory/ports.md`
- Storage footprint: `../../_meta/inventory/storage-locations.md`
- Scheduled jobs: `../../_meta/inventory/cron-jobs.md`

## Evidence by area

### Security
- OWASP checklist with control expectations: `../../_meta/audit-playbook.md#15-owasp-top-10`.
- Security audit findings and remediation notes: `/audit/security-audit.md`.
- Authentication and authorization code references: `../../../src/lib/auth.ts`, `../../../src/lib/rbac.ts`, and `../../../src/middleware.ts`.

### Compliance and fiscalization
- Fiscalization overview and operational notes: `../../../FISCALIZATION.md` and `../../../README-FISCALIZATION.md`.
- Pipeline implementation and evidence: `../../../src/lib/fiscal/fiscal-pipeline.ts`, `../../../src/lib/fiscal/xml-builder.ts`, `../../../src/lib/fiscal/xml-signer.ts`, and `../../../src/lib/e-invoice/zki.ts`.
- EN 16931 validation and e-invoice provider integration: `../../../src/lib/compliance/en16931-validator.ts` and `../../../src/lib/e-invoice/providers/ie-racuni.ts`.

### Data retention controls
- Archive manager enforcing 11-year retention defaults and purge logic: `../../../src/lib/archive/archive-manager.ts`.
- Retention expectations in privacy and legal disclosures: `../../02_FEATURES/features/legal-privacy.md` and related retention checklists in `../../02_FEATURES/features/legal-cookies.md`.

## Evidence highlights
- Start with invariants and OWASP checklist to align on required controls before reviewing detailed reports.
- Use the audit run reports to confirm the status of security, performance, UX, and fiscalization checks.
- Cross-check inventories to map evidence (routes, services, storage) to the corresponding audit items.
- For fiscalization, combine documentation (`FISCALIZATION.md`) with pipeline code under `src/lib/fiscal/` for end-to-end traceability.
- For retention, pair the archive manager implementation with published retention commitments in the legal and privacy feature docs.
