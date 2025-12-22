# Regulatory Truth Layer - Final Completion Design

**Date:** 2025-12-22
**Goal:** Complete all remaining gaps and prepare for external audit

---

## Gap Analysis

### What Works

- 6-agent pipeline (Sentinel → Extractor → Composer → Reviewer → Arbiter → Releaser)
- Database schema with all models
- Admin Dashboard UI (4 pages)
- Rules Search/Evaluate APIs
- Audit logging system (RegulatoryAuditLog)
- Conflict detection and resolution wiring
- 33 Discovery Endpoints seeded
- Overnight runner with all phases

### Gaps Identified

| Gap                               | Impact                                                  | Location         |
| --------------------------------- | ------------------------------------------------------- | ---------------- |
| Knowledge Graph not populated     | Concept/GraphEdge models exist but no code creates them | Composer agent   |
| Stale rules calculation hardcoded | `rulesStale: 0` instead of actual count                 | `metrics.ts:124` |
| Alert notification TODO           | No alerts on pipeline failure                           | `cron.ts:31`     |
| Pipeline never run end-to-end     | 0 DiscoveredItems, 0 Releases                           | -                |

---

## Design Decisions

### Knowledge Graph Population

**When to create Concepts:**

- Composer creates rules with `conceptSlug`
- Each unique conceptSlug should have a corresponding Concept record
- Use upsert to avoid duplicates

**When to create GraphEdges:**

- When `supersedes` field is set → create AMENDS edge
- Future: INTERPRETS, DEPENDS_ON from AI extraction

### TODO Fixes

1. **Stale Rules:** Query rules where effectiveUntil < now()
2. **Alert Email:** Send via Resend on pipeline failure

### End-to-End Test

Test on Porezna uprava endpoint to verify full flow:
Discovery → Evidence → SourcePointer → Rule → Concept → Release

---

## Success Criteria

- [ ] Zero TODOs in regulatory-truth code
- [ ] Knowledge Graph populated (Concepts, GraphEdges)
- [ ] All 11 APIs functional and tested
- [ ] Complete data flow from Discovery → Release
- [ ] Audit trail with entries
- [ ] No hardcoded placeholder values
