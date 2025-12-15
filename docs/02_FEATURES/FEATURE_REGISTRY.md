# Feature Registry

> Central tracker for all FiskAI features. Updated by documentation agents.

**Last Updated:** 2025-12-15
**Total Features:** 108
**Coverage:** 13% (14/108 documented)

## Registry

| ID                | Feature                       | Category      | Status | Entry Point                        | Complexity | Doc                                        |
| ----------------- | ----------------------------- | ------------- | ------ | ---------------------------------- | ---------- | ------------------------------------------ |
| **AUTH**          |
| F001              | User Registration             | Auth          | ✅     | /register                          | Medium     | [→](features/auth-login.md)                |
| F002              | User Login                    | Auth          | ✅     | /login                             | Medium     | [→](features/auth-registration.md)         |
| F003              | Password Reset                | Auth          | ✅     | /forgot-password                   | Medium     | [→](features/auth-2fa.md)                  |
| F004              | WebAuthn/Passkey Login        | Auth          | ✅     | /api/webauthn/login/\*             | High       | [→](features/auth-passkeys.md)             |
| F005              | Passkey Management            | Auth          | ✅     | /settings + /api/webauthn/passkeys | Medium     | [→](features/auth-session.md)              |
| F006              | Admin Login                   | Auth          | ✅     | /admin-login                       | Low        | [→](features/auth-password-reset.md)       |
| **DASHBOARD**     |
| F007              | Main Dashboard                | Dashboard     | ✅     | /dashboard                         | High       | [→](features/dashboard-main.md)            |
| F008              | Quick Stats Display           | Dashboard     | ✅     | /dashboard                         | Medium     | [→](features/dashboard-quick-stats.md)     |
| F009              | Revenue Trends                | Dashboard     | ✅     | /dashboard                         | Medium     | [→](features/dashboard-revenue-trends.md)  |
| F010              | Invoice Funnel                | Dashboard     | ✅     | /dashboard                         | Medium     | [→](features/dashboard-invoice-funnel.md)  |
| F011              | Recent Activity Feed          | Dashboard     | ✅     | /dashboard                         | Medium     | [→](features/dashboard-recent-activity.md) |
| F012              | Action Cards                  | Dashboard     | ✅     | /dashboard                         | Low        | [→](features/dashboard-action-cards.md)    |
| F013              | VAT Overview                  | Dashboard     | ✅     | /dashboard                         | Medium     | [→](features/dashboard-vat-overview.md)    |
| F014              | Onboarding Checklist          | Dashboard     | ✅     | /onboarding                        | Medium     | [→](features/dashboard-onboarding.md)      |
| **INVOICING**     |
| F015              | Create Invoice                | Invoicing     | ❌     | /invoices/new                      | High       | -                                          |
| F016              | View Invoices                 | Invoicing     | ❌     | /invoices                          | High       | -                                          |
| F017              | Edit Invoice                  | Invoicing     | ❌     | /invoices/:id                      | High       | -                                          |
| F018              | Invoice PDF Generation        | Invoicing     | ❌     | /api/invoices/:id/pdf              | Medium     | -                                          |
| F019              | Invoice Email Delivery        | Invoicing     | ❌     | API + Actions                      | Medium     | -                                          |
| F020              | Invoice Filtering             | Invoicing     | ❌     | /invoices                          | Medium     | -                                          |
| F021              | Mark Invoice as Paid          | Invoicing     | ❌     | /invoices/:id                      | Low        | -                                          |
| F022              | Convert to Invoice            | Invoicing     | ❌     | Actions                            | Medium     | -                                          |
| **E-INVOICING**   |
| F023              | Create E-Invoice              | E-Invoicing   | ❌     | /e-invoices/new                    | High       | -                                          |
| F024              | View E-Invoices               | E-Invoicing   | ❌     | /e-invoices                        | Medium     | -                                          |
| F025              | E-Invoice Details             | E-Invoicing   | ❌     | /e-invoices/:id                    | Medium     | -                                          |
| F026              | Send E-Invoice                | E-Invoicing   | ❌     | Actions                            | Medium     | -                                          |
| F027              | Receive E-Invoice             | E-Invoicing   | ❌     | /api/e-invoices/receive            | Medium     | -                                          |
| F028              | E-Invoice Compliance Check    | E-Invoicing   | ❌     | /api/compliance/en16931            | Medium     | -                                          |
| **EXPENSES**      |
| F029              | Create Expense                | Expenses      | ❌     | /expenses/new                      | Medium     | -                                          |
| F030              | View Expenses                 | Expenses      | ❌     | /expenses                          | High       | -                                          |
| F031              | Edit Expense                  | Expenses      | ❌     | /expenses/:id                      | Medium     | -                                          |
| F032              | Receipt Scanner               | Expenses      | ❌     | /expenses/new                      | High       | -                                          |
| F033              | Expense Categories            | Expenses      | ❌     | /expenses/categories               | Medium     | -                                          |
| F034              | Expense Filtering             | Expenses      | ❌     | /expenses                          | Medium     | -                                          |
| F035              | Mark Expense as Paid          | Expenses      | ❌     | /expenses/:id                      | Low        | -                                          |
| F036              | Recurring Expenses            | Expenses      | ❌     | Database + Actions                 | Medium     | -                                          |
| **BANKING**       |
| F037              | View Bank Accounts            | Banking       | ❌     | /banking/accounts                  | Medium     | -                                          |
| F038              | Connect Bank Account          | Banking       | ❌     | /api/bank/connect                  | High       | -                                          |
| F039              | Disconnect Bank Account       | Banking       | ❌     | /api/bank/disconnect               | Low        | -                                          |
| F040              | View Bank Transactions        | Banking       | ❌     | /banking/transactions              | High       | -                                          |
| F041              | Import Bank Statement         | Banking       | ❌     | /banking/import                    | High       | -                                          |
| F042              | Bank Reconciliation           | Banking       | ❌     | /banking/reconciliation            | High       | -                                          |
| F043              | Auto-Match Transactions       | Banking       | ❌     | /api/banking/reconciliation/match  | High       | -                                          |
| F044              | Manual Transaction Matching   | Banking       | ❌     | Actions                            | Medium     | -                                          |
| F045              | Banking Documents             | Banking       | ❌     | /banking/documents                 | Medium     | -                                          |
| **CONTACTS**      |
| F046              | Create Contact                | Contacts      | ❌     | /contacts/new                      | Medium     | -                                          |
| F047              | View Contacts                 | Contacts      | ❌     | /contacts                          | Medium     | -                                          |
| F048              | Edit Contact                  | Contacts      | ❌     | /contacts/:id/edit                 | Medium     | -                                          |
| F049              | Contact Details               | Contacts      | ❌     | /contacts/:id                      | Medium     | -                                          |
| F050              | Contact Filtering             | Contacts      | ❌     | /contacts                          | Low        | -                                          |
| F051              | OIB Lookup                    | Contacts      | ❌     | /api/oib/lookup                    | Low        | -                                          |
| **PRODUCTS**      |
| F052              | Create Product                | Products      | ❌     | /products/new                      | Medium     | -                                          |
| F053              | View Products                 | Products      | ❌     | /products                          | Medium     | -                                          |
| F054              | Edit Product                  | Products      | ❌     | /products/:id/edit                 | Medium     | -                                          |
| F055              | Product CSV Import            | Products      | ❌     | /api/products/import               | Medium     | -                                          |
| **REPORTS**       |
| F056              | KPR Report                    | Reports       | ❌     | /reports/kpr                       | High       | -                                          |
| F057              | VAT Report                    | Reports       | ❌     | /reports/vat                       | High       | -                                          |
| F058              | Profit & Loss Report          | Reports       | ❌     | /reports/profit-loss               | High       | -                                          |
| F059              | Aging Report                  | Reports       | ❌     | /reports/aging                     | Medium     | -                                          |
| F060              | VAT Threshold Report          | Reports       | ❌     | /reports/vat-threshold             | Medium     | -                                          |
| F061              | Pausalni Obrt Report          | Reports       | ❌     | /reports/pausalni-obrt             | Medium     | -                                          |
| F062              | Data Export                   | Reports       | ❌     | /reports/export                    | High       | -                                          |
| F063              | Accountant Export             | Reports       | ❌     | /api/reports/accountant-export     | Medium     | -                                          |
| **FISCALIZATION** |
| F064              | Fiscalize Invoice             | Fiscalization | ❌     | Actions + CRS                      | High       | -                                          |
| F065              | Fiscal Certificate Management | Fiscalization | ❌     | /settings/fiscalisation            | High       | -                                          |
| F066              | Business Premises Setup       | Fiscalization | ❌     | /settings/premises                 | Medium     | -                                          |
| F067              | Fiscal Status Check           | Fiscalization | ❌     | Actions                            | Medium     | -                                          |
| **SETTINGS**      |
| F068              | Company Settings              | Settings      | ❌     | /settings                          | High       | -                                          |
| F069              | Billing Settings              | Settings      | ❌     | /settings/billing                  | Medium     | -                                          |
| F070              | Email Settings                | Settings      | ❌     | /settings/email                    | Medium     | -                                          |
| F071              | Audit Log                     | Settings      | ❌     | /settings/audit-log                | Medium     | -                                          |
| F072              | Company Switcher              | Settings      | ❌     | Layout Component                   | Low        | -                                          |
| **DOCUMENTS**     |
| F073              | Document Management           | Documents     | ❌     | /documents                         | High       | -                                          |
| F074              | Document Upload               | Documents     | ❌     | /documents                         | Medium     | -                                          |
| F075              | Document Scanner              | Documents     | ❌     | /import                            | High       | -                                          |
| F076              | Document Details              | Documents     | ❌     | /documents/:id                     | Medium     | -                                          |
| **AI**            |
| F077              | AI Receipt Extraction         | AI            | ❌     | /api/ai/extract                    | High       | -                                          |
| F078              | AI Category Suggestions       | AI            | ❌     | /api/ai/suggest-category           | Medium     | -                                          |
| F079              | AI Feedback System            | AI            | ❌     | /api/ai/feedback                   | Medium     | -                                          |
| F080              | AI Usage Tracking             | AI            | ❌     | /api/ai/usage                      | Low        | -                                          |
| F081              | AI Assistant                  | AI            | ❌     | /assistant                         | High       | -                                          |
| **INTEGRATIONS**  |
| F082              | Email Integration             | Integrations  | ❌     | /api/email/connect                 | High       | -                                          |
| F083              | Email Import Rules            | Integrations  | ❌     | /api/email/rules                   | Medium     | -                                          |
| F084              | Bank Sync Integration         | Integrations  | ❌     | /api/bank/connect                  | High       | -                                          |
| **SUPPORT**       |
| F085              | Create Support Ticket         | Support       | ❌     | /support                           | Medium     | -                                          |
| F086              | View Support Tickets          | Support       | ❌     | /support                           | Medium     | -                                          |
| F087              | Support Ticket Details        | Support       | ❌     | /support/:id                       | Medium     | -                                          |
| F088              | Support Ticket Messaging      | Support       | ❌     | /api/support/tickets/:id/messages  | Medium     | -                                          |
| **ADMIN**         |
| F089              | Admin Dashboard               | Admin         | ❌     | /admin                             | High       | -                                          |
| F090              | Company Management            | Admin         | ❌     | /admin/:companyId                  | Medium     | -                                          |
| F091              | Support Dashboard             | Admin         | ❌     | /api/admin/support/dashboard       | Medium     | -                                          |
| **MARKETING**     |
| F092              | Landing Page                  | Marketing     | ❌     | /                                  | Low        | -                                          |
| F093              | Features Page                 | Marketing     | ❌     | /features                          | Low        | -                                          |
| F094              | Pricing Page                  | Marketing     | ❌     | /pricing                           | Low        | -                                          |
| F095              | Contact Form                  | Marketing     | ❌     | /contact                           | Low        | -                                          |
| **ACCOUNTANT**    |
| F096              | Accountant Dashboard          | Accountant    | ❌     | /accountant                        | Medium     | -                                          |
| **LEGAL**         |
| F097              | Privacy Policy Page           | Legal         | ❌     | /privacy                           | Low        | -                                          |
| F098              | Terms of Service Page         | Legal         | ❌     | /terms                             | Low        | -                                          |
| F099              | Cookie Policy Page            | Legal         | ❌     | /cookies                           | Low        | -                                          |
| F100              | DPA Page                      | Legal         | ❌     | /dpa                               | Low        | -                                          |
| F101              | Security Page                 | Legal         | ❌     | /security                          | Low        | -                                          |
| F102              | AI Data Policy Page           | Legal         | ❌     | /ai-data-policy                    | Low        | -                                          |
| **SYSTEM**        |
| F103              | About Page                    | System        | ❌     | /about                             | Low        | -                                          |
| F104              | System Status Page            | System        | ❌     | /status                            | Low        | -                                          |
| F105              | Password Reset Completion     | System        | ❌     | /reset-password                    | Medium     | -                                          |
| **LANDING**       |
| F106              | Accountants Landing Page      | Landing       | ❌     | /for/accountants                   | Low        | -                                          |
| F107              | DOOO Landing Page             | Landing       | ❌     | /for/dooo                          | Low        | -                                          |
| F108              | Pausalni Obrt Landing Page    | Landing       | ❌     | /for/pausalni-obrt                 | Low        | -                                          |

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

## Next Steps

1. **Phase C:** Document Scribe will create detailed documentation for each feature
2. **Phase D:** Cross-reference checker will validate all links
3. **Phase E:** Quality reviewer will assess documentation quality
