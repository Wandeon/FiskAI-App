# AI Agent Guidelines for FiskAI

## Development Rules

### NEVER DO:

- **Rebuild Docker images for testing** - takes 10-15 minutes, use `npx tsx` instead
- **Run manual scripts when autonomous system should handle it** - fix the system, don't workaround
- **Seed/fixture data** - always work with production database
- **Hardcode values** - all data must come from database queries

### ALWAYS DO:

- **Test changes locally first** with `npx tsx scripts/...`
- **Fix root causes** - if automation is broken, fix it, don't do manual work
- **Check worker logs** before assuming code is the problem: `docker logs fiskai-worker-* --tail 50`
- **Verify LLM configuration** - check OLLAMA_ENDPOINT, OLLAMA_MODEL, OLLAMA_API_KEY

## Testing Workers Locally

```bash
# Run extractor on specific evidence
npx tsx src/lib/regulatory-truth/scripts/run-extractor.ts <evidenceId>

# Run sentinel discovery + fetch
npx tsx src/lib/regulatory-truth/scripts/run-sentinel.ts --fetch

# Run composer on source pointers
npx tsx src/lib/regulatory-truth/scripts/run-composer.ts <pointerId>

# Check queue status
npx tsx scripts/queue-status.ts
```

## Common Issues

### Extractor failing with "404 Not Found"

- Check `OLLAMA_ENDPOINT` in `.env` - should be `https://openrouter.ai/api/v1` for OpenRouter
- Verify API key format matches provider (OpenRouter keys have format: `xxx.yyy`)

### Evidence not being extracted automatically

- Check sentinel worker is queuing extract jobs
- Verify no time window filter blocking old evidence
- Check Redis memory: `docker exec fiskai-redis redis-cli INFO memory`

### Workers not processing jobs

- Check Redis isn't OOM: `docker exec fiskai-redis redis-cli INFO memory`
- Check queue sizes: `docker exec fiskai-redis redis-cli LLEN bull:extract:wait`
- Verify workers are running: `docker ps | grep worker`

## LLM Configuration

The system uses hosted Ollama at ollama.com:

- `OLLAMA_ENDPOINT=https://ollama.com/api`
- `OLLAMA_MODEL=gemini-3-flash-preview`
- `OLLAMA_API_KEY=<ollama-api-key>`

Runner code at `src/lib/regulatory-truth/agents/runner.ts` calls `/chat` endpoint (Ollama format).

## Worktree Usage

When working in a git worktree (`.worktrees/`), remember:

- Docker compose runs from main repo, not worktree
- Copy changed files to main repo before rebuilding Docker
- Or run tests locally with `npx tsx` from worktree directory
