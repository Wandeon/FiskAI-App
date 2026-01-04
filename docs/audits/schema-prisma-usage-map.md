# Prisma Schema Usage Map

> Generated: 2026-01-02
> Branch: `chore/schema-partition-rtl`
> Source: `/prisma/schema.prisma`

## Baseline Metrics

| Metric       | Count |
| ------------ | ----- |
| Schema lines | 5,822 |
| Models       | 200   |
| Enums        | 139   |

## Usage Scan Methodology

```bash
rg -c "<ModelName>" src scripts | awk -F: '{sum+=$2} END {print sum}'
```

Scanned directories: `src/`, `scripts/`, `prisma/`

---

## Usage Tiers

### Tier 1: Core Transactional (>100 hits)

| Model           | Hits | Primary Locations                        |
| --------------- | ---- | ---------------------------------------- |
| Company         | 1131 | e2e tests, admin flows, tenant isolation |
| User            | 982  | auth, admin, e2e tests                   |
| Transaction     | 766  | banking, CSV parser, reconciliation      |
| Expense         | 676  | analytics, fixed-assets, tests           |
| Account         | 634  | banking, journal entries                 |
| Evidence        | 581  | RTL pipeline, OCR, audit scripts         |
| Document        | 467  | docs checker, typography                 |
| Concept         | 462  | RTL taxonomy, conflicts, validation      |
| Contact         | 284  | invoicing, tenant isolation              |
| Claim           | 267  | article-agent, claim-extractor           |
| Permission      | 253  | capabilities resolver, RBAC              |
| EInvoice        | 217  | compliance, e-invoice providers          |
| Product         | 209  | secrets drift, invoicing                 |
| Address         | 207  | reconciliation, contacts import          |
| Experiment      | 193  | experiments manager, analysis            |
| SourcePointer   | 182  | RTL pipeline, JSON fixes                 |
| SupportTicket   | 173  | notifications, email templates           |
| FiscalRequest   | 145  | fiscal repository, infrastructure        |
| FeatureFlag     | 126  | feature-flags service                    |
| Person          | 122  | RBAC, assistant CLI                      |
| BankTransaction | 111  | banking, import statement                |

### Tier 2: Supporting (20-100 hits)

| Model            | Hits | Primary Locations                   |
| ---------------- | ---- | ----------------------------------- |
| Statement        | 109  | banking import, POSD calculator     |
| Payout           | 107  | travel, payouts                     |
| RegulatoryRule   | 87   | RTL, VAT calculator                 |
| AtomicClaim      | 82   | RTL validators, knowledge shapes    |
| AccountingPeriod | 81   | period-locking                      |
| Organization     | 75   | prisma extensions, audit middleware |
| BankAccount      | 73   | banking import                      |
| Artifact         | 70   | OCR, RTL e2e runner                 |
| AuditLog         | 59   | reconcile audit, pipeline test      |
| Employee         | 50   | e2e tests, integration              |
| ArticleJob       | 48   | article-agent queue                 |
| Attachment       | 47   | webauthn, staff queries             |
| JournalEntry     | 46   | period-locking, capabilities        |
| StaffAssignment  | 45   | auth utils, domain                  |
| AIUsage          | 44   | AI extract, usage tracking          |
| EInvoiceLine     | 42   | enterprise hardening, audit         |
| RecurringExpense | 36   | recurring expense pages             |
| JoppdSubmission  | 36   | prisma extensions, JOPPD service    |
| RegulatorySource | 35   | RTL quickstart, watchdog            |
| ImportJob        | 35   | email sync, banking import          |
| Warehouse        | 34   | prisma extensions, backup           |
| StockMovement    | 34   | prisma extensions, backup           |
| OutboxEvent      | 33   | outbox service                      |
| ComparisonMatrix | 32   | RTL comparison matrix               |
| AgentRun         | 32   | RTL pipeline test, cleanup          |
| Session          | 31   | next-auth, experiments              |
| DiscoveredItem   | 30   | RTL site crawler, backfill          |
| ReportingStatus  | 29   | prisma extensions, reporting        |
| CoverageReport   | 29   | RTL coverage metrics                |
| OperationalEvent | 27   | GL event consumer                   |
| AssetCandidate   | 27   | fixed-assets, procurement           |
| CashDayClose     | 26   | cash service                        |
| CashIn           | 24   | cash service                        |
| ExpenseCategory  | 23   | expense reconciliation              |
| PayoutLine       | 22   | payroll JOPPD                       |
| RegulatoryAsset  | 21   | RTL content classifier              |

### Tier 3: Peripheral (5-19 hits)

| Model                   | Hits | Primary Locations           |
| ----------------------- | ---- | --------------------------- |
| ReferenceTable          | 19   | RTL reference extractor     |
| JournalLine             | 19   | period-locking              |
| FiscalResponse          | 19   | e-invoice, fiscal types     |
| ExpenseLine             | 19   | VAT input                   |
| TransitionalProvision   | 18   | RTL transitional extractor  |
| StockItem               | 17   | backup export/restore       |
| RegulatoryProcess       | 17   | RTL process extractor       |
| Dependent               | 17   | modules access              |
| CashOut                 | 17   | cash service                |
| ReviewQueueItem         | 16   | review queue service        |
| news_posts              | 16   | article-agent publish       |
| ExperimentAssignment    | 16   | experiments assignment      |
| CompanyUser             | 15   | admin tenants               |
| RuleSnapshot            | 14   | RTL release hash            |
| RevenueRegisterEntry    | 14   | invoicing events            |
| Payslip                 | 14   | prisma extensions           |
| ExperimentEvent         | 14   | experiments tracking        |
| CalculationSnapshot     | 14   | prisma extensions           |
| RuleVersion             | 13   | fiscal rules service        |
| RegulatoryConflict      | 13   | RTL arbiter                 |
| JoppdSubmissionLine     | 12   | prisma extensions           |
| GraphEdge               | 12   | RTL knowledge graph         |
| FeatureFlagOverride     | 12   | feature-flags service       |
| EmailConnection         | 12   | email sync                  |
| ConceptEmbedding        | 12   | semantic search             |
| FactSheet               | 11   | article-agent               |
| DepreciationSchedule    | 11   | assets depreciation         |
| DepreciationEntry       | 11   | period-locking              |
| CashLimitSetting        | 11   | cash service                |
| Allowance               | 11   | tax calculator              |
| RuleTable               | 10   | fiscal rules                |
| InvoiceEvent            | 10   | invoicing events            |
| ExperimentVariant       | 10   | experiments                 |
| CertificateNotification | 10   | cron certificate check      |
| StaffReview             | 9    | staff batch review          |
| PensionPillar           | 9    | POSD calculator             |
| PaymentDevice           | 9    | premises card               |
| MatchRecord             | 9    | period-locking              |
| FixedAsset              | 9    | assets depreciation         |
| BetaFeedback            | 9    | beta actions                |
| WatchdogHealth          | 8    | RTL health monitors         |
| WatchdogAlert           | 8    | RTL email alerts            |
| VerificationCode        | 8    | auth flow                   |
| UraInput                | 8    | VAT reports                 |
| TravelPdf               | 8    | travel pdf storage          |
| news_items              | 8    | news fetch-classify         |
| EmployeeRole            | 8    | person role service         |
| EmailImportRule         | 8    | email sync                  |
| BankPaymentExport       | 8    | payroll payout service      |
| UserSegment             | 7    | segmentation service        |
| TruthHealthSnapshot     | 7    | RTL truth health            |
| SourceChunk             | 7    | article-agent synthesis     |
| PostingRule             | 7    | GL event consumer           |
| PayslipArtifact         | 7    | prisma extensions           |
| FiscalCertificate       | 7    | fiscal request snapshot     |
| checklist_interactions  | 7    | guidance checklist          |
| BusinessPremises        | 7    | premises card               |
| BankPaymentLine         | 7    | prisma extensions           |
| BankConnection          | 7    | bank sync cron              |
| TaxIdentity             | 6    | organization service        |
| ReviewDecision          | 6    | review queue                |
| PersonSnapshot          | 6    | person service              |
| InvoiceSequence         | 6    | invoice repository          |
| ConceptNode             | 6    | RTL comparison matrix       |
| ClaimException          | 6    | RTL taxonomy                |
| AccountMapping          | 6    | external accounting exports |
| ReferenceEntry          | 5    | RTL reference tables        |
| PersonEmployeeRole      | 5    | person role service         |
| PersonDirectorRole      | 5    | person role service         |
| PersonContactRole       | 5    | person role service         |
| MileageLog              | 5    | travel payouts              |
| EmailAttachment         | 5    | email sync                  |
| DisposalEvent           | 5    | capabilities registry       |
| DiscoveryEndpoint       | 5    | RTL seed endpoints          |
| ClientInvitation        | 5    | staff invitations           |
| ArticleDraft            | 5    | article-agent publish       |
| AIFeedback              | 5    | receipt scanner             |

### Tier 4: Minimal (1-4 hits)

| Model                      | Hits | Primary Locations       |
| -------------------------- | ---- | ----------------------- |
| WebhookEvent               | 4    | webhook processor       |
| SupportTicketMessage       | 4    | support ticket actions  |
| StatementPage              | 4    | banking document detail |
| RuleRelease                | 4    | RTL overnight run       |
| PersonEvent                | 4    | person role service     |
| payment_obligation         | 4    | pausalni schema         |
| PasswordResetToken         | 4    | auth actions            |
| FeatureFlagAuditLog        | 4    | feature-flags           |
| EmploymentContract         | 4    | employee validation     |
| ValuationSnapshot          | 3    | prisma extensions       |
| ProcessStep                | 3    | RTL process schema      |
| news_post_sources          | 3    | news schema             |
| news_categories            | 3    | news schema             |
| ExpenseCorrection          | 3    | capabilities registry   |
| eu_transaction             | 3    | pausalni schema         |
| EntitlementHistory         | 3    | entitlement service     |
| DraftParagraph             | 3    | article-agent review    |
| compliance_deadlines       | 3    | deadlines schema        |
| AdminAlert                 | 3    | admin alerts            |
| user_guidance_preferences  | 2    | guidance schema         |
| SupplierBill               | 2    | prisma extensions       |
| StatementImport            | 2    | prisma extensions       |
| SavedReport                | 2    | prisma extensions       |
| pausalni_profile           | 2    | pausalni schema         |
| news_tags                  | 2    | news schema             |
| news_sources               | 2    | news schema             |
| FixedAssetCandidate        | 2    | prisma extensions       |
| ExtractionRejected         | 2    | RTL health gates        |
| EvidenceArtifact           | 2    | OCR audit               |
| eu_vendor                  | 2    | pausalni schema         |
| ChartOfAccounts            | 2    | prisma extensions       |
| TrialBalance               | 1    | prisma extensions       |
| notification_preference    | 1    | pausalni schema         |
| newsletter_subscriptions   | 1    | newsletter schema       |
| generated_form             | 1    | pausalni schema         |
| ExportProfile              | 1    | prisma extensions       |
| ExportJob                  | 1    | prisma extensions       |
| EmploymentTerminationEvent | 1    | prisma extensions       |
| EmploymentContractVersion  | 1    | prisma extensions       |
| ConflictResolutionAudit    | 1    | RTL arbiter             |

### Tier 5: UNUSED (0 hits) - Immediate Removal Candidates

| Model                        | Assessment                |
| ---------------------------- | ------------------------- |
| WebhookSubscription          | Dead code - no references |
| WebAuthnCredential           | Dead code - no references |
| WatchdogAudit                | Dead code - no references |
| VerificationToken            | Dead code - no references |
| TravelOrder                  | Dead code - no references |
| SystemRegistryStatusSnapshot | Dead code - no references |
| SystemRegistryStatusPointer  | Dead code - no references |
| SystemRegistryStatusEvent    | Dead code - no references |
| SystemRegistryRefreshLock    | Dead code - no references |
| SystemRegistryRefreshJob     | Dead code - no references |
| SupportTicketAttachment      | Dead code - no references |
| SoftFailLog                  | Dead code - no references |
| SegmentMembershipHistory     | Dead code - no references |
| SegmentFeatureTarget         | Dead code - no references |
| RuleCalculation              | Dead code - no references |
| RolePermission               | Dead code - no references |
| RegulatoryAuditLog           | Dead code - no references |
| ReasoningTrace               | Dead code - no references |
| PotentialDuplicate           | Dead code - no references |
| MonitoringAlert              | Dead code - no references |
| JoppdSubmissionEvent         | Dead code - no references |
| HumanReviewQueue             | Dead code - no references |
| ExperimentSegment            | Dead code - no references |
| EmailSuppression             | Dead code - no references |
| CronJobError                 | Dead code - no references |
| ClaimVerification            | Dead code - no references |

**Total unused models: 26**

---

## Summary Statistics

| Tier            | Count   | Percentage |
| --------------- | ------- | ---------- |
| Tier 1 (>100)   | 21      | 10.5%      |
| Tier 2 (20-100) | 35      | 17.5%      |
| Tier 3 (5-19)   | 64      | 32.0%      |
| Tier 4 (1-4)    | 54      | 27.0%      |
| Tier 5 (UNUSED) | 26      | 13.0%      |
| **Total**       | **200** | **100%**   |

## Key Findings

1. **26 models (13%) are completely unused** - immediate deletion candidates
2. **54 models (27%) have 1-4 references** - mostly in prisma-extensions.ts or schema definitions only
3. **Evidence/Concept/Claim/SourcePointer** are heavily used RTL models (581/462/267/182 hits)
4. **Experiment/FeatureFlag** are heavily used (193/126 hits) but should be external services
5. **SystemRegistry\* models (5)** are entirely unused dead code
6. **news\_\* models (6)** have minimal usage (3-16 hits each)
