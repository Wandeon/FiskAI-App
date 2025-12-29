# Feature Registry

> Central tracker for all FiskAI features. Updated by documentation agents.

**Last Updated:** 2025-12-28
**Total Features:** 108
**Coverage:** 100% (108/108 documented)

## Status Legend

| Symbol | Status          | Meaning                                                              |
| ------ | --------------- | -------------------------------------------------------------------- |
| `[I]`  | **Implemented** | Production-ready. Routes exist, functionality works.                 |
| `[P]`  | **Partial**     | Core works but entry point changed or functionality moved.           |
| `[S]`  | **Scaffold**    | Entry point exists but functionality is stub/placeholder/model-only. |
| `[D]`  | **Designed**    | Documented specification exists. No code yet.                        |
| `[X]`  | **Deprecated**  | Sunset announced. See deprecation registry for timeline.             |

> **Policy:** PRs marking features "done" must update status accurately. See [docs/STATUS.md](../STATUS.md) for module-level status.

## Deprecation Lifecycle

Features follow a defined lifecycle for deprecation:

1. **Active** - Feature is fully supported
2. **Deprecated** - Sunset date announced, deprecation warnings shown
3. **Sunset** - Feature removed or disabled

When deprecating a feature:

1. Add entry to `src/lib/deprecation/registry.ts`
2. Update status in this registry to `[X]`
3. Add `<DeprecationNotice>` component to affected routes
4. Document migration path if applicable
5. Announce via release notes

See `src/lib/deprecation/` for the deprecation system implementation.

## Registry

| ID                | Feature                       | Category      | Status | Entry Point                        | Complexity | Doc                                        |
| ----------------- | ----------------------------- | ------------- | ------ | ---------------------------------- | ---------- | ------------------------------------------ |
| **AUTH**          |
| F001              | User Registration             | Auth          | [I]    | /register                          | Medium     | [→](features/auth-login.md)                |
| F002              | User Login                    | Auth          | [I]    | /login                             | Medium     | [→](features/auth-registration.md)         |
| F003              | Password Reset                | Auth          | [I]    | /forgot-password                   | Medium     | [→](features/auth-2fa.md)                  |
| F004              | WebAuthn/Passkey Login        | Auth          | [I]    | /api/webauthn/login/\*             | High       | [→](features/auth-passkeys.md)             |
| F005              | Passkey Management            | Auth          | [I]    | /settings + /api/webauthn/passkeys | Medium     | [→](features/auth-session.md)              |
| F006              | Admin Login                   | Auth          | [I]    | /admin-login                       | Low        | [→](features/auth-password-reset.md)       |
| **DASHBOARD**     |
| F007              | Main Dashboard                | Dashboard     | [I]    | /dashboard                         | High       | [→](features/dashboard-main.md)            |
| F008              | Quick Stats Display           | Dashboard     | [I]    | /dashboard                         | Medium     | [→](features/dashboard-quick-stats.md)     |
| F009              | Revenue Trends                | Dashboard     | [I]    | /dashboard                         | Medium     | [→](features/dashboard-revenue-trends.md)  |
| F010              | Invoice Funnel                | Dashboard     | [I]    | /dashboard                         | Medium     | [→](features/dashboard-invoice-funnel.md)  |
| F011              | Recent Activity Feed          | Dashboard     | [I]    | /dashboard                         | Medium     | [→](features/dashboard-recent-activity.md) |
| F012              | Action Cards                  | Dashboard     | [I]    | /dashboard                         | Low        | [→](features/dashboard-action-cards.md)    |
| F013              | VAT Overview                  | Dashboard     | [I]    | /dashboard                         | Medium     | [→](features/dashboard-vat-overview.md)    |
| F014              | Onboarding Checklist          | Dashboard     | [I]    | /onboarding                        | Medium     | [→](features/dashboard-onboarding.md)      |
| **INVOICING**     |
| F015              | Create Invoice                | Invoicing     | [I]    | /invoices/new                      | High       | [→](features/invoicing-create.md)          |
| F016              | View Invoices                 | Invoicing     | [P]    | → /documents?category=invoice      | High       | [→](features/invoicing-view.md)            |
| F017              | Edit Invoice                  | Invoicing     | [I]    | /invoices/:id                      | High       | [→](features/invoicing-edit.md)            |
| F018              | Invoice PDF Generation        | Invoicing     | [I]    | /api/invoices/:id/pdf              | Medium     | [→](features/invoicing-pdf.md)             |
| F019              | Invoice Email Delivery        | Invoicing     | [I]    | API + Actions                      | Medium     | [→](features/invoicing-email.md)           |
| F020              | Invoice Filtering             | Invoicing     | [P]    | → /documents (via hub)             | Medium     | [→](features/invoicing-filtering.md)       |
| F021              | Mark Invoice as Paid          | Invoicing     | [I]    | /invoices/:id                      | Low        | [→](features/invoicing-mark-paid.md)       |
| F022              | Convert to Invoice            | Invoicing     | [I]    | Actions                            | Medium     | [→](features/invoicing-convert.md)         |
| **E-INVOICING**   |
| F023              | Create E-Invoice              | E-Invoicing   | [I]    | /e-invoices/new                    | High       | [→](features/e-invoicing-create.md)        |
| F024              | View E-Invoices               | E-Invoicing   | [I]    | /e-invoices                        | Medium     | [→](features/e-invoicing-view.md)          |
| F025              | E-Invoice Details             | E-Invoicing   | [I]    | /e-invoices/:id                    | Medium     | [→](features/e-invoicing-details.md)       |
| F026              | Send E-Invoice                | E-Invoicing   | [I]    | Actions                            | Medium     | [→](features/e-invoicing-send.md)          |
| F027              | Receive E-Invoice             | E-Invoicing   | [I]    | /api/e-invoices/receive            | Medium     | [→](features/e-invoicing-receive.md)       |
| F028              | E-Invoice Compliance Check    | E-Invoicing   | [I]    | /api/compliance/en16931            | Medium     | [→](features/e-invoicing-compliance.md)    |
| **EXPENSES**      |
| F029              | Create Expense                | Expenses      | [I]    | /expenses/new                      | Medium     | [→](features/expenses-create.md)           |
| F030              | View Expenses                 | Expenses      | [P]    | → /documents?category=expense      | High       | [→](features/expenses-view.md)             |
| F031              | Edit Expense                  | Expenses      | [I]    | /expenses/:id                      | Medium     | [→](features/expenses-edit.md)             |
| F032              | Receipt Scanner               | Expenses      | [I]    | /expenses/new                      | High       | [→](features/expenses-receipt-scanner.md)  |
| F033              | Expense Categories            | Expenses      | [I]    | /expenses/categories               | Medium     | [→](features/expenses-categories.md)       |
| F034              | Expense Filtering             | Expenses      | [P]    | → /documents (via hub)             | Medium     | [→](features/expenses-filtering.md)        |
| F035              | Mark Expense as Paid          | Expenses      | [I]    | /expenses/:id                      | Low        | [→](features/expenses-mark-paid.md)        |
| F036              | Recurring Expenses            | Expenses      | [S]    | Model only (no UI/actions)         | Medium     | [→](features/expenses-recurring.md)        |
| **BANKING**       |
| F037              | View Bank Accounts            | Banking       | [I]    | /banking/accounts                  | Medium     | [→](features/banking-accounts.md)          |
| F038              | Connect Bank Account          | Banking       | [I]    | /api/bank/connect                  | High       | [→](features/banking-connect.md)           |
| F039              | Disconnect Bank Account       | Banking       | [I]    | /api/bank/disconnect               | Low        | [→](features/banking-disconnect.md)        |
| F040              | View Bank Transactions        | Banking       | [I]    | /banking/transactions              | High       | [→](features/banking-transactions.md)      |
| F041              | Import Bank Statement         | Banking       | [I]    | /banking/import                    | High       | [→](features/banking-import.md)            |
| F042              | Bank Reconciliation           | Banking       | [I]    | /banking/reconciliation            | High       | [→](features/banking-reconciliation.md)    |
| F043              | Auto-Match Transactions       | Banking       | [I]    | /api/banking/reconciliation/match  | High       | [→](features/banking-auto-match.md)        |
| F044              | Manual Transaction Matching   | Banking       | [I]    | Actions                            | Medium     | [→](features/banking-manual-match.md)      |
| F045              | Banking Documents             | Banking       | [P]    | → /documents?category=bank-stmt    | Medium     | [→](features/banking-documents.md)         |
| **CONTACTS**      |
| F046              | Create Contact                | Contacts      | [I]    | /contacts/new                      | Medium     | [→](features/contacts-create.md)           |
| F047              | View Contacts                 | Contacts      | [I]    | /contacts                          | Medium     | [→](features/contacts-view.md)             |
| F048              | Edit Contact                  | Contacts      | [I]    | /contacts/:id/edit                 | Medium     | [→](features/contacts-edit.md)             |
| F049              | Contact Details               | Contacts      | [I]    | /contacts/:id                      | Medium     | [→](features/contacts-details.md)          |
| F050              | Contact Filtering             | Contacts      | [I]    | /contacts                          | Low        | [→](features/contacts-filtering.md)        |
| F051              | OIB Lookup                    | Contacts      | [I]    | /api/oib/lookup                    | Low        | [→](features/contacts-oib-lookup.md)       |
| **PRODUCTS**      |
| F052              | Create Product                | Products      | [I]    | /products/new                      | Medium     | [→](features/products-create.md)           |
| F053              | View Products                 | Products      | [I]    | /products                          | Medium     | [→](features/products-view.md)             |
| F054              | Edit Product                  | Products      | [I]    | /products/:id/edit                 | Medium     | [→](features/products-edit.md)             |
| F055              | Product CSV Import            | Products      | [I]    | /api/products/import               | Medium     | [→](features/products-import.md)           |
| **REPORTS**       |
| F056              | KPR Report                    | Reports       | [I]    | /reports/kpr                       | High       | [→](features/reports-kpr.md)               |
| F057              | VAT Report                    | Reports       | [I]    | /reports/vat                       | High       | [→](features/reports-vat.md)               |
| F058              | Profit & Loss Report          | Reports       | [I]    | /reports/profit-loss               | High       | [→](features/reports-profit-loss.md)       |
| F059              | Aging Report                  | Reports       | [I]    | /reports/aging                     | Medium     | [→](features/reports-aging.md)             |
| F060              | VAT Threshold Report          | Reports       | [I]    | /reports/vat-threshold             | Medium     | [→](features/reports-vat-threshold.md)     |
| F061              | Pausalni Obrt Report          | Reports       | [I]    | /reports/pausalni-obrt             | Medium     | [→](features/reports-pausalni-obrt.md)     |
| F062              | Data Export                   | Reports       | [I]    | /reports/export                    | High       | [→](features/reports-export.md)            |
| F063              | Accountant Export             | Reports       | [I]    | /api/reports/accountant-export     | Medium     | [→](features/reports-accountant-export.md) |
| **FISCALIZATION** |
| F064              | Fiscalize Invoice             | Fiscalization | [I]    | Actions + CRS                      | High       | [→](features/fiscal-fiscalize.md)          |
| F065              | Fiscal Certificate Management | Fiscalization | [I]    | /settings/fiscalisation            | High       | [→](features/fiscal-certificates.md)       |
| F066              | Business Premises Setup       | Fiscalization | [I]    | /settings/premises                 | Medium     | [→](features/fiscal-premises.md)           |
| F067              | Fiscal Status Check           | Fiscalization | [I]    | Actions                            | Medium     | [→](features/fiscal-status.md)             |
| **SETTINGS**      |
| F068              | Company Settings              | Settings      | [I]    | /settings                          | High       | [→](features/settings-company.md)          |
| F069              | Billing Settings              | Settings      | [I]    | /settings/billing                  | Medium     | [→](features/settings-billing.md)          |
| F070              | Email Settings                | Settings      | [I]    | /settings/email                    | Medium     | [→](features/settings-email.md)            |
| F071              | Audit Log                     | Settings      | [I]    | /settings/audit-log                | Medium     | [→](features/settings-audit-log.md)        |
| F072              | Company Switcher              | Settings      | [I]    | Layout Component                   | Low        | [→](features/settings-company-switcher.md) |
| **DOCUMENTS**     |
| F073              | Document Management           | Documents     | [I]    | /documents                         | High       | [→](features/documents-management.md)      |
| F074              | Document Upload               | Documents     | [I]    | /documents                         | Medium     | [→](features/documents-upload.md)          |
| F075              | Document Scanner              | Documents     | [I]    | /import                            | High       | [→](features/documents-scanner.md)         |
| F076              | Document Details              | Documents     | [I]    | /documents/:id                     | Medium     | [→](features/documents-details.md)         |
| **AI**            |
| F077              | AI Receipt Extraction         | AI            | [I]    | /api/ai/extract                    | High       | [→](features/ai-receipt-extraction.md)     |
| F078              | AI Category Suggestions       | AI            | [I]    | /api/ai/suggest-category           | Medium     | [→](features/ai-category-suggestions.md)   |
| F079              | AI Feedback System            | AI            | [I]    | /api/ai/feedback                   | Medium     | [→](features/ai-feedback.md)               |
| F080              | AI Usage Tracking             | AI            | [I]    | /api/ai/usage                      | Low        | [→](features/ai-usage.md)                  |
| F081              | AI Assistant                  | AI            | [I]    | /asistent                          | High       | [→](features/ai-assistant.md)              |
| **INTEGRATIONS**  |
| F082              | Email Integration             | Integrations  | [I]    | /api/email/connect                 | High       | [→](features/integrations-email.md)        |
| F083              | Email Import Rules            | Integrations  | [I]    | /api/email/rules                   | Medium     | [→](features/integrations-email-rules.md)  |
| F084              | Bank Sync Integration         | Integrations  | [I]    | /api/bank/connect                  | High       | [→](features/integrations-bank-sync.md)    |
| **SUPPORT**       |
| F085              | Create Support Ticket         | Support       | [I]    | /support                           | Medium     | [→](features/support-create.md)            |
| F086              | View Support Tickets          | Support       | [I]    | /support                           | Medium     | [→](features/support-view.md)              |
| F087              | Support Ticket Details        | Support       | [I]    | /support/:id                       | Medium     | [→](features/support-details.md)           |
| F088              | Support Ticket Messaging      | Support       | [I]    | /api/support/tickets/:id/messages  | Medium     | [→](features/support-messaging.md)         |
| **ADMIN**         |
| F089              | Admin Dashboard               | Admin         | [I]    | /admin                             | High       | [→](features/admin-dashboard.md)           |
| F090              | Company Management            | Admin         | [I]    | /admin/:companyId                  | Medium     | [→](features/admin-company.md)             |
| F091              | Support Dashboard             | Admin         | [I]    | /api/admin/support/dashboard       | Medium     | [→](features/admin-support.md)             |
| **MARKETING**     |
| F092              | Landing Page                  | Marketing     | [I]    | /                                  | Low        | [→](features/marketing-landing.md)         |
| F093              | Features Page                 | Marketing     | [I]    | /features                          | Low        | [→](features/marketing-features.md)        |
| F094              | Pricing Page                  | Marketing     | [I]    | /pricing                           | Low        | [→](features/marketing-pricing.md)         |
| F095              | Contact Form                  | Marketing     | [I]    | /contact                           | Low        | [→](features/marketing-contact.md)         |
| **ACCOUNTANT**    |
| F096              | Accountant Dashboard          | Accountant    | [I]    | /accountant                        | Medium     | [→](features/accountant-dashboard.md)      |
| **LEGAL**         |
| F097              | Privacy Policy Page           | Legal         | [I]    | /privacy                           | Low        | [→](features/legal-privacy.md)             |
| F098              | Terms of Service Page         | Legal         | [I]    | /terms                             | Low        | [→](features/legal-terms.md)               |
| F099              | Cookie Policy Page            | Legal         | [I]    | /cookies                           | Low        | [→](features/legal-cookies.md)             |
| F100              | DPA Page                      | Legal         | [I]    | /dpa                               | Low        | [→](features/legal-dpa.md)                 |
| F101              | Security Page                 | Legal         | [I]    | /security                          | Low        | [→](features/legal-security.md)            |
| F102              | AI Data Policy Page           | Legal         | [I]    | /ai-data-policy                    | Low        | [→](features/legal-ai-data.md)             |
| **SYSTEM**        |
| F103              | About Page                    | System        | [I]    | /about                             | Low        | [→](features/system-about.md)              |
| F104              | System Status Page            | System        | [I]    | /status                            | Low        | [→](features/system-status.md)             |
| F105              | Password Reset Completion     | System        | [I]    | /reset-password                    | Medium     | [→](features/system-password-reset.md)     |
| **LANDING**       |
| F106              | Accountants Landing Page      | Landing       | [I]    | /for/accountants                   | Low        | [→](features/landing-accountants.md)       |
| F107              | DOOO Landing Page             | Landing       | [I]    | /for/dooo                          | Low        | [→](features/landing-dooo.md)              |
| F108              | Pausalni Obrt Landing Page    | Landing       | [I]    | /for/pausalni-obrt                 | Low        | [→](features/landing-pausalni-obrt.md)     |

## Category Summary

| Category      | Count | Description                               |
| ------------- | ----- | ----------------------------------------- |
| Auth          | 6     | Authentication and authorization features |
| Dashboard     | 8     | Main dashboard and overview features      |
| Invoicing     | 8     | Standard invoice management               |
| E-Invoicing   | 6     | Electronic invoicing (UBL/PEPPOL)         |
| Expenses      | 8     | Expense tracking and management           |
| Banking       | 9     | Bank account and transaction management   |
| Contacts      | 6     | Customer and vendor management            |
| Products      | 4     | Product/service catalog                   |
| Reports       | 8     | Business reporting and analytics          |
| Fiscalization | 4     | Croatian fiscal system integration        |
| Settings      | 5     | Company and user settings                 |
| Documents     | 4     | Document management and scanning          |
| AI            | 5     | AI-powered features                       |
| Integrations  | 3     | Third-party integrations                  |
| Support       | 4     | Customer support system                   |
| Admin         | 3     | Admin tools                               |
| Marketing     | 4     | Marketing pages                           |
| Accountant    | 1     | Accountant-specific features              |
| Legal         | 6     | Legal and policy pages                    |
| System        | 3     | System and informational pages            |
| Landing       | 3     | Targeted landing pages                    |

## Complexity Distribution

- **Low:** 24 features (22.2%)
- **Medium:** 57 features (52.8%)
- **High:** 27 features (25.0%)

## Completion Status

**Documentation Complete:** 2025-12-15

All 108 features have been documented with:

- Evidence-based file:line references (5-10+ per feature)
- Core flow descriptions
- Key module mappings
- Data model specifications
- Security feature coverage
- Verification checklists

### Documentation Batches Completed

| Batch | Features  | Category Focus                          |
| ----- | --------- | --------------------------------------- |
| 1-3   | F001-F022 | Auth, Dashboard, Invoicing              |
| 4     | F023-F028 | E-Invoicing                             |
| 5     | F029-F036 | Expenses                                |
| 6     | F037-F045 | Banking                                 |
| 7     | F046-F055 | Contacts, Products                      |
| 8     | F056-F063 | Reports                                 |
| 9     | F064-F072 | Fiscalization, Settings                 |
| 10a   | F073-F081 | Documents, AI                           |
| 10b   | F082-F095 | Integrations, Support, Admin, Marketing |
| 10c   | F096-F108 | Accountant, Legal, System, Landing      |

## Status Distribution

| Status            | Count | Percentage | Features                     |
| ----------------- | ----- | ---------- | ---------------------------- |
| `[I]` Implemented | 102   | 94.4%      | All except below             |
| `[P]` Partial     | 5     | 4.6%       | F016, F020, F030, F034, F045 |
| `[S]` Scaffold    | 1     | 0.9%       | F036                         |
| `[D]` Designed    | 0     | 0.0%       | —                            |

### Partial Features Explanation

| Feature                | Original Entry Point | Current State                     | Reason                           |
| ---------------------- | -------------------- | --------------------------------- | -------------------------------- |
| F016 View Invoices     | `/invoices`          | → `/documents?category=invoice`   | Unified Documents Hub refactor   |
| F020 Invoice Filtering | `/invoices`          | → `/documents` (via hub)          | Filtering moved to documents hub |
| F030 View Expenses     | `/expenses`          | → `/documents?category=expense`   | Unified Documents Hub refactor   |
| F034 Expense Filtering | `/expenses`          | → `/documents` (via hub)          | Filtering moved to documents hub |
| F045 Banking Documents | `/banking/documents` | → `/documents?category=bank-stmt` | Unified Documents Hub refactor   |

> **Note:** These [P] features are not broken—they redirect to the unified Documents Hub which provides better filtering and organization. Update docs to reflect new architecture.

### Scaffold Features Explanation

| Feature                 | Entry Point | Current State                                                                                | Work Required                                        |
| ----------------------- | ----------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| F036 Recurring Expenses | Model only  | `RecurringExpense` model exists in schema (lines 426-445). No UI, no actions, no API routes. | Full implementation: UI, CRUD actions, recurring job |

> **Note:** F036 is tracked in `docs/STATUS.md` under P1 debt items.

## Audit History

| Date       | Auditor         | Scope             | Findings                                               |
| ---------- | --------------- | ----------------- | ------------------------------------------------------ |
| 2025-12-28 | Claude Opus 4.5 | Full 108 features | 5 partial (hub redirects), 1 scaffold, 0 designed-only |

## Next Steps

1. **Cross-reference validation:** Verify all evidence links resolve correctly
2. **Quality review:** Assess documentation completeness and accuracy
3. **Feature testing:** Use documentation as test plan for manual QA
4. **Address P1 debt:** Implement F036 Recurring Expenses or demote to designed-only
