# RTL Extractor Worker Failure Runbook

## Component
- **ID:** worker-extractor
- **Type:** WORKER
- **Owner:** team:ai

## Health Check
- **Command:** pgrep -f extractor.worker
- **Expected:** Process running

## Common Issues

### Issue 1: LLM Connection Failures
**Symptoms:** Extraction jobs failing, Ollama connection errors
**Resolution:**
1. Check Ollama service status: `docker ps | grep ollama`
2. Verify Ollama endpoint is accessible
3. Review model availability: `ollama list`
4. Check GPU/memory allocation for LLM

### Issue 2: Low Confidence Extractions
**Symptoms:** Many extractions below confidence threshold, high reject rate
**Resolution:**
1. Review source document quality
2. Check prompt template effectiveness
3. Adjust confidence thresholds if appropriate
4. Review for model drift or version changes

### Issue 3: Extraction Timeouts
**Symptoms:** Jobs timing out during LLM inference
**Resolution:**
1. Check Ollama response times
2. Review document length/complexity
3. Adjust timeout configuration
4. Consider chunking large documents

## Escalation
- Primary: team:ai
- Backup: #ops-critical

## References
- Architecture: docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md
- Code: src/lib/regulatory-truth/workers/extractor.worker.ts
- Dependencies: store-redis, queue-extract, integration-ollama
- Critical Path: path-rtl-pipeline
- Metadata: 2 replicas, concurrency 2
