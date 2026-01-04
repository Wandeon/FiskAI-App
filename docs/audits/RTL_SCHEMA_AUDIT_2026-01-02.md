# Prisma Schema Audit Report

**Date:** 2026-01-02
**Auditor Role:** Principal Data Architect
**Schema:** `/prisma/schema.prisma`
**Lines:** 5,822
**Models:** 203
**Enums:** 130

---

## Executive Summary

The schema is **3-4x larger than justified** for a core transactional system. The 60k token size results from three compounding architectural failures:

1. **No boundary between core product and auxiliary systems** — RTL, news, experiments, and AI pipelines share the same schema
2. **Workflow state stored as permanent tables** — Agent runs, extraction failures, and processing queues are modeled as durable entities
3. **Enum explosion** — 130 enums encode workflow stages, UI states, and pipeline phases that change frequently

**Verdict:** Schema partitioning is **mandatory**. Approximately 74 models (36%) must be removed or isolated.

---

## 1. Quantitative Breakdown

### Models by Category

| Category                | Count | Percentage | Action                    |
| ----------------------- | ----- | ---------- | ------------------------- |
| A. Core Transactional   | 102   | 50.2%      | KEEP                      |
| B. Regulatory/Archival  | 27    | 13.3%      | ISOLATE (separate schema) |
| C. AI/Pipeline State    | 31    | 15.3%      | REMOVE                    |
| D. Derived/Cache/Helper | 43    | 21.2%      | RETHINK (mostly remove)   |

### Enums by Category

| Category         | Count | Percentage | Action       |
| ---------------- | ----- | ---------- | ------------ |
| Domain Invariant | 48    | 36.9%      | KEEP         |
| Workflow State   | 52    | 40.0%      | MOVE to code |
| UI/Helper State  | 30    | 23.1%      | DELETE       |

### Estimated Token Reduction

| Action                             | Token Reduction       |
| ---------------------------------- | --------------------- |
| Remove Category C models           | ~12k tokens           |
| Move Category B to separate schema | ~15k tokens           |
| Remove/rethink Category D          | ~10k tokens           |
| Remove workflow enums              | ~5k tokens            |
| **Total Reduction**                | **~42k tokens (70%)** |

---

## 2. Category A: Core Transactional Data (MUST STAY)

These 102 models represent business-critical state. They must remain in the core schema.

### Authentication & Access (9 models)

| Model                | Purpose                 |
| -------------------- | ----------------------- |
| `User`               | Platform users          |
| `Account`            | OAuth accounts          |
| `Session`            | User sessions           |
| `VerificationToken`  | Email verification      |
| `VerificationCode`   | Login codes             |
| `PasswordResetToken` | Password resets         |
| `WebAuthnCredential` | Passkeys                |
| `Permission`         | RBAC permissions        |
| `RolePermission`     | Role-permission mapping |

### Multi-Tenant Core (5 models)

| Model                | Purpose                  |
| -------------------- | ------------------------ |
| `Company`            | Tenant entity            |
| `CompanyUser`        | User-tenant membership   |
| `StaffAssignment`    | Staff-client assignments |
| `ClientInvitation`   | Client onboarding        |
| `EntitlementHistory` | Entitlement changes      |

### People & Contacts (8 models)

| Model                | Purpose                    |
| -------------------- | -------------------------- |
| `Contact`            | Customer/supplier contacts |
| `Address`            | Physical addresses         |
| `Organization`       | Legal entities             |
| `TaxIdentity`        | OIB/VAT numbers            |
| `Person`             | Natural persons            |
| `PersonContactRole`  | Contact role junction      |
| `PersonEmployeeRole` | Employee role junction     |
| `PersonDirectorRole` | Director role junction     |

### Invoicing (5 models)

| Model                  | Purpose                  |
| ---------------------- | ------------------------ |
| `EInvoice`             | Invoice records          |
| `EInvoiceLine`         | Invoice line items       |
| `RevenueRegisterEntry` | Revenue recognition      |
| `InvoiceSequence`      | Invoice numbering        |
| `InvoiceEvent`         | Invoice lifecycle events |

### Expenses (8 models)

| Model               | Purpose                 |
| ------------------- | ----------------------- |
| `Expense`           | Expense records         |
| `ExpenseLine`       | Expense line items      |
| `SupplierBill`      | Supplier invoices       |
| `UraInput`          | URA input tax records   |
| `ExpenseCorrection` | Expense adjustments     |
| `ExpenseCategory`   | Expense categories      |
| `RecurringExpense`  | Recurring expense rules |
| `Attachment`        | File attachments        |

### Banking (7 models)

| Model                | Purpose              |
| -------------------- | -------------------- |
| `BankAccount`        | Bank accounts        |
| `BankTransaction`    | Bank transactions    |
| `MatchRecord`        | Transaction matching |
| `BankConnection`     | Bank API connections |
| `PotentialDuplicate` | Duplicate detection  |
| `StatementImport`    | Statement imports    |
| `Document`           | Document records     |

### Inventory (5 models)

| Model               | Purpose             |
| ------------------- | ------------------- |
| `Product`           | Products/services   |
| `Warehouse`         | Warehouses          |
| `StockItem`         | Stock levels        |
| `StockMovement`     | Stock movements     |
| `ValuationSnapshot` | Inventory valuation |

### Accounting (8 models)

| Model              | Purpose                 |
| ------------------ | ----------------------- |
| `ChartOfAccounts`  | Account codes           |
| `AccountingPeriod` | Fiscal periods          |
| `JournalEntry`     | Journal entries         |
| `JournalLine`      | Journal lines           |
| `TrialBalance`     | Period balances         |
| `PostingRule`      | Auto-posting rules      |
| `OperationalEvent` | Event-to-journal bridge |
| `AuditLog`         | Business audit trail    |

### Payroll (18 models)

| Model                        | Purpose               |
| ---------------------------- | --------------------- |
| `Employee`                   | Employee records      |
| `EmployeeRole`               | Employee roles        |
| `EmploymentContract`         | Employment contracts  |
| `EmploymentContractVersion`  | Contract versions     |
| `EmploymentTerminationEvent` | Terminations          |
| `Dependent`                  | Employee dependents   |
| `Allowance`                  | Allowances            |
| `PensionPillar`              | Pension contributions |
| `Payout`                     | Payroll runs          |
| `PayoutLine`                 | Payroll line items    |
| `Payslip`                    | Payslip records       |
| `PayslipArtifact`            | Payslip PDFs          |
| `CalculationSnapshot`        | Calculation records   |
| `BankPaymentExport`          | Payment exports       |
| `BankPaymentLine`            | Payment lines         |
| `JoppdSubmission`            | JOPPD submissions     |
| `JoppdSubmissionLine`        | JOPPD lines           |
| `JoppdSubmissionEvent`       | JOPPD events          |

### Fiscalization (9 models)

| Model               | Purpose                 |
| ------------------- | ----------------------- |
| `FiscalCertificate` | Fiscal certificates     |
| `FiscalRequest`     | Fiscalization requests  |
| `FiscalResponse`    | Fiscalization responses |
| `BusinessPremises`  | Business premises       |
| `PaymentDevice`     | Payment devices         |
| `CashIn`            | Cash inflows            |
| `CashOut`           | Cash outflows           |
| `CashDayClose`      | Daily cash close        |
| `CashLimitSetting`  | Cash limits             |

### Fixed Assets (6 models)

| Model                  | Purpose                     |
| ---------------------- | --------------------------- |
| `FixedAsset`           | Fixed assets                |
| `DepreciationSchedule` | Depreciation schedules      |
| `DepreciationEntry`    | Depreciation entries        |
| `DisposalEvent`        | Asset disposals             |
| `AssetCandidate`       | Asset identification        |
| `FixedAssetCandidate`  | Expense-to-asset candidates |

### Travel & Mileage (3 models)

| Model         | Purpose         |
| ------------- | --------------- |
| `TravelOrder` | Travel orders   |
| `MileageLog`  | Mileage records |
| `TravelPdf`   | Travel PDFs     |

### Reporting & Review (4 models)

| Model             | Purpose                  |
| ----------------- | ------------------------ |
| `ReportingStatus` | Report submission status |
| `ReviewQueueItem` | Review queue             |
| `ReviewDecision`  | Review decisions         |
| `SavedReport`     | Saved report configs     |

### Exports & Integrations (4 models)

| Model            | Purpose               |
| ---------------- | --------------------- |
| `ExportProfile`  | Export configurations |
| `AccountMapping` | Account mappings      |
| `ExportJob`      | Export jobs           |
| `Artifact`       | Generic file storage  |

### Support (3 models)

| Model                     | Purpose            |
| ------------------------- | ------------------ |
| `SupportTicket`           | Support tickets    |
| `SupportTicketMessage`    | Ticket messages    |
| `SupportTicketAttachment` | Ticket attachments |

---

## 3. Category B: Regulatory/Archival Data (ISOLATE)

These 27 models belong in a **separate Prisma schema** pointing to a dedicated database or schema namespace. They are:

- Append-only or immutable
- Rarely queried in real-time flows
- Required for 11+ year retention
- Independent of core transactional workflows

### Discovery Layer (3 models)

| Model               | Purpose            | Retention |
| ------------------- | ------------------ | --------- |
| `RegulatorySource`  | Source authorities | Permanent |
| `DiscoveryEndpoint` | Crawl endpoints    | Permanent |
| `DiscoveredItem`    | Discovered URLs    | 11+ years |

### Evidence Layer (3 models)

| Model              | Purpose                | Retention |
| ------------------ | ---------------------- | --------- |
| `Evidence`         | Raw regulatory content | 11+ years |
| `EvidenceArtifact` | PDF artifacts          | 11+ years |
| `SourcePointer`    | Quote provenance       | 11+ years |

### Rule Layer (6 models)

| Model             | Purpose              | Retention |
| ----------------- | -------------------- | --------- |
| `RegulatoryRule`  | Regulatory rules     | Permanent |
| `RuleVersion`     | Rule versions        | Permanent |
| `RuleSnapshot`    | Rule state snapshots | 11+ years |
| `RuleCalculation` | Calculation rules    | Permanent |
| `RuleTable`       | Rate tables          | Permanent |
| `RuleRelease`     | Rule releases        | Permanent |

### Semantic Layer (5 models)

| Model              | Purpose             | Retention |
| ------------------ | ------------------- | --------- |
| `AtomicClaim`      | Extracted claims    | 11+ years |
| `ClaimException`   | Claim exceptions    | 11+ years |
| `Concept`          | Domain concepts     | Permanent |
| `ConceptEmbedding` | Concept vectors     | Ephemeral |
| `ConceptNode`      | Concept graph nodes | Permanent |

### Process Layer (2 models)

| Model               | Purpose             | Retention |
| ------------------- | ------------------- | --------- |
| `RegulatoryProcess` | Process definitions | Permanent |
| `ProcessStep`       | Process steps       | Permanent |

### Reference Layer (4 models)

| Model                   | Purpose            | Retention |
| ----------------------- | ------------------ | --------- |
| `ReferenceTable`        | Reference tables   | Permanent |
| `ReferenceEntry`        | Reference entries  | Permanent |
| `RegulatoryAsset`       | Regulatory assets  | 11+ years |
| `TransitionalProvision` | Transitional rules | 11+ years |

### Audit Layer (4 models)

| Model                     | Purpose            | Retention |
| ------------------------- | ------------------ | --------- |
| `GraphEdge`               | Rule relationships | Permanent |
| `RegulatoryConflict`      | Conflict records   | 11+ years |
| `ConflictResolutionAudit` | Resolution audit   | 11+ years |
| `RegulatoryAuditLog`      | Regulatory audit   | 11+ years |

**Recommendation:** Create `prisma/regulatory.prisma` with separate `DATABASE_URL_REGULATORY` connection. Use PostgreSQL schema namespacing (`regulatory.*`).

---

## 4. Category C: AI/Pipeline/Processing State (REMOVE FROM CORE)

These 31 models represent **transient processing state**. They do not belong in the core schema.

### Agent Execution (1 model) — MOVE TO REDIS/TEMPORAL

| Model      | Problem                                                            |
| ---------- | ------------------------------------------------------------------ |
| `AgentRun` | Tracks agent execution. This is workflow state, not business data. |

### Monitoring & Alerts (5 models) — MOVE TO MONITORING SYSTEM

| Model             | Problem                                                    |
| ----------------- | ---------------------------------------------------------- |
| `MonitoringAlert` | Pipeline alerts belong in Prometheus/Grafana, not Postgres |
| `WatchdogHealth`  | Health checks are operational, not transactional           |
| `WatchdogAlert`   | Watchdog alerts are operational                            |
| `WatchdogAudit`   | Audit of operational system                                |
| `AdminAlert`      | Admin alerts are operational                               |

### Review Queues (1 model) — RETHINK

| Model              | Problem                                              |
| ------------------ | ---------------------------------------------------- |
| `HumanReviewQueue` | Duplicates `ReviewQueueItem`. Consolidate or remove. |

### Dead Letter / Failure Tracking (3 models) — MOVE TO DLQ SYSTEM

| Model                | Problem                                    |
| -------------------- | ------------------------------------------ |
| `ExtractionRejected` | DLQ for extraction. Should be Redis/SQS.   |
| `SoftFailLog`        | Failure logs belong in logging system      |
| `ReasoningTrace`     | AI reasoning traces. Move to analytics DB. |

### Health Snapshots (3 models) — MOVE TO ANALYTICS

| Model                 | Problem                                |
| --------------------- | -------------------------------------- |
| `TruthHealthSnapshot` | Time-series data. Move to TimescaleDB. |
| `CoverageReport`      | Analytics data                         |
| `ComparisonMatrix`    | Derived comparison data                |

### System Registry (5 models) — MOVE TO SEPARATE SERVICE

| Model                          | Problem                |
| ------------------------------ | ---------------------- |
| `SystemRegistryStatusSnapshot` | System status tracking |
| `SystemRegistryStatusPointer`  | Status pointers        |
| `SystemRegistryStatusEvent`    | Status events          |
| `SystemRegistryRefreshJob`     | Refresh job state      |
| `SystemRegistryRefreshLock`    | Job locks. Use Redis.  |

### Import Processing (4 models) — CONSOLIDATE

| Model           | Problem                                |
| --------------- | -------------------------------------- |
| `ImportJob`     | Processing state. Should be ephemeral. |
| `Statement`     | Derived from bank statements           |
| `StatementPage` | Processing artifact                    |
| `Transaction`   | Duplicates `BankTransaction`           |

### Content Generation Pipeline (7 models) — MOVE TO SEPARATE DB

| Model               | Problem                                      |
| ------------------- | -------------------------------------------- |
| `ArticleJob`        | Content pipeline state                       |
| `FactSheet`         | Intermediate processing                      |
| `Claim`             | Extracted claims (different from RTL claims) |
| `SourceChunk`       | Processing artifact                          |
| `ArticleDraft`      | Draft content                                |
| `DraftParagraph`    | Draft paragraphs                             |
| `ClaimVerification` | Verification state                           |

### AI Tracking (2 models) — MOVE TO ANALYTICS

| Model        | Problem                            |
| ------------ | ---------------------------------- |
| `AIFeedback` | Feedback tracking                  |
| `AIUsage`    | Usage tracking. Move to analytics. |

---

## 5. Category D: Derived/Cache/Helper Data (RETHINK)

These 43 models should be evaluated individually. Many should be removed.

### News System (6 models) — REMOVE ENTIRELY

| Model               | Verdict                   |
| ------------------- | ------------------------- |
| `news_categories`   | DELETE — Not core product |
| `news_items`        | DELETE — Not core product |
| `news_post_sources` | DELETE — Not core product |
| `news_posts`        | DELETE — Not core product |
| `news_sources`      | DELETE — Not core product |
| `news_tags`         | DELETE — Not core product |

**Reasoning:** News is a marketing feature. It should be in a CMS (Sanity, Contentful) or separate microservice.

### User Preferences (4 models) — CONSOLIDATE

| Model                       | Verdict                                   |
| --------------------------- | ----------------------------------------- |
| `newsletter_subscriptions`  | MOVE to email service (Resend, Mailchimp) |
| `notification_preference`   | CONSOLIDATE into User.preferences JSON    |
| `user_guidance_preferences` | CONSOLIDATE into User.preferences JSON    |
| `checklist_interactions`    | CONSOLIDATE into User.preferences JSON    |

### Domain-Specific Profiles (3 models) — CONSOLIDATE

| Model                  | Verdict                                |
| ---------------------- | -------------------------------------- |
| `pausalni_profile`     | CONSOLIDATE into Company.settings JSON |
| `payment_obligation`   | KEEP (represents real obligations)     |
| `compliance_deadlines` | KEEP (regulatory deadlines)            |

### EU Transactions (2 models) — KEEP

| Model            | Verdict                       |
| ---------------- | ----------------------------- |
| `eu_transaction` | KEEP (regulatory requirement) |
| `eu_vendor`      | KEEP (EU vendor tracking)     |

### Person History (2 models) — KEEP

| Model            | Verdict                  |
| ---------------- | ------------------------ |
| `PersonSnapshot` | KEEP (audit requirement) |
| `PersonEvent`    | KEEP (audit requirement) |

### Email System (4 models) — CONSOLIDATE

| Model              | Verdict                                     |
| ------------------ | ------------------------------------------- |
| `EmailSuppression` | KEEP (deliverability requirement)           |
| `EmailConnection`  | KEEP (email import feature)                 |
| `EmailImportRule`  | CONSOLIDATE into EmailConnection.rules JSON |
| `EmailAttachment`  | KEEP (attachment tracking)                  |

### Notifications (2 models) — CONSOLIDATE

| Model                     | Verdict                              |
| ------------------------- | ------------------------------------ |
| `CertificateNotification` | KEEP (notification queue)            |
| `generated_form`          | DELETE — Should be runtime generated |

### Feature Flags & Experiments (11 models) — MOVE TO EXTERNAL SERVICE

| Model                      | Verdict                        |
| -------------------------- | ------------------------------ |
| `FeatureFlag`              | MOVE to LaunchDarkly/Flagsmith |
| `FeatureFlagOverride`      | MOVE                           |
| `FeatureFlagAuditLog`      | MOVE                           |
| `UserSegment`              | MOVE                           |
| `SegmentMembershipHistory` | MOVE                           |
| `SegmentFeatureTarget`     | MOVE                           |
| `Experiment`               | MOVE                           |
| `ExperimentSegment`        | MOVE                           |
| `ExperimentVariant`        | MOVE                           |
| `ExperimentAssignment`     | MOVE                           |
| `ExperimentEvent`          | MOVE                           |

**Reasoning:** Feature flag systems are infrastructure, not business data. Use a purpose-built service.

### Webhooks & Events (3 models) — KEEP BUT SIMPLIFY

| Model                 | Verdict                        |
| --------------------- | ------------------------------ |
| `WebhookSubscription` | KEEP                           |
| `WebhookEvent`        | KEEP (but prune after 30 days) |
| `OutboxEvent`         | KEEP (outbox pattern)          |

### Other (3 models)

| Model          | Verdict                          |
| -------------- | -------------------------------- |
| `StaffReview`  | CONSOLIDATE with ReviewQueueItem |
| `BetaFeedback` | MOVE to analytics                |
| `CronJobError` | MOVE to logging system           |

---

## 6. Enum Audit Summary

### Domain Invariant Enums (KEEP) — 48 enums

These represent stable business concepts:

```
Role, SystemRole, ContactType, TaxIdentityType, EInvoiceDirection, EInvoiceStatus,
InvoiceType, AccountNormalBalance, StatementType, AccountLockLevel, EntryStatus,
PeriodType, PeriodStatus, ReportType, ExpenseStatus, PaymentMethod, Frequency,
MatchStatus, MatchSource, MatchKind, FiscalEnv, CertStatus, FiscalStatus,
FiscalMessageType, FiscalResponseStatus, EmploymentContractStatus, EmploymentType,
TerminationReason, DependentRelation, AllowanceType, PensionPillarType,
StockMovementType, StockValuationMethod, TxDirection, DocumentType, DocumentStatus,
TravelOrderStatus, TravelVehicleType, MileageLogSource, TicketCategory,
SupportTicketStatus, SupportTicketPriority, ImportFormat, ArtifactType,
AssetCategory, AssetStatus, DepreciationMethod, DepreciationScheduleStatus
```

### Workflow State Enums (MOVE TO CODE) — 52 enums

These encode pipeline/processing states that change frequently:

```
VerificationCodeType, ClientInvitationStatus, StaffReviewEntity, PersonSnapshotAction,
PersonEventType, InvoiceEventType, ReportingState, ReviewQueueStatus, ReviewQueuePriority,
ReviewQueueEntityType, ReviewDecisionType, OperationalSourceType, OperationalEventType,
OperationalEventStatus, ExportTargetSystem, EntitlementChangeType, AuditAction,
ReportSchedule, JobStatus, ExportJobStatus, JoppdSubmissionStatus, PayoutStatus,
TierType, PageStatus, SyncProvider, ConnectionStatus, TransactionSource,
DuplicateStatus, DuplicateResolution, EmailProvider, EmailConnectionStatus,
AttachmentStatus, AttachmentSource, FixedAssetCandidateStatus, CertificateNotificationStatus,
ArticleType, ArticleStatus, DiscoveredItemStatus, AgentType, RuleStatus, ConflictType,
ConflictStatus, AlertSeverity, AlertType, HumanReviewPriority, HumanReviewStatus,
WatchdogSeverity, WatchdogHealthStatus, WatchdogCheckType, WatchdogAlertType,
AuditResult, AdminAlertStatus
```

**Problem:** Every enum addition requires a database migration. Workflow states should be TypeScript constants or a `status` VARCHAR column with application-level validation.

### UI/Helper Enums (DELETE) — 30 enums

These are RTL-specific, system registry, or feature flag enums that should not exist in core:

```
DiscoveryEndpointType, DiscoveryPriority, ScrapeFrequency, ListingStrategy,
NodeType, NodeRole, FreshnessRisk, RiskTier, GraphEdgeType, AuthorityLevel,
AutomationPolicy, RuleStability, ObligationType, SubjectType, AssertionType,
ProcessType, ReferenceCategory, AssetFormat, AssetType, TransitionPattern,
SourcePointerMatchType, SystemStatusHeadline, SystemStatusRefreshStatus,
SystemStatusRefreshQuality, SystemStatusEventType, SystemStatusJobStatus,
SystemStatusJobMode, FeatureFlagScope, FeatureFlagStatus, AccountingPeriodStatus,
FeatureFlagAuditAction, SegmentStatus, SegmentOperator, SegmentLogicOperator,
ExperimentStatus, WebhookEventStatus, AssetCandidateStatus, AssetCandidateSource,
OutboxEventStatus
```

---

## 7. Root Cause Analysis

### 1. No Architectural Boundary Between Core and Auxiliary

**Symptom:** RTL models (`RegulatorySource`, `Evidence`, `AgentRun`) sit next to core models (`Company`, `EInvoice`).

**Cause:** The schema was grown organically without a clear boundary. There is no separate `prisma/regulatory.prisma` or namespace isolation.

**Impact:** Core product migrations affect RTL. RTL migrations block core deployments. Single schema means single migration lock.

### 2. Processing State Treated as Durable Data

**Symptom:** `AgentRun`, `ImportJob`, `ExtractionRejected`, `SoftFailLog` are Prisma models.

**Cause:** BullMQ job state was not trusted. Developers created database tables to track job execution.

**Impact:** Schema bloat. Unnecessary writes. Confusion between ephemeral and permanent data.

### 3. Enum Proliferation

**Symptom:** 130 enums, 52 of which represent workflow states.

**Cause:** TypeScript enums were mirrored to database enums for "type safety." Every new status requires a migration.

**Impact:** Migration churn. Cannot add new statuses without downtime. Enums cannot be removed.

### 4. Feature/Infrastructure Mixed with Product

**Symptom:** `FeatureFlag`, `Experiment`, `UserSegment`, `WebhookSubscription` in schema.

**Cause:** Build vs. buy decision defaulted to build. Feature flagging was implemented in-house.

**Impact:** Maintenance burden. Missing features (gradual rollout, A/B testing analytics). Wrong layer of abstraction.

### 5. News/Content in Transactional Database

**Symptom:** `news_*` models with snake_case naming (indicating different origin).

**Cause:** News feature was added directly to main schema instead of CMS.

**Impact:** Content editing requires developer intervention. Schema pollution. Wrong database for the job.

---

## 8. Target Schema Contract

After cleanup, `schema.prisma` must adhere to these rules:

### What schema.prisma IS responsible for:

1. **Multi-tenant identity** — Users, companies, roles, permissions
2. **Core transactional records** — Invoices, expenses, transactions, payroll
3. **Regulatory compliance records** — Audit logs, fiscal requests, revenue register
4. **Long-lived business entities** — Contacts, products, employees, assets
5. **User-facing state** — Tickets, documents, attachments

### What schema.prisma is NOT allowed to contain:

| Forbidden Category        | Reason          | Alternative             |
| ------------------------- | --------------- | ----------------------- |
| Agent/Job execution state | Ephemeral       | BullMQ, Temporal, Redis |
| Health/monitoring metrics | Operational     | Prometheus, TimescaleDB |
| Feature flags/experiments | Infrastructure  | LaunchDarkly, Flagsmith |
| Content/news              | CMS concern     | Sanity, Contentful      |
| AI reasoning traces       | Analytics       | ClickHouse, BigQuery    |
| Workflow state enums      | Migration churn | TypeScript constants    |
| Dead letter queues        | Ephemeral       | Redis, SQS              |
| System registry status    | Operational     | Dedicated service       |

### Rules for Future Additions:

1. **No model shall be added for ephemeral state.** If data is deleted within 30 days, it does not belong in Postgres.

2. **No enum shall encode workflow stages.** Use VARCHAR with TypeScript type guards.

3. **Any model requiring 11+ year retention goes to the regulatory schema.**

4. **Any model not tied to a Company or User goes to a separate schema.**

5. **Any model representing AI/pipeline state is forbidden.** Use purpose-built tools.

6. **snake_case models are banned.** All models use PascalCase per Prisma convention.

---

## 9. Recommended Next Actions

### Phase 1: Immediate (Week 1)

| Priority | Action                                                         | Impact             |
| -------- | -------------------------------------------------------------- | ------------------ |
| P0       | Create `prisma/regulatory.prisma` with Category B models       | Isolates RTL       |
| P0       | Delete `news_*` models (6 models)                              | Removes 300+ lines |
| P0       | Delete `SystemRegistry*` models (5 models)                     | Removes 200+ lines |
| P1       | Consolidate `*_preference` models into `User.preferences` JSON | Removes 3 models   |
| P1       | Consolidate `pausalni_profile` into `Company.settings` JSON    | Removes 1 model    |

### Phase 2: Short-term (Week 2-3)

| Priority | Action                                                    | Impact            |
| -------- | --------------------------------------------------------- | ----------------- |
| P1       | Migrate `FeatureFlag` et al. to LaunchDarkly/Flagsmith    | Removes 11 models |
| P1       | Move `AgentRun` to BullMQ job metadata                    | Removes 1 model   |
| P1       | Move `ExtractionRejected`, `SoftFailLog` to Redis DLQ     | Removes 2 models  |
| P2       | Consolidate `Statement`/`Transaction` with banking models | Removes 3 models  |
| P2       | Move `AIUsage`, `AIFeedback` to analytics DB              | Removes 2 models  |

### Phase 3: Medium-term (Month 1-2)

| Priority | Action                                                      | Impact                  |
| -------- | ----------------------------------------------------------- | ----------------------- |
| P2       | Replace workflow enums with VARCHAR + TypeScript types      | Removes migration churn |
| P2       | Move `ArticleJob` pipeline to separate service              | Removes 7 models        |
| P3       | Move `Watchdog*` models to monitoring system                | Removes 3 models        |
| P3       | Move `TruthHealthSnapshot`, `CoverageReport` to TimescaleDB | Removes 3 models        |

### Phase 4: Long-term (Quarter 2)

| Priority | Action                                             | Impact                |
| -------- | -------------------------------------------------- | --------------------- |
| P3       | Implement CDC for regulatory schema replication    | Enables read replicas |
| P3       | Archive Evidence older than 1 year to cold storage | Reduces hot DB size   |
| P4       | Evaluate ClickHouse for analytics queries          | Offloads analytics    |

---

## 10. Summary

| Metric | Current | Target | Reduction |
| ------ | ------- | ------ | --------- |
| Models | 203     | ~105   | 48%       |
| Enums  | 130     | ~60    | 54%       |
| Lines  | 5,822   | ~2,500 | 57%       |
| Tokens | ~60k    | ~18k   | 70%       |

**Go/No-Go Decision:**

- **Schema reduction:** GO — Required immediately
- **Schema partitioning:** GO — Required for regulatory isolation
- **Leave intact:** NO-GO — Current state is unsustainable

---

_Report generated by Principal Data Architect audit. Implementation requires product team approval for feature removal decisions._
