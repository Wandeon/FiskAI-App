# ArtemiPC Worker Skill

Use this skill to offload heavy operations (build, test, lint, typecheck, playwright) to ArtemiPC, a high-powered worker machine with 32 cores and 31GB RAM.

## When to Use

- **Always** for builds (`npm run build`) - VPS-01 OOMs
- **Always** for full test suite (`npm test`) - faster on ArtemiPC
- **Always** for Playwright/E2E tests - needs browser automation
- **Recommended** for typecheck on large changes
- **Recommended** for lint on large PRs

## Worker Details

| Property   | Value                                 |
| ---------- | ------------------------------------- |
| Host       | ArtemiPC (100.89.2.111 via Tailscale) |
| SSH Alias  | `artemipc`                            |
| User       | wandeon                               |
| CPU        | AMD Ryzen 9 5950X (32 threads)        |
| RAM        | 31GB (29GB available)                 |
| Disk       | 878GB free                            |
| Node.js    | v22.20.0                              |
| Playwright | 1.57.0                                |
| Repo Path  | `~/work/fiskai/repo`                  |
| Scripts    | `~/work/fiskai/scripts/`              |

## Performance Comparison

| Operation  | VPS-01      | ArtemiPC         |
| ---------- | ----------- | ---------------- |
| TypeCheck  | timeout/OOM | 16s              |
| Lint       | timeout     | 3s               |
| Unit Tests | timeout     | 10s (2260 tests) |
| Build      | OOM killed  | 58s compile      |
| Tailwind   | 7s          | 2s               |

## How to Use

### Quick Commands

```bash
# Run lint on current branch
ssh artemipc '~/work/fiskai/scripts/run_job.sh lint-001 main lint'

# Run typecheck on a feature branch
ssh artemipc '~/work/fiskai/scripts/run_job.sh tsc-001 fix/design typecheck'

# Run unit tests
ssh artemipc '~/work/fiskai/scripts/run_job.sh test-001 main test'

# Run build (requires env file)
ssh artemipc '~/work/fiskai/scripts/run_job.sh build-001 main build --env-file ~/.env.worker'

# Run playwright tests
ssh artemipc '~/work/fiskai/scripts/run_job.sh e2e-001 main playwright'

# Run custom command
ssh artemipc '~/work/fiskai/scripts/run_job.sh custom-001 main custom "npm run test:unit"'

# Probe system status
ssh artemipc '~/work/fiskai/scripts/run_job.sh probe-001 main probe'
```

### Job Types

| Type         | Command            | Output                |
| ------------ | ------------------ | --------------------- |
| `lint`       | `npm run lint`     | lint-output.txt       |
| `typecheck`  | `npx tsc --noEmit` | tsc-output.txt        |
| `build`      | `npm run build`    | build-output.txt      |
| `test`       | `npm test`         | test-output.txt       |
| `playwright` | Playwright tests   | playwright-output.txt |
| `custom`     | Any command        | custom-output.txt     |
| `probe`      | System info        | probe.json            |

### Getting Results

Jobs output JSON to stdout. Parse with jq:

```bash
# Run job and capture result
RESULT=$(ssh artemipc '~/work/fiskai/scripts/run_job.sh lint-001 main lint')
echo "$RESULT" | jq .

# Check status
echo "$RESULT" | jq -r .status

# Get duration
echo "$RESULT" | jq -r .duration_seconds
```

### Retrieving Artifacts

```bash
# List artifacts for a job
ssh artemipc 'ls ~/work/fiskai/artifacts/lint-001/'

# Get specific artifact
ssh artemipc 'cat ~/work/fiskai/artifacts/lint-001/lint-output.txt'

# Download artifact tarball
scp artemipc:~/work/fiskai/artifacts/lint-001.tar.gz ./
```

## Workflow for Claude Code

When running heavy operations:

1. **Determine job type** based on the operation needed
2. **Generate unique job ID** (e.g., `lint-$(date +%s)`)
3. **Specify correct branch** (usually current working branch)
4. **Run job via SSH**
5. **Parse JSON output** for status
6. **Retrieve relevant artifacts** if needed
7. **Report results** to user

### Example: Running Tests on a Feature Branch

```bash
# 1. Run the job
JOB_ID="test-$(date +%s)"
BRANCH="fix/design"
RESULT=$(ssh artemipc "~/work/fiskai/scripts/run_job.sh $JOB_ID $BRANCH test")

# 2. Check status
STATUS=$(echo "$RESULT" | jq -r .status)
DURATION=$(echo "$RESULT" | jq -r .duration_seconds)

if [ "$STATUS" = "success" ]; then
  echo "Tests passed in ${DURATION}s"
else
  # Get failure details
  ssh artemipc "cat ~/work/fiskai/artifacts/$JOB_ID/test-output.txt" | tail -50
fi
```

## Environment Variables for Build

The build job requires env vars. Create `~/.env.worker` on ArtemiPC:

```bash
# ~/.env.worker on ArtemiPC
DATABASE_URL="postgresql://..."
REGULATORY_DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
# etc.
```

Then run build with:

```bash
ssh artemipc '~/work/fiskai/scripts/run_job.sh build-001 main build --env-file ~/.env.worker'
```

## Troubleshooting

### SSH Connection Issues

```bash
# Test connection
ssh artemipc 'echo "Connected as $(whoami)"'

# Check Tailscale status
tailscale status | grep artemipc
```

### Job Stuck/Timeout

```bash
# Check if job is running
ssh artemipc 'ps aux | grep run_job'

# Kill stuck job
ssh artemipc 'pkill -f "run_job.sh"'
```

### Branch Not Found

```bash
# Fetch all branches first
ssh artemipc 'cd ~/work/fiskai/repo && git fetch --all'
```

## Files on ArtemiPC

```
~/work/fiskai/
├── repo/              # Git repository
├── scripts/           # Job runner scripts
│   ├── run_job.sh     # Main entry point
│   ├── sync_repo.sh   # Git sync
│   ├── install_deps.sh
│   ├── run_lint.sh
│   ├── run_typecheck.sh
│   ├── run_build.sh
│   ├── run_tests.sh
│   ├── run_playwright.sh
│   └── collect_artifacts.sh
├── artifacts/         # Job outputs
│   └── {job-id}/
│       ├── summary.json
│       ├── versions.txt
│       ├── metrics.txt
│       └── {output}.txt
└── logs/              # Full job logs
    └── job-{id}-{timestamp}.log
```
