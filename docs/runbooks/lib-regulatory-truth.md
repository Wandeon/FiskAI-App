# Regulatory Truth Layer Library Failure Runbook

## Component
- **ID:** lib-regulatory-truth
- **Type:** LIB
- **Owner:** team:ai

## Health Check
- **Endpoint:** /api/health/regulatory-truth
- **Expected:** 200 OK with RTL status

## Common Issues

### Issue 1: Rule Query Failures
**Symptoms:** AI Assistant not returning regulatory answers, query errors
**Resolution:**
1. Check PostgreSQL connectivity
2. Verify rule table has published data
3. Review query parameters and filtering
4. Check for index issues on rule tables

### Issue 2: Evidence Lookup Failures
**Symptoms:** Rule citations not resolving, evidence links broken
**Resolution:**
1. Check evidence table integrity
2. Verify source pointers are valid
3. Review evidence hash consistency
4. Check for orphaned pointers

### Issue 3: Pipeline Integration Issues
**Symptoms:** New rules not flowing from workers to API
**Resolution:**
1. Check worker-releaser status
2. Verify publication status of rules
3. Review cache invalidation
4. Check for version conflicts

### Issue 4: Ollama LLM Connection Issues
**Symptoms:** Extraction and composition failing, LLM errors
**Resolution:**
1. Check Ollama service status
2. Verify model availability
3. Review GPU/memory allocation
4. Check network connectivity to Ollama

## Escalation
- Primary: team:ai
- Backup: #ops-critical

## References
- Architecture: docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md
- Code: src/lib/regulatory-truth/
- Dependencies: store-postgresql, store-redis, integration-ollama
- Critical Path: path-rtl-pipeline
- Subdirectories: 22
