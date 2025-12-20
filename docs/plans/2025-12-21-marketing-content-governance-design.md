# Marketing Content Governance Design

Date: 2025-12-21
Scope: Marketing pages only for FiskAI and FiskAI-next. Exclude app and auth.
Target: https://fiskai.hr
Output: Single master audit file in `FiskAI/docs/`.

## Goals

- Document every marketing page, link, and button in a single master audit file.
- Validate that every link/button works on production and resolves without 404.
- Ensure all financial values use canonical data sources (fiscal-data) and are not hardcoded.
- Enforce natural Croatian language, correct formatting, and no stale year references.
- Enforce design tokens, contrast, and accessibility (no light-on-light or dark-on-dark).
- Verify tools and calculators compute outputs from fiscal-data.

## Architecture

1. Route Inventory Builder
   - Enumerate all marketing routes from both repos.
   - Map routes to source files for traceability.

2. Content Registry
   - Single structured registry of all marketing routes.
   - Records CTAs, expected destinations, data dependencies, and formatting rules.

3. Static Validators
   - Hardcoded values, outdated years, non-token colors, English leakage.
   - Internal link validation against known route inventory.

4. Dynamic Validators (Playwright)
   - Crawl every marketing route on production with low concurrency.
   - Click every CTA and link; verify navigation and HTTP status.
   - Run axe-core and contrast checks; capture evidence screenshots.

5. Tool Validators
   - Deterministic inputs for calculators.
   - Outputs must match fiscal-data derived values and Croatian formatting.

6. Single Master Audit File
   - One authoritative markdown file with evidence and remediation backlog.

## Canonical Data Source

- Use `src/lib/fiscal-data` as the canonical source.
- If both repos differ, FiskAI-next vs FiskAI values are compared; the production repo is authoritative.
- Mismatches are reported as violations and tracked in the audit.

## Output Structure (Master Audit)

- Scope and environment
- Route inventory
- CTA/link map with status
- Data source compliance
- Croatian language quality
- Design and accessibility
- Tools validation
- 404 and broken links
- Remediation backlog and checklist

## Non-goals

- App and auth pages
- Admin/staff dashboard
- Backend API documentation
