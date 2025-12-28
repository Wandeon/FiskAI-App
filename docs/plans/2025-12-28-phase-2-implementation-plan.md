# Phase 2: Runtime Reality - Implementation Plan

> Detailed implementation plan for operational metadata capture.
>
> **Design:** [2025-12-28-system-registry-phases-2-4-design.md](./2025-12-28-system-registry-phases-2-4-design.md)
> **Status:** Ready for implementation
> **Estimated Sprints:** 0.5 (can be done alongside Phase 4)

---

## Overview

Phase 2 is lightweight - it adds optional metadata fields and validation rules. No new infrastructure, just schema extensions.

---

## Prerequisites

- [ ] Phase 1 complete
- [ ] Schema types stable

---

## Task 1: Extend Schema with Operational Metadata

**File:** `src/lib/system-registry/schema.ts`

**Add to DeclaredComponent interface:**
```typescript
interface DeclaredComponent {
  // Existing fields...

  // NEW: Operational metadata
  healthCheck?: {
    endpoint?: string;      // HTTP path, e.g., "/health"
    command?: string;       // Shell command, e.g., "pg_isready"
    interval?: string;      // Check interval, e.g., "30s"
  };

  slo?: {
    availability?: string;  // e.g., "99.9%"
    latencyP50?: string;    // e.g., "100ms"
    latencyP99?: string;    // e.g., "500ms"
    errorBudget?: string;   // e.g., "0.1%"
  };

  alertChannel?: string;    // e.g., "#ops-critical"
  runbook?: string;         // e.g., "docs/runbooks/auth.md"
}
```

**Validation:**
- If healthCheck provided, at least endpoint or command required
- If slo provided, at least one metric required
- alertChannel must be non-empty string if provided
- runbook must be non-empty string if provided

**Tests:**
- Valid healthCheck with endpoint
- Valid healthCheck with command
- Invalid: empty healthCheck object
- Valid slo with single metric
- Invalid: empty slo object

**Acceptance criteria:**
- Schema compiles
- Validation rejects invalid shapes
- Existing declarations still work

---

## Task 2: Add Validation Rules to Drift Computation

**File:** `src/lib/system-registry/compute-drift.ts`

**New rules:**

1. **critical-needs-health** (WARN)
   - Condition: criticality === 'CRITICAL' && !healthCheck
   - Message: "CRITICAL component should define healthCheck"

2. **service-needs-slo** (WARN)
   - Condition: type in ['WORKER', 'INTEGRATION'] && !slo
   - Message: "Service component should define SLO targets"

3. **slo-needs-alert** (FAIL)
   - Condition: slo defined && !alertChannel
   - Message: "Component with SLO must have alertChannel"

4. **runbook-exists** (WARN)
   - Condition: runbook defined && !existsSync(runbook)
   - Message: "Runbook path does not exist"

**Tests:**
- CRITICAL without healthCheck gets warning
- WORKER without slo gets warning
- Component with slo but no alertChannel fails
- Invalid runbook path gets warning
- No global rule disable (suppression only via governed exclusions)

**Acceptance criteria:**
- Rules fire correctly
- Warnings vs failures correct
- Suppression requires explicit, expiring governance exclusions

---

## Task 3: Update CRITICAL Component Declarations

**File:** `src/lib/system-registry/declarations.ts`

**Add metadata to all CRITICAL components:**

Example for lib-auth:
```typescript
{
  componentId: 'lib-auth',
  type: 'LIB',
  name: 'Auth Library',
  owner: 'team:security',
  criticality: 'CRITICAL',
  codeRef: 'src/lib/auth/',
  // NEW
  healthCheck: {
    endpoint: '/api/health/auth',
    interval: '30s'
  },
  alertChannel: '#ops-critical',
  runbook: 'docs/runbooks/auth-failure.md'
}
```

**Components to update:**
- All with criticality === 'CRITICAL'
- Estimate: ~15-20 components

**Acceptance criteria:**
- All CRITICAL components have healthCheck
- All have alertChannel
- Runbooks exist (or are created as stubs)

---

## Task 4: Create Runbook Stubs

**Directory:** `docs/runbooks/`

**Create stub for each CRITICAL component:**

```markdown
# {Component Name} Failure Runbook

## Component
- **ID:** {component-id}
- **Type:** {type}
- **Owner:** {owner}

## Health Check
- **Endpoint:** {endpoint}
- **Expected:** 200 OK

## Common Issues

### Issue 1: {Description}
**Symptoms:** {what you see}
**Resolution:** {steps to fix}

### Issue 2: ...

## Escalation
- Primary: {owner}
- Backup: #ops-critical

## References
- {links to docs, dashboards, etc.}
```

**Acceptance criteria:**
- Runbook exists for each CRITICAL component
- Follows consistent template
- Linked from declarations

---

## Task 5: Document Operational Metadata Patterns

**File:** `src/lib/system-registry/governance.ts` (comments)

**Add guidance:**
```typescript
/**
 * OPERATIONAL METADATA PATTERNS
 *
 * healthCheck:
 *   - For HTTP services: use endpoint (relative path)
 *   - For CLI/workers: use command (shell command)
 *   - interval defaults to "30s" if omitted
 *
 * slo:
 *   - availability: target uptime (e.g., "99.9%")
 *   - latencyP99: 99th percentile latency target
 *   - errorBudget: monthly error budget
 *
 * alertChannel:
 *   - Slack channels: "#channel-name"
 *   - PagerDuty: "pagerduty:service-name"
 *
 * runbook:
 *   - Path relative to project root
 *   - Must exist or validation warns
 */
```

**Acceptance criteria:**
- Patterns documented in code
- Examples provided
- Discoverable via code navigation

---

## Definition of Done

- [ ] Schema extended with new fields
- [ ] 4 validation rules implemented
- [ ] All CRITICAL components have metadata
- [ ] Runbook stubs created
- [ ] Patterns documented
- [ ] Registry check still passes
