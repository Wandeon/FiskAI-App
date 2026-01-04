# Prisma Schema Categorization

> Generated: 2026-01-02
> Branch: `chore/schema-partition-rtl`
> Source: `/prisma/schema.prisma`

## Category Definitions

| Category | Description                                | Destination                            |
| -------- | ------------------------------------------ | -------------------------------------- |
| **A**    | Core structural / load-bearing             | Keep in `prisma/schema.prisma`         |
| **B**    | Certification archive / compliance dossier | Isolate to `prisma/regulatory.prisma`  |
| **C**    | Assembly scaffolding / temporary tooling   | Eject to Redis/BullMQ/logs             |
| **D**    | Office furniture bolted to gearbox         | Delete or relocate to external service |

---

## Model Categorization

### Category A: Core Transactional (99 models) - KEEP

| Model                      | Hits | Justification                |
| -------------------------- | ---- | ---------------------------- |
| Company                    | 1131 | Tenant aggregate root        |
| User                       | 982  | Authentication/authorization |
| Transaction                | 766  | Bank transaction records     |
| Expense                    | 676  | Core accounting entity       |
| Account                    | 634  | Chart of accounts            |
| Document                   | 467  | Document storage             |
| Contact                    | 284  | CRM contacts                 |
| Permission                 | 253  | RBAC permissions             |
| EInvoice                   | 217  | E-invoice records            |
| Product                    | 209  | Product catalog              |
| Address                    | 207  | Address data                 |
| SupportTicket              | 173  | Customer support             |
| FiscalRequest              | 145  | Fiscalization requests       |
| Person                     | 122  | HR/personnel records         |
| BankTransaction            | 111  | Bank transactions            |
| Statement                  | 109  | Bank statements              |
| Payout                     | 107  | Payroll payouts              |
| AccountingPeriod           | 81   | Period locking               |
| Organization               | 75   | Company organization         |
| BankAccount                | 73   | Bank accounts                |
| AuditLog                   | 59   | Audit trail                  |
| Employee                   | 50   | Employee records             |
| Attachment                 | 47   | File attachments             |
| JournalEntry               | 46   | GL journal entries           |
| StaffAssignment            | 45   | Staff-client assignments     |
| EInvoiceLine               | 42   | E-invoice line items         |
| RecurringExpense           | 36   | Recurring expenses           |
| JoppdSubmission            | 36   | JOPPD submissions            |
| ImportJob                  | 35   | Import jobs                  |
| Warehouse                  | 34   | Inventory warehouses         |
| StockMovement              | 34   | Inventory movements          |
| OutboxEvent                | 33   | Event outbox                 |
| Session                    | 31   | User sessions                |
| ReportingStatus            | 29   | Report status                |
| OperationalEvent           | 27   | GL operational events        |
| AssetCandidate             | 27   | Fixed asset candidates       |
| CashDayClose               | 26   | Cash register close          |
| CashIn                     | 24   | Cash inflows                 |
| ExpenseCategory            | 23   | Expense categories           |
| PayoutLine                 | 22   | Payout line items            |
| ReferenceTable             | 19   | Reference data tables        |
| JournalLine                | 19   | Journal line items           |
| FiscalResponse             | 19   | Fiscal responses             |
| ExpenseLine                | 19   | Expense line items           |
| StockItem                  | 17   | Inventory items              |
| Dependent                  | 17   | Employee dependents          |
| CashOut                    | 17   | Cash outflows                |
| ReviewQueueItem            | 16   | Review queue                 |
| CompanyUser                | 15   | Company-user junction        |
| RevenueRegisterEntry       | 14   | Revenue register             |
| Payslip                    | 14   | Payslips                     |
| CalculationSnapshot        | 14   | Tax calculations             |
| RuleVersion                | 13   | Fiscal rule versions         |
| JoppdSubmissionLine        | 12   | JOPPD line items             |
| EmailConnection            | 12   | Email connections            |
| DepreciationSchedule       | 11   | Asset depreciation schedules |
| DepreciationEntry          | 11   | Depreciation entries         |
| CashLimitSetting           | 11   | Cash limits                  |
| Allowance                  | 11   | Employee allowances          |
| RuleTable                  | 10   | Fiscal rule tables           |
| InvoiceEvent               | 10   | Invoice events               |
| CertificateNotification    | 10   | Certificate notifications    |
| StaffReview                | 9    | Staff reviews                |
| PensionPillar              | 9    | Pension contributions        |
| PaymentDevice              | 9    | Payment devices              |
| MatchRecord                | 9    | Reconciliation matches       |
| FixedAsset                 | 9    | Fixed assets                 |
| VerificationCode           | 8    | Auth verification codes      |
| UraInput                   | 8    | VAT input records            |
| TravelPdf                  | 8    | Travel PDFs                  |
| EmployeeRole               | 8    | Employee roles               |
| EmailImportRule            | 8    | Email import rules           |
| BankPaymentExport          | 8    | Bank payment exports         |
| PostingRule                | 7    | GL posting rules             |
| PayslipArtifact            | 7    | Payslip artifacts            |
| FiscalCertificate          | 7    | Fiscal certificates          |
| BusinessPremises           | 7    | Business premises            |
| BankPaymentLine            | 7    | Payment line items           |
| BankConnection             | 7    | Bank connections             |
| TaxIdentity                | 6    | Tax identities               |
| ReviewDecision             | 6    | Review decisions             |
| PersonSnapshot             | 6    | Person snapshots             |
| InvoiceSequence            | 6    | Invoice numbering            |
| AccountMapping             | 6    | Account mappings             |
| PersonEmployeeRole         | 5    | Person-employee junction     |
| PersonDirectorRole         | 5    | Person-director junction     |
| PersonContactRole          | 5    | Person-contact junction      |
| MileageLog                 | 5    | Mileage logs                 |
| EmailAttachment            | 5    | Email attachments            |
| DisposalEvent              | 5    | Asset disposals              |
| ClientInvitation           | 5    | Client invitations           |
| SupportTicketMessage       | 4    | Support messages             |
| StatementPage              | 4    | Statement pages              |
| PersonEvent                | 4    | Person events                |
| payment_obligation         | 4    | Payment obligations          |
| PasswordResetToken         | 4    | Password reset               |
| EmploymentContract         | 4    | Employment contracts         |
| ValuationSnapshot          | 3    | Asset valuations             |
| ExpenseCorrection          | 3    | Expense corrections          |
| eu_transaction             | 3    | EU transactions              |
| EntitlementHistory         | 3    | Module entitlements          |
| compliance_deadlines       | 3    | Compliance deadlines         |
| AdminAlert                 | 3    | Admin alerts                 |
| user_guidance_preferences  | 2    | User guidance prefs          |
| SupplierBill               | 2    | Supplier bills               |
| StatementImport            | 2    | Statement imports            |
| SavedReport                | 2    | Saved reports                |
| pausalni_profile           | 2    | Pausalni profiles            |
| eu_vendor                  | 2    | EU vendors                   |
| ChartOfAccounts            | 2    | Chart of accounts            |
| TrialBalance               | 1    | Trial balance                |
| notification_preference    | 1    | Notification prefs           |
| newsletter_subscriptions   | 1    | Newsletter subs              |
| generated_form             | 1    | Generated forms              |
| ExportProfile              | 1    | Export profiles              |
| ExportJob                  | 1    | Export jobs                  |
| EmploymentTerminationEvent | 1    | Termination events           |
| EmploymentContractVersion  | 1    | Contract versions            |

---

### Category B: Regulatory Truth Layer (27 models) - ISOLATE

| Model                   | Hits | Justification                        |
| ----------------------- | ---- | ------------------------------------ |
| Evidence                | 581  | Immutable source evidence - RTL core |
| Concept                 | 462  | Regulatory concepts/taxonomy         |
| Claim                   | 267  | Extracted claims from sources        |
| SourcePointer           | 182  | Evidence-to-claim links              |
| RegulatoryRule          | 87   | Compiled regulatory rules            |
| AtomicClaim             | 82   | Atomic facts from extraction         |
| Artifact                | 70   | PDF/document artifacts               |
| CoverageReport          | 29   | Coverage analysis reports            |
| ComparisonMatrix        | 32   | Regulatory comparisons               |
| RegulatoryAsset         | 21   | Regulatory assets                    |
| TransitionalProvision   | 18   | Transitional provisions              |
| RegulatoryProcess       | 17   | Regulatory processes                 |
| RuleSnapshot            | 14   | Rule version snapshots               |
| RegulatoryConflict      | 13   | Conflict detection                   |
| GraphEdge               | 12   | Knowledge graph edges                |
| ConceptEmbedding        | 12   | Semantic embeddings                  |
| FactSheet               | 11   | Fact sheets                          |
| WatchdogHealth          | 8    | Health monitoring                    |
| WatchdogAlert           | 8    | Alert records                        |
| TruthHealthSnapshot     | 7    | Health snapshots                     |
| SourceChunk             | 7    | Source text chunks                   |
| ConceptNode             | 6    | Knowledge graph nodes                |
| ClaimException          | 6    | Claim exceptions                     |
| ReferenceEntry          | 5    | Reference entries                    |
| DiscoveryEndpoint       | 5    | Discovery endpoints                  |
| RuleRelease             | 4    | Rule releases                        |
| ProcessStep             | 3    | Process steps                        |
| RegulatorySource        | 35   | Regulatory sources                   |
| DiscoveredItem          | 30   | Discovered items                     |
| EvidenceArtifact        | 2    | Evidence artifacts                   |
| ConflictResolutionAudit | 1    | Conflict audit trail                 |

---

### Category C: Pipeline/Process State (31 models) - EJECT

| Model                        | Hits | Justification                         |
| ---------------------------- | ---- | ------------------------------------- |
| AgentRun                     | 32   | Pipeline run state - use BullMQ       |
| ArticleJob                   | 48   | Article processing jobs - use BullMQ  |
| AIUsage                      | 44   | AI usage tracking - use logs/metrics  |
| ExtractionRejected           | 2    | Failed extractions - use DLQ          |
| WebhookEvent                 | 4    | Webhook events - use logs             |
| WebhookSubscription          | 0    | Unused                                |
| SoftFailLog                  | 0    | Unused - use structured logs          |
| ReasoningTrace               | 0    | Unused - use logs                     |
| MonitoringAlert              | 0    | Unused - use external alerting        |
| HumanReviewQueue             | 0    | Unused - duplicate of ReviewQueueItem |
| CronJobError                 | 0    | Unused - use logs                     |
| SystemRegistryRefreshJob     | 0    | Unused                                |
| SystemRegistryRefreshLock    | 0    | Unused - use Redis locks              |
| SystemRegistryStatusEvent    | 0    | Unused                                |
| SystemRegistryStatusPointer  | 0    | Unused                                |
| SystemRegistryStatusSnapshot | 0    | Unused                                |
| WatchdogAudit                | 0    | Unused                                |
| PotentialDuplicate           | 0    | Unused                                |
| RuleCalculation              | 0    | Unused                                |
| RegulatoryAuditLog           | 0    | Unused - use AuditLog                 |
| ClaimVerification            | 0    | Unused                                |
| JoppdSubmissionEvent         | 0    | Unused - use logs                     |
| DraftParagraph               | 3    | Article drafts - ephemeral state      |
| ArticleDraft                 | 5    | Article drafts - ephemeral state      |

---

### Category D: Non-Core/External (43 models) - DELETE/RELOCATE

| Model                    | Hits | Justification               | Destination                   |
| ------------------------ | ---- | --------------------------- | ----------------------------- |
| Experiment               | 193  | Feature experiments         | LaunchDarkly/Flagsmith        |
| FeatureFlag              | 126  | Feature flags               | LaunchDarkly/Flagsmith        |
| ExperimentAssignment     | 16   | Experiment assignments      | LaunchDarkly/Flagsmith        |
| ExperimentEvent          | 14   | Experiment events           | LaunchDarkly/Flagsmith        |
| ExperimentVariant        | 10   | Experiment variants         | LaunchDarkly/Flagsmith        |
| FeatureFlagOverride      | 12   | Flag overrides              | LaunchDarkly/Flagsmith        |
| FeatureFlagAuditLog      | 4    | Flag audit                  | LaunchDarkly/Flagsmith        |
| ExperimentSegment        | 0    | Unused                      | Delete                        |
| UserSegment              | 7    | User segments               | LaunchDarkly/Flagsmith        |
| SegmentFeatureTarget     | 0    | Unused                      | Delete                        |
| SegmentMembershipHistory | 0    | Unused                      | Delete                        |
| news_posts               | 16   | News content                | CMS/Sanity/Contentful         |
| news_items               | 8    | News items                  | CMS                           |
| news_categories          | 3    | News categories             | CMS                           |
| news_post_sources        | 3    | News sources                | CMS                           |
| news_tags                | 2    | News tags                   | CMS                           |
| news_sources             | 2    | News sources                | CMS                           |
| checklist_interactions   | 7    | Checklist tracking          | JSON preferences              |
| BetaFeedback             | 9    | Beta feedback               | External feedback tool        |
| AIFeedback               | 5    | AI feedback                 | Logs/metrics                  |
| TravelOrder              | 0    | Unused                      | Delete                        |
| WebAuthnCredential       | 0    | Unused                      | Delete if not implementing    |
| VerificationToken        | 0    | Unused                      | Delete (use VerificationCode) |
| SupportTicketAttachment  | 0    | Unused                      | Delete                        |
| RolePermission           | 0    | Unused                      | Delete                        |
| EmailSuppression         | 0    | Unused                      | Delete                        |
| FixedAssetCandidate      | 2    | Duplicate of AssetCandidate | Delete                        |

---

## Enum Categorization

### Domain Invariant (48 enums) - KEEP

| Enum                  | Justification                  |
| --------------------- | ------------------------------ |
| SystemRole            | USER/STAFF/ADMIN - core auth   |
| Role                  | OWNER/ADMIN/MEMBER/VIEWER      |
| InvoiceType           | INVOICE/CREDIT_NOTE/etc        |
| EInvoiceDirection     | INBOUND/OUTBOUND               |
| EInvoiceStatus        | Core e-invoice states          |
| FiscalStatus          | Core fiscal states             |
| FiscalEnv             | PRODUCTION/TEST                |
| ExpenseStatus         | DRAFT/PENDING/APPROVED/etc     |
| DocumentType          | Core document types            |
| DocumentStatus        | Core document states           |
| ContactType           | CUSTOMER/SUPPLIER/etc          |
| PaymentMethod         | Core payment methods           |
| TxDirection           | DEBIT/CREDIT                   |
| AccountNormalBalance  | DEBIT/CREDIT                   |
| AssetCategory         | TANGIBLE/INTANGIBLE/etc        |
| DepreciationMethod    | LINEAR/DEGRESSIVE/etc          |
| StockMovementType     | IN/OUT/ADJUSTMENT              |
| StockValuationMethod  | FIFO/LIFO/etc                  |
| TravelVehicleType     | Travel vehicle types           |
| TravelOrderStatus     | Travel order states            |
| EmploymentType        | FULL_TIME/PART_TIME/etc        |
| TerminationReason     | Employment termination reasons |
| DependentRelation     | CHILD/SPOUSE/etc               |
| AllowanceType         | Allowance types                |
| PensionPillarType     | Pension pillar types           |
| ObligationType        | Obligation types               |
| CertStatus            | Certificate states             |
| ConnectionStatus      | Bank connection states         |
| EmailProvider         | Email providers                |
| ImportFormat          | Import formats                 |
| ExportTargetSystem    | Export targets                 |
| WebhookEventStatus    | Webhook states                 |
| SupportTicketStatus   | Ticket states                  |
| SupportTicketPriority | Ticket priorities              |
| TicketCategory        | Ticket categories              |
| Frequency             | DAILY/WEEKLY/MONTHLY/etc       |
| PeriodType            | MONTH/QUARTER/YEAR             |
| PeriodStatus          | Period states                  |
| ReportType            | Report types                   |
| ReportSchedule        | Report schedules               |
| AuditAction           | Audit actions                  |
| AttachmentSource      | Attachment sources             |
| AttachmentStatus      | Attachment states              |
| TransactionSource     | Transaction sources            |
| MatchKind             | Match types                    |
| MatchSource           | Match sources                  |
| MatchStatus           | Match states                   |
| DuplicateStatus       | Duplicate states               |

### Workflow State (52 enums) - CONVERT TO VARCHAR

| Enum                       | Justification                         |
| -------------------------- | ------------------------------------- |
| AgentType                  | Pipeline agent types - workflow state |
| ArticleStatus              | Article pipeline states               |
| ArticleType                | Article types                         |
| AssetCandidateSource       | Candidate sources                     |
| AssetCandidateStatus       | Candidate states                      |
| DiscoveredItemStatus       | Discovery states                      |
| DiscoveryEndpointType      | Endpoint types                        |
| DiscoveryPriority          | Discovery priorities                  |
| EntryStatus                | Entry states                          |
| FiscalMessageType          | Fiscal message types                  |
| FiscalResponseStatus       | Response states                       |
| FixedAssetCandidateStatus  | Candidate states                      |
| FreshnessRisk              | Freshness levels                      |
| GraphEdgeType              | Graph edge types                      |
| HumanReviewPriority        | Review priorities                     |
| HumanReviewStatus          | Review states                         |
| JobStatus                  | Job states                            |
| JoppdSubmissionStatus      | JOPPD states                          |
| ListingStrategy            | Listing strategies                    |
| NodeRole                   | Node roles                            |
| NodeType                   | Node types                            |
| OperationalEventStatus     | Event states                          |
| OperationalEventType       | Event types                           |
| OperationalSourceType      | Source types                          |
| OutboxEventStatus          | Outbox states                         |
| PageStatus                 | Page states                           |
| PayoutStatus               | Payout states                         |
| PersonEventType            | Person event types                    |
| PersonSnapshotAction       | Snapshot actions                      |
| ProcessType                | Process types                         |
| ReferenceCategory          | Reference categories                  |
| ReportingState             | Reporting states                      |
| ReviewDecisionType         | Decision types                        |
| ReviewQueueEntityType      | Entity types                          |
| ReviewQueuePriority        | Queue priorities                      |
| ReviewQueueStatus          | Queue states                          |
| RiskTier                   | Risk tiers                            |
| RuleStability              | Rule stability levels                 |
| RuleStatus                 | Rule states                           |
| ScrapeFrequency            | Scrape frequencies                    |
| SourcePointerMatchType     | Match types                           |
| StaffReviewEntity          | Review entities                       |
| SubjectType                | Subject types                         |
| SyncProvider               | Sync providers                        |
| SystemStatusEventType      | Status event types                    |
| SystemStatusHeadline       | Status headlines                      |
| SystemStatusJobMode        | Job modes                             |
| SystemStatusJobStatus      | Job states                            |
| SystemStatusRefreshQuality | Refresh quality                       |
| SystemStatusRefreshStatus  | Refresh states                        |
| TransitionPattern          | Transition patterns                   |
| WatchdogAlertType          | Alert types                           |
| WatchdogCheckType          | Check types                           |
| WatchdogHealthStatus       | Health states                         |
| WatchdogSeverity           | Severity levels                       |

### UI/Helper (30 enums) - DELETE

| Enum                          | Justification                  |
| ----------------------------- | ------------------------------ |
| AdminAlertStatus              | Duplicate of AlertType         |
| AlertSeverity                 | Move to code                   |
| AlertType                     | Move to code                   |
| ArtifactType                  | RTL-specific, move to B schema |
| AssertionType                 | RTL-specific, move to B schema |
| AssetFormat                   | RTL-specific, move to B schema |
| AssetStatus                   | RTL-specific, move to B schema |
| AssetType                     | RTL-specific, move to B schema |
| AuditResult                   | Move to code                   |
| AuthorityLevel                | RTL-specific, move to B schema |
| AutomationPolicy              | Move to code                   |
| CertificateNotificationStatus | Move to code                   |
| ClientInvitationStatus        | Move to code                   |
| ConflictStatus                | RTL-specific, move to B schema |
| ConflictType                  | RTL-specific, move to B schema |
| DepreciationScheduleStatus    | Move to code                   |
| DuplicateResolution           | Move to code                   |
| EmailConnectionStatus         | Duplicate of ConnectionStatus  |
| EmploymentContractStatus      | Move to code                   |
| ExperimentStatus              | Feature flag service handles   |
| ExportJobStatus               | Duplicate of JobStatus         |
| FeatureFlagAuditAction        | Feature flag service handles   |
| FeatureFlagScope              | Feature flag service handles   |
| FeatureFlagStatus             | Feature flag service handles   |
| MileageLogSource              | Move to code                   |
| SegmentLogicOperator          | Feature flag service handles   |
| SegmentOperator               | Feature flag service handles   |
| SegmentStatus                 | Feature flag service handles   |
| StatementType                 | Move to code                   |
| TierType                      | Move to code                   |
| VerificationCodeType          | Move to code                   |
| AccountLockLevel              | Move to code                   |
| AccountingPeriodStatus        | Duplicate of PeriodStatus      |

---

## Summary

| Category     | Models  | Target                       |
| ------------ | ------- | ---------------------------- |
| A - Core     | 99      | Keep in core schema          |
| B - RTL      | 31      | Isolate to regulatory schema |
| C - Pipeline | 24      | Eject to Redis/BullMQ        |
| D - Non-Core | 46      | Delete or external service   |
| **Total**    | **200** |                              |

| Category         | Enums   | Target                         |
| ---------------- | ------- | ------------------------------ |
| Domain Invariant | 48      | Keep as enums                  |
| Workflow State   | 52      | Convert to VARCHAR             |
| UI/Helper        | 30      | Delete (many are RTL-specific) |
| RTL-Specific     | 9       | Move to B schema               |
| **Total**        | **139** |                                |

---

## Migration Priority

### P0: Immediate (no code changes, pure cleanup)

**26 completely unused models:**

- SystemRegistryRefreshJob
- SystemRegistryRefreshLock
- SystemRegistryStatusEvent
- SystemRegistryStatusPointer
- SystemRegistryStatusSnapshot
- WatchdogAudit
- WebhookSubscription
- WebAuthnCredential
- VerificationToken
- TravelOrder
- SupportTicketAttachment
- SoftFailLog
- SegmentMembershipHistory
- SegmentFeatureTarget
- RuleCalculation
- RolePermission
- RegulatoryAuditLog
- ReasoningTrace
- PotentialDuplicate
- MonitoringAlert
- JoppdSubmissionEvent
- HumanReviewQueue
- ExperimentSegment
- EmailSuppression
- CronJobError
- ClaimVerification

### P1: Low risk (minimal code changes)

**6 news models:**

- news_posts
- news_items
- news_categories
- news_post_sources
- news_tags
- news_sources

### P2: Medium risk (requires code migration)

**11 feature flag models:**

- Experiment
- ExperimentAssignment
- ExperimentEvent
- ExperimentVariant
- FeatureFlag
- FeatureFlagOverride
- FeatureFlagAuditLog
- UserSegment

### P3: RTL isolation (requires infra work)

**31 RTL models** - move to `prisma/regulatory.prisma`

---

## Top 20 Biggest Offenders (Churn/Complexity)

| Rank | Model/Enum                  | Issue                    | Impact                    |
| ---- | --------------------------- | ------------------------ | ------------------------- |
| 1    | SystemRegistry\* (5 models) | Entirely unused, 0 hits  | Dead code bloat           |
| 2    | Experiment\* (8 models)     | 193+ hits, wrong layer   | Should be external        |
| 3    | FeatureFlag\* (4 models)    | 126+ hits, wrong layer   | Should be external        |
| 4    | news\_\* (6 models)         | 16 hits max, wrong layer | Should be CMS             |
| 5    | Evidence/Concept/Claim      | 581/462/267 hits         | RTL coupling to core      |
| 6    | AgentRun                    | 32 hits, pipeline state  | Should be BullMQ          |
| 7    | ArticleJob                  | 48 hits, pipeline state  | Should be BullMQ          |
| 8    | AIUsage                     | 44 hits, telemetry       | Should be logs            |
| 9    | Unused enums (30+)          | Zero runtime use         | Enum migration friction   |
| 10   | Workflow enums (52)         | Frequent changes         | Migration lock contention |
| 11   | WatchdogAudit               | 0 hits, unused           | Dead code                 |
| 12   | HumanReviewQueue            | 0 hits, duplicate        | Dead code                 |
| 13   | ReasoningTrace              | 0 hits, unused           | Dead code                 |
| 14   | SoftFailLog                 | 0 hits, unused           | Dead code                 |
| 15   | PotentialDuplicate          | 0 hits, unused           | Dead code                 |
| 16   | ClaimVerification           | 0 hits, unused           | Dead code                 |
| 17   | RegulatoryAuditLog          | 0 hits, duplicate        | Dead code                 |
| 18   | checklist_interactions      | 7 hits, wrong layer      | JSON preferences          |
| 19   | BetaFeedback                | 9 hits, wrong layer      | External tool             |
| 20   | FixedAssetCandidate         | 2 hits, duplicate        | AssetCandidate exists     |
