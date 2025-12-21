# Marketing Content Audit Runbook

Purpose: Run the marketing content audit pipeline and regenerate the single master audit file.

## Scope
- Marketing pages only (auth pages excluded).
- Repos: FiskAI and FiskAI-next.
- Output file: docs/MARKETING_CONTENT_AUDIT.md

## Prerequisites
- Node dependencies installed in FiskAI.
- Access to both repos on disk.

## Commands
1) Seed registry and generate the report:

```bash
npm run audit:marketing
```

2) Run dynamic checks (links + contrast + tools) against production:

```bash
RUN_PLAYWRIGHT=true npm run audit:marketing
```

If Playwright browsers are missing, run:

```bash
npx playwright install
```

## Environment Variables
- MARKETING_AUDIT_TARGET_URL: Base URL for Playwright (default: https://fiskai.hr)
- FISKAI_ROOT: Override FiskAI repo path
- FISKAI_NEXT_ROOT: Override FiskAI-next repo path
- MARKETING_AUDIT_ROOT: Override marketing root (default: src/app/(marketing))

## Outputs
- docs/marketing-content-registry.yml
- docs/MARKETING_CONTENT_AUDIT.md
- audit/marketing-playwright-results.json (when RUN_PLAYWRIGHT=true)

## Notes
- The Playwright step is optional and may fail if production has broken links or contrast issues.
- The report includes static validation (hardcoded values, language, design tokens) and static link checks.
- Dynamic content from DB-backed routes (news) is labeled as db and requires runtime validation.
