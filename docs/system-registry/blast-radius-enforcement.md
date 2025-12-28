# Blast Radius Progressive Enforcement

This document describes the progressive rollout strategy for blast radius enforcement in the FiskAI CI pipeline.

## Overview

The blast radius analysis computes the impact of PR changes on system components. It assigns a score (LOW, MEDIUM, HIGH, CRITICAL) based on:

- Direct impacts: Components directly affected by changed files
- Transitive impacts: Components indirectly affected through dependencies
- Critical path impacts: Whether changes affect critical business flows (e.g., fiscalization, auth)

## Enforcement Modes

### WARN Mode (Default)

In warn mode, the blast radius check:

- Computes the full blast radius analysis
- Posts a PR comment with impact details
- Always exits with code 0 (success)
- Does NOT block PRs from merging

This mode is ideal for:

- Initial rollout to gather data
- Training teams on impact awareness
- Building confidence in the scoring system

### FAIL Mode

In fail mode, the blast radius check:

- Computes the full blast radius analysis
- Posts a PR comment with impact details
- Exits with code 1 for HIGH score PRs
- Exits with code 2 for CRITICAL score PRs
- BLOCKS PRs with HIGH or CRITICAL scores from merging

This mode enforces:

- Required review for high-impact changes
- Mandatory approval for critical path modifications
- Protection of core system components

## Configuration

### Environment Variable

The enforcement mode is controlled by the `BLAST_RADIUS_ENFORCEMENT_MODE` environment variable:

```bash
# Warn mode (default)
BLAST_RADIUS_ENFORCEMENT_MODE=warn

# Fail mode (blocks HIGH/CRITICAL PRs)
BLAST_RADIUS_ENFORCEMENT_MODE=fail
```

### CLI Override

The CLI argument `--enforcement-mode` takes precedence over the environment variable:

```bash
# Uses env var (or defaults to 'warn')
npx tsx blast-radius.ts --base-sha abc --head-sha def

# Explicitly set to fail mode, overriding env var
npx tsx blast-radius.ts --base-sha abc --head-sha def --enforcement-mode fail
```

### CI Configuration

In `.github/workflows/registry-check.yml`, the enforcement mode is set via environment variable:

```yaml
- name: Compute Blast Radius
  env:
    BLAST_RADIUS_ENFORCEMENT_MODE: warn  # Change to 'fail' when ready
  run: |
    npx tsx src/lib/system-registry/scripts/blast-radius.ts \
      --base-sha "$BASE_SHA" \
      --head-sha "$HEAD_SHA" \
      --output-format pr-comment \
      --write-comment
```

## Rollout Timeline

### Sprint 0-1: WARN Mode

**Goal:** Build confidence and gather data

- Enable blast radius analysis on all PRs
- Review PR comments to validate scoring accuracy
- Adjust component declarations and criticality levels as needed
- Document patterns that should/shouldn't trigger HIGH/CRITICAL scores

**Actions:**

1. Keep `BLAST_RADIUS_ENFORCEMENT_MODE=warn` in CI
2. Review blast radius comments on PRs
3. File issues for scoring improvements
4. Update component declarations if needed

### Sprint 2+: FAIL Mode for CRITICAL

**Goal:** Enforce review for critical changes

- Change env var to `BLAST_RADIUS_ENFORCEMENT_MODE=fail`
- CRITICAL PRs will be blocked until manually approved
- HIGH PRs will be blocked (consider if this is desired)

**Actions:**

1. Update CI: `BLAST_RADIUS_ENFORCEMENT_MODE=fail`
2. Communicate to team about enforcement
3. Document exception/override process
4. Monitor for false positives

## Exit Codes

| Score    | WARN Mode | FAIL Mode |
|----------|-----------|-----------|
| LOW      | 0         | 0         |
| MEDIUM   | 0         | 0         |
| HIGH     | 0         | 1         |
| CRITICAL | 0         | 2         |

## Handling Blocked PRs

When a PR is blocked due to HIGH/CRITICAL score in fail mode:

1. **Review the blast radius comment** - Understand which components are affected
2. **Assess if the score is accurate** - Sometimes the analysis may over-estimate impact
3. **Options for proceeding:**
   - Add tests or documentation to reduce risk
   - Break the PR into smaller, lower-impact changes
   - Request review from component owners listed in the comment
   - If false positive, file an issue to improve declarations

## Customizing Behavior

### Per-Environment Configuration

Different environments can have different enforcement levels:

```yaml
# Production CI - strict
BLAST_RADIUS_ENFORCEMENT_MODE: fail

# Staging CI - lenient
BLAST_RADIUS_ENFORCEMENT_MODE: warn
```

### Future Enhancements

Potential future improvements:

- Per-score enforcement (e.g., fail only CRITICAL, warn for HIGH)
- Automatic owner approval requirements
- Integration with GitHub branch protection rules
- Trend analysis across PRs

## Related Documentation

- [Blast Radius Analysis](./README.md) - Overview of the blast radius system
- [Component Declarations](../../src/lib/system-registry/declarations.ts) - Component definitions
- [Critical Paths](../../src/lib/system-registry/declarations.ts) - Critical path definitions
