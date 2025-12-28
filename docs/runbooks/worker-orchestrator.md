# RTL Orchestrator Worker Failure Runbook

## Component
- **ID:** worker-orchestrator
- **Type:** WORKER
- **Owner:** team:ai

## Health Check
- **Command:** pgrep -f orchestrator.worker
- **Expected:** Process running

## Common Issues

### Issue 1: Worker Not Starting
**Symptoms:** Orchestrator process not found, no activity in logs
**Resolution:**
1. Check Docker container status: `docker ps | grep worker-orchestrator`
2. Review container logs: `docker logs fiskai-worker-orchestrator --tail 100`
3. Verify Redis connectivity for queue access
4. Check for TypeScript compilation errors

### Issue 2: Queue Processing Stalled
**Symptoms:** Jobs accumulating in queues, no progress
**Resolution:**
1. Check Redis connection: `redis-cli ping`
2. Review BullMQ queue status: `npx tsx scripts/queue-status.ts`
3. Check for deadlocked jobs in processing state
4. Restart worker if needed: `docker restart fiskai-worker-orchestrator`

### Issue 3: Memory/CPU Exhaustion
**Symptoms:** Worker OOM killed, high CPU usage, slow processing
**Resolution:**
1. Check container resource limits in docker-compose.workers.yml
2. Review memory usage: `docker stats fiskai-worker-orchestrator`
3. Check for memory leaks in job processing
4. Increase container memory limits if needed

## Escalation
- Primary: team:ai
- Backup: #ops-critical

## References
- Architecture: docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md
- Code: src/lib/regulatory-truth/workers/orchestrator.worker.ts
- Dependencies: store-redis, lib-regulatory-truth
- Critical Path: path-rtl-pipeline
