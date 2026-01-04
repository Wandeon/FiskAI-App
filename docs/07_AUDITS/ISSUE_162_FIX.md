# Issue #162 Fix: Low Published Rule Count

## Problem Statement

Only 12 out of 615 rules (1.9%) were published, severely limiting the AI Assistant's knowledge base.

### Status Distribution (Before Fix)

| Status         | Count | Percentage |
| -------------- | ----- | ---------- |
| DRAFT          | 509   | 82.8%      |
| REJECTED       | 65    | 10.6%      |
| PENDING_REVIEW | 28    | 4.6%       |
| PUBLISHED      | 12    | 1.9%       |
| APPROVED       | 1     | 0.2%       |

## Root Cause Analysis

The bottleneck was identified in the rule progression pipeline:

### Pipeline Flow

```
DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED
   ↓         ↓              ↓
REJECTED  REJECTED     [blocked]
```

### Bottlenecks Identified

1. **509 rules stuck in DRAFT**
   - Rules created by Composer agent but never reviewed
   - Reviewer agent required to progress from DRAFT → APPROVED/PENDING_REVIEW
   - Many rules had high confidence (428 with confidence = 1.0) but were never processed

2. **28 rules stuck in PENDING_REVIEW**
   - T0/T1 rules waiting for human approval (by design)
   - T2/T3 rules waiting for 24h grace period to elapse
   - Auto-approval threshold may have been too high

3. **Auto-approval policy is strict**
   - T0/T1 rules NEVER auto-approve (requires human review)
   - T2/T3 rules only auto-approve if:
     - Confidence >= 0.95 in reviewer
     - OR 24h+ in PENDING_REVIEW with confidence >= 0.90
   - Grace period auto-approval not being triggered regularly

## Solution

Created three new scripts to address the bottleneck:

### 1. `batch-review-drafts.ts`

Batch processes DRAFT rules through the reviewer agent.

**Features:**

- Processes DRAFT rules with confidence >= threshold
- Supports filtering by risk tier
- Can auto-publish approved rules
- Dry-run mode for previewing changes

**Usage:**

```bash
# Preview what would be processed
npx tsx src/lib/regulatory-truth/scripts/batch-review-drafts.ts --dry-run

# Process first 50 high-confidence T2/T3 rules
npx tsx src/lib/regulatory-truth/scripts/batch-review-drafts.ts --tiers "T2,T3" --max-rules 50

# Process and auto-publish all high-confidence rules
npx tsx src/lib/regulatory-truth/scripts/batch-review-drafts.ts --publish
```

### 2. `run-auto-approve.ts`

Manually triggers auto-approval for eligible PENDING_REVIEW rules.

**Criteria for auto-approval:**

- Status: PENDING_REVIEW
- Age: >= 24 hours
- Confidence: >= 0.90
- Risk tier: T2 or T3 only (T0/T1 never auto-approve)
- No open conflicts

**Usage:**

```bash
# Run with default settings (24h grace, 0.90 confidence)
npx tsx src/lib/regulatory-truth/scripts/run-auto-approve.ts

# Run with 48h grace period
AUTO_APPROVE_GRACE_HOURS=48 npx tsx src/lib/regulatory-truth/scripts/run-auto-approve.ts
```

### 3. `fix-publication-pipeline.ts`

Orchestrates the entire pipeline fix in one command.

**Steps:**

1. Analyze current state
2. Review high-confidence DRAFT rules (T2/T3, confidence >= 0.95)
3. Auto-approve eligible PENDING_REVIEW rules
4. Release all APPROVED rules

**Usage:**

```bash
# Preview what would happen
npx tsx src/lib/regulatory-truth/scripts/fix-publication-pipeline.ts --dry-run

# Execute the fix
npx tsx src/lib/regulatory-truth/scripts/fix-publication-pipeline.ts
```

## Implementation Details

### Changes Made

1. **Created `/src/lib/regulatory-truth/scripts/batch-review-drafts.ts`**
   - Batch processes DRAFT rules through reviewer
   - Supports filtering, dry-run, and auto-publish
   - Tracks statistics by risk tier

2. **Created `/src/lib/regulatory-truth/scripts/run-auto-approve.ts`**
   - Wrapper for `autoApproveEligibleRules()` function
   - Allows manual triggering of grace-period auto-approval
   - Configurable via environment variables

3. **Created `/src/lib/regulatory-truth/scripts/fix-publication-pipeline.ts`**
   - Orchestrates entire pipeline fix
   - Processes DRAFT → APPROVED → PUBLISHED
   - Provides detailed statistics and progress reporting

### Design Decisions

1. **Batch Processing**
   - Process in batches (default 100-200) to avoid timeouts
   - Can be run multiple times for large datasets
   - Ordered by risk tier and confidence

2. **Tier Separation**
   - T2/T3 rules can be auto-approved (low risk)
   - T0/T1 rules require human review (high risk)
   - Separate processing flows prevent blocking

3. **Dry-Run Mode**
   - All scripts support `--dry-run` for safety
   - Preview changes before execution
   - No database modifications in dry-run

4. **Statistics Tracking**
   - Detailed progress reporting
   - Error tracking and reporting
   - Before/after comparison

## Testing

### Dry-Run Testing

```bash
# Test the full pipeline fix
npx tsx src/lib/regulatory-truth/scripts/fix-publication-pipeline.ts --dry-run
```

### Incremental Testing

```bash
# 1. Test review of a small batch
npx tsx src/lib/regulatory-truth/scripts/batch-review-drafts.ts --max-rules 10 --dry-run

# 2. Test auto-approval
npx tsx src/lib/regulatory-truth/scripts/run-auto-approve.ts

# 3. Test release (use existing approved rules)
npx tsx src/lib/regulatory-truth/scripts/run-releaser.ts
```

## Operational Considerations

### Ongoing Maintenance

1. **Automated Processing**
   - Consider adding cron job to run `run-auto-approve.ts` daily
   - Monitor DRAFT rule accumulation
   - Alert on high PENDING_REVIEW backlog

2. **Human Review Queue**
   - T0/T1 rules will accumulate in PENDING_REVIEW
   - Need UI or process for human reviewers
   - Consider implementing review dashboard

3. **Monitoring**
   - Track publication rate over time
   - Alert if DRAFT rules grow without progression
   - Monitor reviewer agent failures

### Recommended Workflow

**Daily:**

```bash
# Auto-approve eligible rules (T2/T3 that aged 24h)
npx tsx src/lib/regulatory-truth/scripts/run-auto-approve.ts
```

**Weekly:**

```bash
# Review and publish new high-confidence rules
npx tsx src/lib/regulatory-truth/scripts/batch-review-drafts.ts --tiers "T2,T3" --publish

# Generate review bundle for T0/T1 rules
npx tsx src/lib/regulatory-truth/scripts/generate-review-bundle.ts --tiers "T0,T1"
```

**As Needed:**

```bash
# Fix pipeline if backlog accumulates
npx tsx src/lib/regulatory-truth/scripts/fix-publication-pipeline.ts
```

## Expected Results

After running the fix:

1. **Immediate Impact**
   - DRAFT rules with high confidence processed
   - T2/T3 rules auto-approved and published
   - Publication rate should increase from 2% to 40-60%

2. **Ongoing Flow**
   - T2/T3 rules auto-approve after 24h grace period
   - T0/T1 rules queue for human review
   - Published count grows steadily

3. **AI Assistant Impact**
   - More regulatory knowledge available
   - Better answers to user questions
   - Improved confidence in responses

## Rollback Plan

If issues occur:

1. **Stop Processing**

   ```bash
   # All scripts can be safely interrupted (Ctrl+C)
   ```

2. **Revert Published Rules**

   ```bash
   # Use the rollback function (if needed)
   npx tsx src/lib/regulatory-truth/scripts/run-releaser.ts --rollback <version>
   ```

3. **Review Audit Logs**
   - All operations are logged to RegulatoryAuditLog
   - Filter by action: RULE_APPROVED, RULE_PUBLISHED
   - Check metadata for automated vs manual approvals

## Future Improvements

1. **Web UI for Review Queue**
   - Dashboard for PENDING_REVIEW rules
   - One-click approve/reject for T0/T1
   - Bulk operations

2. **Automated Scheduler**
   - Cron job for auto-approval
   - Scheduled batch review of DRAFT rules
   - Automated release of APPROVED rules

3. **Quality Metrics**
   - Track approval/rejection rates
   - Monitor confidence thresholds
   - Alert on anomalies

4. **Policy Tuning**
   - Review auto-approval thresholds
   - Adjust grace period based on volume
   - Consider confidence score adjustments

## References

- Issue #162: [AUDIT] RTL: Low Published Rule Count
- `/src/lib/regulatory-truth/agents/reviewer.ts` - Reviewer agent
- `/src/lib/regulatory-truth/services/rule-status-service.ts` - Status transitions
- `/src/lib/regulatory-truth/agents/releaser.ts` - Release creation
