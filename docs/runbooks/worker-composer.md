# RTL Composer Worker Failure Runbook

## Component
- **ID:** worker-composer
- **Type:** WORKER
- **Owner:** team:ai

## Health Check
- **Command:** pgrep -f composer.worker
- **Expected:** Process running

## Common Issues

### Issue 1: Rule Composition Failures
**Symptoms:** Extracted facts not being composed into rules, composition errors
**Resolution:**
1. Check queue-compose status: `npx tsx scripts/queue-status.ts`
2. Verify fact aggregation logic
3. Review rule schema validation
4. Check for conflicting facts from different sources

### Issue 2: Rule Deduplication Issues
**Symptoms:** Duplicate rules being created, inconsistent rule versions
**Resolution:**
1. Review rule hash generation
2. Check for race conditions in rule creation
3. Verify version increment logic
4. Review fact pointer linkage

### Issue 3: Memory Issues During Aggregation
**Symptoms:** OOM errors when processing large fact sets
**Resolution:**
1. Check container memory limits
2. Implement streaming/batching for large aggregations
3. Review fact loading queries for efficiency
4. Consider pagination for fact retrieval

## Escalation
- Primary: team:ai
- Backup: #ops-critical

## References
- Architecture: docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md
- Code: src/lib/regulatory-truth/workers/composer.worker.ts
- Dependencies: store-redis, queue-compose
- Critical Path: path-rtl-pipeline
