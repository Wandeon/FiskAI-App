# Data Schema Tenant Scoping & Cascade Audit (INV-001, INV-012)

## Scope & Approach

- Reviewed Prisma schema definitions for tenant scoping (`companyId` fields) and declared delete behaviors.
- Checked relevant migrations to confirm tenant-level uniqueness constraints.
- Database instance was not available for direct constraint inspection; conclusions rely on schema and migration files.【F:prisma/schema.prisma†L1-L1100】【F:prisma/migrations/202502141200_add_tenant_constraints/migration.sql†L1-L5】

## Model Tenant Scoping

| Model                | `companyId` field? | Evidence                               | Notes                                                         |
| -------------------- | ------------------ | -------------------------------------- | ------------------------------------------------------------- |
| User                 | No                 | 【F:prisma/schema.prisma†L9-L23】      | Auth identity only.                                           |
| Account              | No                 | 【F:prisma/schema.prisma†L25-L41】     | NextAuth account linkage.                                     |
| Session              | No                 | 【F:prisma/schema.prisma†L43-L49】     | NextAuth session.                                             |
| VerificationToken    | No                 | 【F:prisma/schema.prisma†L51-L57】     | NextAuth token.                                               |
| PasswordResetToken   | No                 | 【F:prisma/schema.prisma†L59-L66】     | User-scoped only.                                             |
| Company              | N/A (root tenant)  | 【F:prisma/schema.prisma†L68-L130】    | Tenant anchor.                                                |
| CompanyUser          | Yes                | 【F:prisma/schema.prisma†L132-L146】   | Cascades to Company and User.                                 |
| Contact              | Yes                | 【F:prisma/schema.prisma†L148-L171】   | Cascades to Company.                                          |
| Product              | Yes                | 【F:prisma/schema.prisma†L173-L189】   | Cascades to Company.                                          |
| EInvoice             | Yes                | 【F:prisma/schema.prisma†L191-L259】   | Cascades to Company.                                          |
| EInvoiceLine         | No                 | 【F:prisma/schema.prisma†L261-L276】   | Child inherits company via `eInvoice` relation (cascade).     |
| AuditLog             | Yes                | 【F:prisma/schema.prisma†L278-L294】   | Relation to Company lacks explicit cascade.                   |
| BusinessPremises     | Yes                | 【F:prisma/schema.prisma†L296-L312】   | Cascades to Company.                                          |
| PaymentDevice        | Yes                | 【F:prisma/schema.prisma†L314-L333】   | Cascades to Company & BusinessPremises.                       |
| InvoiceSequence      | Yes                | 【F:prisma/schema.prisma†L335-L352】   | Cascades to Company & BusinessPremises.                       |
| Expense              | Yes                | 【F:prisma/schema.prisma†L354-L381】   | Cascades to Company.                                          |
| ExpenseCategory      | Yes (optional)     | 【F:prisma/schema.prisma†L383-L396】   | Optional Company relation with cascade.                       |
| RecurringExpense     | Yes                | 【F:prisma/schema.prisma†L398-L409】   | Cascades to Company.                                          |
| SavedReport          | Yes                | 【F:prisma/schema.prisma†L411-L423】   | Cascades to Company.                                          |
| BankAccount          | Yes                | 【F:prisma/schema.prisma†L425-L447】   | Cascades to Company.                                          |
| BankTransaction      | Yes                | 【F:prisma/schema.prisma†L449-L493】   | Cascades to BankAccount; Company FK present.                  |
| BankConnection       | Yes                | 【F:prisma/schema.prisma†L495-L519】   | Cascades to Company and BankAccount.                          |
| PotentialDuplicate   | Yes                | 【F:prisma/schema.prisma†L521-L542】   | Cascades to Company.                                          |
| EmailConnection      | Yes                | 【F:prisma/schema.prisma†L544-L570】   | Cascades to Company.                                          |
| EmailImportRule      | Yes                | 【F:prisma/schema.prisma†L572-L591】   | Cascades to Company & EmailConnection.                        |
| EmailAttachment      | Yes                | 【F:prisma/schema.prisma†L593-L624】   | Cascades to Company & EmailConnection.                        |
| BankImport           | Yes                | 【F:prisma/schema.prisma†L626-L639】   | Cascades to BankAccount; Company FK present.                  |
| ImportJob            | Yes                | 【F:prisma/schema.prisma†L641-L668】   | Cascades to Company; optional to BankAccount.                 |
| Statement            | Yes                | 【F:prisma/schema.prisma†L670-L699】   | Cascades to Company & BankAccount.                            |
| StatementPage        | Yes                | 【F:prisma/schema.prisma†L701-L716】   | Cascades to Company & Statement.                              |
| Transaction          | Yes                | 【F:prisma/schema.prisma†L718-L747】   | Cascades to Company & Statement; references Page.             |
| SupportTicket        | Yes                | 【F:prisma/schema.prisma†L749-L765】   | Cascades to Company.                                          |
| SupportTicketMessage | No                 | 【F:prisma/schema.prisma†L767-L775】   | Cascades to SupportTicket; inherits company indirectly.       |
| WebAuthnCredential   | No                 | 【F:prisma/schema.prisma†L777-L788】   | Auth credential only.                                         |
| FiscalCertificate    | Yes                | 【F:prisma/schema.prisma†L1007-L1031】 | Cascades to Company.                                          |
| FiscalRequest        | Yes                | 【F:prisma/schema.prisma†L1033-L1064】 | Cascades to Company; other relations default delete behavior. |
| AIFeedback           | Yes                | 【F:prisma/schema.prisma†L1066-L1084】 | Indexed by company.                                           |
| AIUsage              | Yes                | 【F:prisma/schema.prisma†L1086-L1100】 | Cascades to Company.                                          |

## Cascade Behavior Notes

- Most Company child relations specify `onDelete: Cascade`, ensuring tenant deletion clears dependent records (e.g., CompanyUser, Contact, Product, BankAccount).【F:prisma/schema.prisma†L132-L189】【F:prisma/schema.prisma†L425-L447】
- Several relations omit explicit cascade and therefore rely on default database behavior (typically `NO ACTION`), including:
  - AuditLog → Company (could block company deletion or leave orphaned logs).【F:prisma/schema.prisma†L278-L294】
  - EInvoice buyer/seller/contact links and conversion self-relations; FiscalRequest links to certificate/invoice; Expense vendor link; matched invoice/expense on BankTransaction; ImportJob links to Statement/EInvoice; Statement chain references; SupportTicket created/assigned users; these are optional references but lack cascade settings. Evidence present in model definitions above.
- Unique tenant constraints are reinforced in migrations for Contact OIB and EInvoice invoiceNumber to prevent cross-tenant collisions.【F:prisma/migrations/202502141200_add_tenant_constraints/migration.sql†L1-L5】

## Findings

| ID      | Finding                                                                                                                                                                                                                                      | Severity | Evidence                                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| INV-001 | Primary business models include `companyId` fields; exceptions are relational children (EInvoiceLine, SupportTicketMessage) and auth tables. Risk arises if these children are fetched by ID without joining parent tenant context.          | Medium   | See Model Tenant Scoping table rows for the listed models.【F:prisma/schema.prisma†L261-L276】【F:prisma/schema.prisma†L767-L775】 |
| INV-012 | Cascade coverage is strong for Company-owned aggregates, but some relations lack explicit cascade (e.g., AuditLog→Company, optional cross-entity references). This could block deletes or leave orphans if parent rows are removed manually. | Medium   | Cascade notes above and model definitions.【F:prisma/schema.prisma†L278-L294】【F:prisma/schema.prisma†L191-L259】                 |

## Acceptance Check

- Tenant scoping: All core business tables carry `companyId` except EInvoiceLine and SupportTicketMessage; both inherit tenancy via parent relations. No additional unscoped business tables identified.
- Migrations: Tenant uniqueness enforced for Contact (OIB) and EInvoice invoiceNumber per company, matching schema intent.【F:prisma/migrations/202502141200_add_tenant_constraints/migration.sql†L1-L5】
