# Open Issues Triage (2025-12-30)

Total open issues: 174
Priority counts:

- P0: 18
- P1: 26
- P2: 13
- P3: 6
- No priority label: 111

Criteria for top 50:

- All P0 and P1 issues
- Plus highest-risk P2 issues touching security or compliance/data-integrity

## Top 50 to Fix Now (Production)

1. #928 [TypeScript] Type Safety Audit Summary - 304 errors found (bug, priority:P0, type-safety)
2. #915 [TypeScript] Prisma schema drift - Missing models and fields (bug, priority:P0, type-safety)
3. #875 [Testing] Missing tests for fiscalization pipeline (Croatian tax authority integration) (priority:P0, testing, tech-debt)
4. #862 [Testing] Missing tests for authentication flows and session management (priority:P0, testing, tech-debt)
5. #675 [Storage] 11-year retention policy not implemented for document storage (bug, priority:P0, area:security)
6. #658 [Paušalni] Quarterly tax deadline dates incorrectly use quarter end dates instead of deadlines (bug, priority:P0, area:pausalni-obrt)
7. #593 [SECURITY] Email OAuth Callback Missing Authentication - Allows Hijacking Any Company (priority:P0, security)
8. #587 [Config][CRITICAL] Secrets committed to Git history - requires credential rotation (bug, priority:P0, security)
9. #579 [SECURITY] Cron Endpoints Bypass Authentication When CRON_SECRET Not Set (priority:P0, security)
10. #578 [Billing] Terminal payment PUT endpoint lacks company authorization check (bug, priority:P0, area:billing, area:security)
11. #575 [Billing] Failed payment handler incomplete - no user notification or grace period (bug, priority:P0, area:billing)
12. #565 [AUTH] Passkey/OTP authentication bypass via password prefix injection (priority:P0, area:security)
13. #564 [SECURITY] Hardcoded Admin Password with Weak Default (priority:P0, security)
14. #550 [FISCAL] ZKI validation allows negative amounts, violating fiscalization spec (bug, priority:P0, area:e-invoicing)
15. #547 [FISCAL] Race condition in fiscal queue processor - concurrent workers may double-process requests (bug, priority:P0, area:e-invoicing)
16. #546 [AUTH] Hardcoded fallback admin password in source code (priority:P0, area:security)
17. #539 [Server Actions] expense.ts: createExpenseCategory missing companyId in create (bug, priority:P0, area:security, server-actions)
18. #536 [Server Actions] premises.ts: Missing authentication and authorization checks (bug, priority:P0, area:security, server-actions)
19. #693 [DB] AuditLog missing onDelete: Cascade - orphans possible on company delete (bug, priority:P1, area:security, database)
20. #687 [Staff Portal] Missing audit logging for bulk export operations (bug, priority:P1, staff-portal)
21. #672 [AUTH] Missing RBAC permission checks in API routes (priority:P1, area:security)
22. #639 [AUTH] WebAuthn in-memory challenge store not production-ready (priority:P1, area:security)
23. #634 [DB] Missing indexes on EInvoice sellerId and buyerId foreign keys (bug, priority:P1, area:e-invoicing, database)
24. #633 [Server Actions] onboarding.ts: createMinimalCompany allows linking user to orphaned company without verification (bug, priority:P1, area:security, server-actions)
25. #628 [Storage] No virus/malware scanning for uploaded files (bug, priority:P1, area:security)
26. #624 [SECURITY] IDOR in Banking Import Job Status Update (priority:P1, security)
27. #623 [AUTH] Cron endpoints vulnerable without CRON_SECRET environment variable (priority:P1, area:security)
28. #621 [Billing] Stripe Terminal missing company ownership validation (bug, priority:P1, area:billing, area:security)
29. #619 [FISCAL] CIS communication timeout of 30s may be insufficient - requests marked failed prematurely (bug, priority:P1, area:e-invoicing)
30. #616 [DB] Missing index on FiscalRequest.certificateId foreign key (bug, priority:P1, database)
31. #612 [Billing] Missing entitlements/modules sync after subscription changes (bug, priority:P1, area:billing)
32. #604 [SECURITY] Bank Callback Missing Authentication - Allows Hijacking Bank Connections (priority:P1, security)
33. #601 [AUTH] Rate limiting fails open when Redis unavailable (priority:P1, area:security)
34. #584 [PAUSALNI] 60k EUR threshold comparison uses > instead of >= - off-by-one compliance error (bug, priority:P1, area:pausalni-obrt)
35. #576 [PAUSALNI] Tax bracket lookup uses exclusive max boundary - edge case tax miscalculation at 11300, 15300 EUR thresholds (bug, priority:P1, area:pausalni-obrt)
36. #573 [BANKING] Reconciliation matching uses floating-point comparison with 1 EUR tolerance - precision loss risk (bug, priority:P1, area:expenses)
37. #569 [Server Actions] invoice.ts: Missing audit logging for invoice operations (bug, priority:P1, server-actions)
38. #556 [AUTH] Dual admin auth mechanisms create inconsistent access control (priority:P1, area:security)
39. #553 [Billing] Race condition in subscription status synchronization (bug, priority:P1, area:billing)
40. #552 [FISCAL] Missing certificate expiry pre-check before queuing fiscal requests (bug, priority:P1, area:e-invoicing)
41. #551 [Billing] Missing webhook idempotency handling - duplicate events may cause inconsistent state (bug, priority:P1, area:billing)
42. #545 [Server Actions] support-ticket.ts: Missing 'use server' directive (bug, priority:P1, server-actions)
43. #541 [Server Actions] auth.ts: resetPassword lacks password strength validation (bug, priority:P1, area:security, server-actions)
44. #537 [Server Actions] article-agent.ts: Missing tenant isolation allows cross-company data access (bug, priority:P1, area:security, server-actions)
45. #664 [SECURITY] Metrics Endpoint Exposes Sensitive Business Data Without Authentication (priority:P2, security)
46. #637 [SECURITY] Resend Webhook Skips Signature Verification When Secret Not Set (priority:P2, security)
47. #622 [PAUSALNI] PDV form generator calculates 25% VAT without verifying rate matches transaction rate (bug, priority:P2, area:pausalni-obrt)
48. #614 [BANKING] Bank transaction dedup uses date window without timezone handling - duplicate transactions across DST boundaries (bug, priority:P2, area:integrations)
49. #590 [AUTH] User enumeration via check-email endpoint (priority:P2, area:security)
50. #582 [AUTH] Subdomain bypass via x-subdomain header in development mode (priority:P2, area:security)

## All Open Issues

| #    | Title                                                                                                                      | Labels                                          | Updated    |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| #928 | [TypeScript] Type Safety Audit Summary - 304 errors found                                                                  | bug, priority:P0, type-safety                   | 2025-12-29 |
| #927 | [TypeScript] 50+ unsafe type assertions using 'as unknown as'                                                              | bug, type-safety                                | 2025-12-29 |
| #918 | [TypeScript] Implicit any in function parameters - 20+ violations                                                          | bug, type-safety                                | 2025-12-29 |
| #917 | [TypeScript] 381 unsafe 'any' type usages across codebase                                                                  | bug, enhancement, type-safety                   | 2025-12-29 |
| #915 | [TypeScript] Prisma schema drift - Missing models and fields                                                               | bug, priority:P0, type-safety                   | 2025-12-29 |
| #913 | [DB] Database Schema Audit Summary - December 2025                                                                         | documentation, database                         | 2025-12-29 |
| #908 | [Testing] Missing tests for e-invoice UBL generation and provider integration                                              | area:e-invoicing, testing, tech-debt            | 2025-12-29 |
| #905 | [Testing] E2E tests skipped due to missing test credentials                                                                | testing, tech-debt                              | 2025-12-29 |
| #899 | [Testing] Missing integration tests for RBAC permission enforcement                                                        | testing, tech-debt                              | 2025-12-29 |
| #895 | [Testing] Missing E2E tests for payment flow and fiscalization journey                                                     | testing, tech-debt                              | 2025-12-29 |
| #886 | [Testing] Missing integration tests for server actions (invoice, expense, contact, banking)                                | area:invoicing, testing, tech-debt              | 2025-12-29 |
| #875 | [Testing] Missing tests for fiscalization pipeline (Croatian tax authority integration)                                    | priority:P0, testing, tech-debt                 | 2025-12-29 |
| #862 | [Testing] Missing tests for authentication flows and session management                                                    | priority:P0, testing, tech-debt                 | 2025-12-29 |
| #841 | [Testing] Missing unit tests for bank reconciliation matching logic                                                        | testing, tech-debt                              | 2025-12-29 |
| #823 | [Testing] Missing unit tests for Stripe billing/subscription logic                                                         | area:billing, testing, tech-debt                | 2025-12-29 |
| #789 | [RTL] Arbiter conflict resolution lacks evidence source hierarchy comparison                                               | bug, rtl-pipeline                               | 2025-12-29 |
| #785 | [Admin Portal] isGlobalAdmin function uses insecure email allowlist fallback                                               | bug, area:admin, security                       | 2025-12-29 |
| #738 | [DB] ClientInvitation.companyId missing onDelete behavior - orphaned invitations                                           | bug, database                                   | 2025-12-29 |
| #718 | [DB] StaffAssignment.assignedBy missing onDelete behavior and index                                                        | bug, database                                   | 2025-12-29 |
| #716 | [Errors] Sentry Client Missing beforeSend Filter for Sensitive Data                                                        | bug, enhancement                                | 2025-12-29 |
| #706 | [Middleware] Staff and App Subdomain Access Logic May Cause Confusion                                                      | enhancement, middleware                         | 2025-12-29 |
| #693 | [DB] AuditLog missing onDelete: Cascade - orphans possible on company delete                                               | bug, priority:P1, area:security, database       | 2025-12-29 |
| #692 | [Errors] Inconsistent 500 Error Response Format                                                                            | bug, enhancement                                | 2025-12-29 |
| #689 | [BANKING] CSV parser ignores currency field in parsed transactions - multi-currency reconciliation broken                  | bug, priority:P3, area:expenses                 | 2025-12-29 |
| #687 | [Staff Portal] Missing audit logging for bulk export operations                                                            | bug, priority:P1, staff-portal                  | 2025-12-29 |
| #685 | [Onboarding] Paušalni profile step blocks users when postal code lookup fails                                              | bug, area:onboarding, area:pausalni-obrt        | 2025-12-29 |
| #684 | [Visibility] VisibilityProvider not wrapped around Sidebar component                                                       | bug, visibility                                 | 2025-12-29 |
| #679 | [Server Actions] marketing-contact.ts: checkRateLimit uses wrong function signature                                        | bug, priority:P2, server-actions                | 2025-12-29 |
| #678 | [Config] Redis port exposed to all interfaces in docker-compose.workers.yml                                                | bug, security, config                           | 2025-12-29 |
| #677 | [Admin Portal] Missing audit logging for critical admin operations                                                         | bug, audit, area:admin, security                | 2025-12-29 |
| #676 | [AI] No input length validation on AI endpoints                                                                            | bug, area:ai                                    | 2025-12-29 |
| #675 | [Storage] 11-year retention policy not implemented for document storage                                                    | bug, priority:P0, area:security                 | 2025-12-29 |
| #674 | [Modules] DOO legal form includes reconciliation without banking dependency                                                | bug, modules                                    | 2025-12-29 |
| #673 | [Email] Microsoft OAuth revokeAccess is a no-op                                                                            | bug, email                                      | 2025-12-29 |
| #672 | [AUTH] Missing RBAC permission checks in API routes                                                                        | priority:P1, area:security                      | 2025-12-29 |
| #671 | [Expenses] updateExpenseInline allows setting totalAmount without updating net/VAT                                         | bug, area:expenses                              | 2025-12-29 |
| #670 | [E-Invoice] Mock provider generates invalid ZKI format                                                                     | bug, area:e-invoicing                           | 2025-12-29 |
| #669 | [Cron] fiscal-retry: Sends alerts but relies only on console.warn for ops visibility                                       | bug, area:integrations, cron, infrastructure    | 2025-12-29 |
| #668 | [Frontend] SuggestionChips uses array index as key prop                                                                    | bug, area:ux, ai-assistant                      | 2025-12-29 |
| #667 | [DB] Missing index on Expense vendorId foreign key                                                                         | bug, area:expenses, database                    | 2025-12-29 |
| #666 | [Errors] API Routes Use console.error Instead of Structured Logger                                                         | bug, enhancement                                | 2025-12-29 |
| #665 | [Email] Deadline reminder emails use raw HTML without sanitization                                                         | bug, email                                      | 2025-12-29 |
| #664 | [SECURITY] Metrics Endpoint Exposes Sensitive Business Data Without Authentication                                         | priority:P2, security                           | 2025-12-29 |
| #663 | [Support] Missing company filter in getSupportTickets - Returns all tickets across companies                               | bug, area:support                               | 2025-12-29 |
| #662 | [Email] Email import rules vulnerable to regex injection via senderDomain/subjectContains                                  | bug, email                                      | 2025-12-29 |
| #661 | [Staff Portal] Bulk export API bypasses ADMIN assignment check                                                             | bug, staff-portal                               | 2025-12-29 |
| #660 | [Reports] Timezone handling bug in date filtering - uses local server time                                                 | bug, reports                                    | 2025-12-29 |
| #659 | [Visibility] action:export-data element ID never used in codebase                                                          | bug, visibility                                 | 2025-12-29 |
| #658 | [Paušalni] Quarterly tax deadline dates incorrectly use quarter end dates instead of deadlines                             | bug, priority:P0, area:pausalni-obrt            | 2025-12-29 |
| #657 | [Config] Inconsistent CRON_SECRET validation across endpoints                                                              | bug, security, config                           | 2025-12-29 |
| #656 | [Visibility] Registered elements without visibility rules                                                                  | bug, visibility                                 | 2025-12-29 |
| #655 | [Server Actions] guidance.ts: saveCompetenceLevel missing input validation                                                 | bug, priority:P3, server-actions                | 2025-12-29 |
| #654 | [Admin Portal] Dual authentication system creates inconsistent access control                                              | bug, area:admin, security                       | 2025-12-29 |
| #653 | [Middleware] Potential Redirect Loop with Nested Subdomains                                                                | bug, middleware                                 | 2025-12-29 |
| #652 | [AI] Potential prompt injection vulnerability in receipt extraction                                                        | bug, area:ai                                    | 2025-12-29 |
| #651 | [Marketing] Broken Navigation Links in MarketingHeader                                                                     | bug, marketing                                  | 2025-12-29 |
| #650 | [E-Invoice] Incoming invoice buyer/seller role confusion                                                                   | bug, area:e-invoicing                           | 2025-12-29 |
| #649 | [DB] Missing index on RecurringExpense vendorId and categoryId foreign keys                                                | bug, area:expenses, database                    | 2025-12-29 |
| #648 | [Frontend] MultiSelect dropdown missing click outside handler                                                              | bug, area:ux, design-system                     | 2025-12-29 |
| #647 | [Modules] getEntitlementsForLegalForm includes 'expenses' multiple times                                                   | bug, modules                                    | 2025-12-29 |
| #646 | [Visibility] card:compliance-status uses same element ID as fiscalization-status                                           | bug, visibility                                 | 2025-12-29 |
| #645 | [Support] Missing company filter in getSupportTicket - IDOR vulnerability                                                  | bug, area:support                               | 2025-12-29 |
| #644 | [Onboarding] Address step skip leaves empty placeholder values in database                                                 | bug, area:onboarding, area:e-invoicing          | 2025-12-29 |
| #643 | [Storage] No signed URLs for R2 storage - direct buffer serving                                                            | enhancement, area:security                      | 2025-12-29 |
| #642 | [Cron] bank-sync: Missing error notification for sync failures                                                             | bug, area:integrations, cron, infrastructure    | 2025-12-29 |
| #641 | [Errors] Server Actions Not Using createSafeAction Wrapper                                                                 | bug, enhancement                                | 2025-12-29 |
| #640 | [Expenses] Missing expense edit page - no way to modify existing expenses                                                  | bug, area:expenses                              | 2025-12-29 |
| #639 | [AUTH] WebAuthn in-memory challenge store not production-ready                                                             | priority:P1, area:security                      | 2025-12-29 |
| #638 | [Staff Portal] Batch review API bypasses ADMIN assignment check                                                            | bug, staff-portal                               | 2025-12-29 |
| #637 | [SECURITY] Resend Webhook Skips Signature Verification When Secret Not Set                                                 | priority:P2, security                           | 2025-12-29 |
| #636 | [Admin Portal] Critical: Hardcoded default admin password with weak value                                                  | bug, area:admin, security                       | 2025-12-29 |
| #635 | [E-Invoice] Invoice editing allows data changes after fiscalization                                                        | bug, area:e-invoicing                           | 2025-12-29 |
| #634 | [DB] Missing indexes on EInvoice sellerId and buyerId foreign keys                                                         | bug, priority:P1, area:e-invoicing, database    | 2025-12-29 |
| #633 | [Server Actions] onboarding.ts: createMinimalCompany allows linking user to orphaned company without verification          | bug, priority:P1, area:security, server-actions | 2025-12-29 |
| #632 | [AI] Assistant API missing usage tracking                                                                                  | bug, area:ai                                    | 2025-12-29 |
| #631 | [Modules] pausalni page uses legalForm check instead of module entitlement                                                 | bug, modules                                    | 2025-12-29 |
| #630 | [Cron] email-sync: No timeout or maxDuration configuration                                                                 | bug, cron, infrastructure                       | 2025-12-29 |
| #629 | [Expenses] Fuel category hardcodes 50% VAT deductibility but implementation ignores it                                     | bug, area:expenses                              | 2025-12-29 |
| #628 | [Storage] No virus/malware scanning for uploaded files                                                                     | bug, priority:P1, area:security                 | 2025-12-29 |
| #627 | [Middleware] Missing CSP: frame-src and worker-src Directives                                                              | bug, security, middleware                       | 2025-12-29 |
| #626 | [Errors] API Routes Missing Centralized withApiLogging Wrapper                                                             | bug, enhancement                                | 2025-12-29 |
| #625 | [Config] Turnstile bot protection bypassed in development mode                                                             | bug, security, config                           | 2025-12-29 |
| #624 | [SECURITY] IDOR in Banking Import Job Status Update                                                                        | priority:P1, security                           | 2025-12-29 |
| #623 | [AUTH] Cron endpoints vulnerable without CRON_SECRET environment variable                                                  | priority:P1, area:security                      | 2025-12-29 |
| #622 | [PAUSALNI] PDV form generator calculates 25% VAT without verifying rate matches transaction rate                           | bug, priority:P2, area:pausalni-obrt            | 2025-12-29 |
| #621 | [Billing] Stripe Terminal missing company ownership validation                                                             | bug, priority:P1, area:billing, area:security   | 2025-12-29 |
| #620 | [E-Invoice] PDF generation missing credit note and debit note handling                                                     | bug, area:e-invoicing                           | 2025-12-29 |
| #619 | [FISCAL] CIS communication timeout of 30s may be insufficient - requests marked failed prematurely                         | bug, priority:P1, area:e-invoicing              | 2025-12-29 |
| #618 | [Billing] No handling of subscription proration or plan changes via webhook                                                | enhancement, priority:P2, area:billing          | 2025-12-29 |
| #617 | [Email] Staff invitation email sending is not implemented                                                                  | bug, email                                      | 2025-12-29 |
| #616 | [DB] Missing index on FiscalRequest.certificateId foreign key                                                              | bug, priority:P1, database                      | 2025-12-29 |
| #615 | [Onboarding] Competence level not saved when step is skipped                                                               | bug, area:onboarding, area:ux                   | 2025-12-29 |
| #614 | [BANKING] Bank transaction dedup uses date window without timezone handling - duplicate transactions across DST boundaries | bug, priority:P2, area:integrations             | 2025-12-29 |
| #613 | [AI] Assistant API missing rate limiting                                                                                   | bug, area:ai                                    | 2025-12-29 |
| #612 | [Billing] Missing entitlements/modules sync after subscription changes                                                     | bug, priority:P1, area:billing                  | 2025-12-29 |
| #611 | [Cron] bank-sync: Missing timeout handling for external API calls                                                          | bug, area:integrations, cron, infrastructure    | 2025-12-29 |
| #610 | [Modules] Middleware doesn't enforce module-level route protection                                                         | bug, modules                                    | 2025-12-29 |
| #609 | [Storage] No magic byte validation for uploaded files - extension-only check                                               | bug, area:security                              | 2025-12-29 |
| #608 | [Expenses] No validation that totalAmount equals netAmount + vatAmount                                                     | bug, area:expenses                              | 2025-12-29 |
| #607 | [Email] Email templates do not include List-Unsubscribe header for transactional emails                                    | bug, email                                      | 2025-12-29 |
| #606 | [Visibility] Unused sub-stages in progression logic                                                                        | bug, visibility                                 | 2025-12-29 |
| #605 | [Config] TypeScript build errors ignored in production builds                                                              | bug, config                                     | 2025-12-29 |
| #604 | [SECURITY] Bank Callback Missing Authentication - Allows Hijacking Bank Connections                                        | priority:P1, security                           | 2025-12-29 |
| #603 | [Server Actions] fiscalize.ts: Exposing internal error messages to clients                                                 | bug, priority:P3, server-actions                | 2025-12-29 |
| #602 | [Middleware] Security: Host Header Injection Risk via x-forwarded-host                                                     | bug, security, middleware                       | 2025-12-29 |
| #601 | [AUTH] Rate limiting fails open when Redis unavailable                                                                     | priority:P1, area:security                      | 2025-12-29 |
| #600 | [E-Invoice] VAT calculation precision issues with Decimal type conversion                                                  | bug, area:e-invoicing                           | 2025-12-29 |
| #599 | [Visibility] Missing element IDs for several navigation items                                                              | bug, visibility                                 | 2025-12-29 |
| #598 | [Email] Resend webhook signature verification is optional                                                                  | bug, email                                      | 2025-12-29 |
| #597 | [Cron] fiscal-processor and fiscal-retry: Potential race condition on same records                                         | bug, area:integrations, cron, infrastructure    | 2025-12-29 |
| #596 | [Visibility] Mobile navigation missing module entitlements filtering                                                       | bug, visibility                                 | 2025-12-29 |
| #595 | [Config] Missing startup environment validation for required secrets                                                       | bug, config                                     | 2025-12-29 |
| #594 | [Modules] API routes lack module entitlement checks                                                                        | bug, modules                                    | 2025-12-29 |
| #593 | [SECURITY] Email OAuth Callback Missing Authentication - Allows Hijacking Any Company                                      | priority:P0, security                           | 2025-12-29 |
| #592 | [Middleware] Missing CORS Configuration for API Routes                                                                     | bug, middleware                                 | 2025-12-29 |
| #591 | [Server Actions] Duplicate switchCompany and getUserCompanies functions in company.ts and company-switch.ts                | bug, priority:P3, server-actions                | 2025-12-29 |
| #590 | [AUTH] User enumeration via check-email endpoint                                                                           | priority:P2, area:security                      | 2025-12-29 |
| #589 | [E-Invoice] Provider factory throws not implemented for ie-racuni but provider exists                                      | bug, area:e-invoicing                           | 2025-12-29 |
| #588 | [Cron] bank-sync and email-sync run at same time (05:00) causing potential resource contention                             | bug, cron, infrastructure                       | 2025-12-29 |
| #587 | [Config][CRITICAL] Secrets committed to Git history - requires credential rotation                                         | bug, priority:P0, security                      | 2025-12-29 |
| #586 | [Billing] Webhook error handling returns 500 for signature validation failures                                             | bug, priority:P2, area:billing                  | 2025-12-29 |
| #585 | [Modules] capabilities.ts defaultEntitlements differs from definitions.ts DEFAULT_ENTITLEMENTS                             | bug, modules                                    | 2025-12-29 |
| #584 | [PAUSALNI] 60k EUR threshold comparison uses > instead of >= - off-by-one compliance error                                 | bug, priority:P1, area:pausalni-obrt            | 2025-12-29 |
| #583 | [Server Actions] banking.ts: importBankStatement missing input validation with Zod                                         | bug, priority:P2, server-actions                | 2025-12-29 |
| #582 | [AUTH] Subdomain bypass via x-subdomain header in development mode                                                         | priority:P2, area:security                      | 2025-12-29 |
| #581 | [E-Invoice] Unarchive restores invoice to DELIVERED status regardless of original status                                   | bug, area:e-invoicing                           | 2025-12-29 |
| #580 | [Middleware] Security: Unused x-subdomain Override Header Could Enable Subdomain Spoofing                                  | bug, security, middleware                       | 2025-12-29 |
| #579 | [SECURITY] Cron Endpoints Bypass Authentication When CRON_SECRET Not Set                                                   | priority:P0, security                           | 2025-12-29 |
| #578 | [Billing] Terminal payment PUT endpoint lacks company authorization check                                                  | bug, priority:P0, area:billing, area:security   | 2025-12-29 |
| #577 | [Cron] email-sync: Same weak authentication bypass issue                                                                   | bug, area:security, cron, infrastructure        | 2025-12-29 |
| #576 | [PAUSALNI] Tax bracket lookup uses exclusive max boundary - edge case tax miscalculation at 11300, 15300 EUR thresholds    | bug, priority:P1, area:pausalni-obrt            | 2025-12-29 |
| #575 | [Billing] Failed payment handler incomplete - no user notification or grace period                                         | bug, priority:P0, area:billing                  | 2025-12-29 |
| #574 | [Email] OAuth callback lacks CSRF protection via state parameter validation                                                | bug, email                                      | 2025-12-29 |
| #573 | [BANKING] Reconciliation matching uses floating-point comparison with 1 EUR tolerance - precision loss risk                | bug, priority:P1, area:expenses                 | 2025-12-29 |
| #572 | [Visibility] profit-loss reports page missing route protection                                                             | bug, visibility                                 | 2025-12-29 |
| #571 | [Email] No rate limiting on invoice email sending                                                                          | bug, email                                      | 2025-12-29 |
| #570 | [E-Invoice] EN16931 validator missing critical business rules (BR-\* rules)                                                | bug, area:e-invoicing                           | 2025-12-29 |
| #569 | [Server Actions] invoice.ts: Missing audit logging for invoice operations                                                  | bug, priority:P1, server-actions                | 2025-12-29 |
| #568 | [Visibility] pausalni-obrt reports page missing route protection                                                           | bug, visibility                                 | 2025-12-29 |
| #567 | [Modules] FeatureGuard component missing critical modules                                                                  | bug, modules                                    | 2025-12-29 |
| #566 | [Email] Unsubscribe token is insecure - uses plain base64 encoding                                                         | bug, email                                      | 2025-12-29 |
| #565 | [AUTH] Passkey/OTP authentication bypass via password prefix injection                                                     | priority:P0, area:security                      | 2025-12-29 |
| #564 | [SECURITY] Hardcoded Admin Password with Weak Default                                                                      | priority:P0, security                           | 2025-12-29 |
| #563 | [Cron] bank-sync: Weak authentication bypass when CRON_SECRET unset                                                        | bug, area:security, cron, infrastructure        | 2025-12-29 |
| #562 | [Middleware] Test-Implementation Mismatch: Localhost returns 'marketing' but test expects 'app'                            | bug, middleware                                 | 2025-12-29 |
| #561 | [Visibility] ActionCards component bypasses visibility system                                                              | bug, visibility                                 | 2025-12-29 |
| #560 | [E-Invoice] Missing invoice type (R-1/R-2) handling for Croatian compliance                                                | bug, area:e-invoicing                           | 2025-12-29 |
| #559 | [Server Actions] expense.ts: Missing audit logging for sensitive expense operations                                        | bug, priority:P2, server-actions                | 2025-12-29 |
| #558 | [Modules] Stripe plans don't sync entitlements to Company.entitlements                                                     | bug, modules                                    | 2025-12-29 |
| #557 | [Billing] Incomplete subscription period date handling                                                                     | bug, priority:P2, area:billing                  | 2025-12-29 |
| #556 | [AUTH] Dual admin auth mechanisms create inconsistent access control                                                       | priority:P1, area:security                      | 2025-12-29 |
| #555 | [Server Actions] pos.ts: Validation before auth allows unauthenticated probing                                             | bug, priority:P3, area:security, server-actions | 2025-12-29 |
| #554 | [E-Invoice] ZKI calculation uses SHA256 in demo mode instead of proper format                                              | bug, area:e-invoicing                           | 2025-12-29 |
| #553 | [Billing] Race condition in subscription status synchronization                                                            | bug, priority:P1, area:billing                  | 2025-12-29 |
| #552 | [FISCAL] Missing certificate expiry pre-check before queuing fiscal requests                                               | bug, priority:P1, area:e-invoicing              | 2025-12-29 |
| #551 | [Billing] Missing webhook idempotency handling - duplicate events may cause inconsistent state                             | bug, priority:P1, area:billing                  | 2025-12-29 |
| #550 | [FISCAL] ZKI validation allows negative amounts, violating fiscalization spec                                              | bug, priority:P0, area:e-invoicing              | 2025-12-29 |
| #549 | [Modules] Missing entitlement check on /invoices, /banking, /pos, /expenses pages                                          | bug, modules                                    | 2025-12-29 |
| #548 | [E-Invoice] Invoice number sequence race condition in preview vs actual allocation                                         | bug, area:e-invoicing                           | 2025-12-29 |
| #547 | [FISCAL] Race condition in fiscal queue processor - concurrent workers may double-process requests                         | bug, priority:P0, area:e-invoicing              | 2025-12-29 |
| #546 | [AUTH] Hardcoded fallback admin password in source code                                                                    | priority:P0, area:security                      | 2025-12-29 |
| #545 | [Server Actions] support-ticket.ts: Missing 'use server' directive                                                         | bug, priority:P1, server-actions                | 2025-12-29 |
| #544 | [E-Invoice] Missing EN16931 required BG-4 Seller contact element                                                           | bug, area:e-invoicing                           | 2025-12-29 |
| #543 | [Server Actions] company.ts: Race condition in switchCompany transaction                                                   | bug, priority:P3, server-actions                | 2025-12-29 |
| #542 | [E-Invoice] UBL generator hardcodes currency to EUR in line items                                                          | bug, area:e-invoicing                           | 2025-12-29 |
| #541 | [Server Actions] auth.ts: resetPassword lacks password strength validation                                                 | bug, priority:P1, area:security, server-actions | 2025-12-29 |
| #540 | [E-Invoice] UBL generator missing OrderReference element (EN16931 BT-13)                                                   | bug, area:e-invoicing                           | 2025-12-29 |
| #539 | [Server Actions] expense.ts: createExpenseCategory missing companyId in create                                             | bug, priority:P0, area:security, server-actions | 2025-12-29 |
| #538 | [Server Actions] newsletter.ts: Missing rate limiting allows subscription spam                                             | bug, priority:P2, server-actions                | 2025-12-29 |
| #537 | [Server Actions] article-agent.ts: Missing tenant isolation allows cross-company data access                               | bug, priority:P1, area:security, server-actions | 2025-12-29 |
| #536 | [Server Actions] premises.ts: Missing authentication and authorization checks                                              | bug, priority:P0, area:security, server-actions | 2025-12-29 |
| #526 | Fix #217 Batch 7: Admin + Staff Pages - Replace hardcoded Tailwind colors                                                  | design-system                                   | 2025-12-29 |
| #217 | [Audit/UI] Widespread hardcoded Tailwind colors in 137+ component files                                                    | enhancement, audit, design-system               | 2025-12-29 |
| #166 | [AUDIT] RTL: All 1,995 SourcePointers Pending Verification                                                                 | rtl-pipeline, audit                             | 2025-12-29 |
