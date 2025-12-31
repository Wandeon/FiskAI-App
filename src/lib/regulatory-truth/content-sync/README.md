# Content Sync System

This directory contains the content synchronization system that keeps MDX guide content in sync with regulatory rule changes from the RTL (Regulatory Truth Layer).

## Overview

When a regulatory rule is published by the Releaser agent, a **ContentSyncEvent** is emitted. The content-sync worker processes these events by:

1. Looking up the concept mapping in `CONCEPT_REGISTRY`
2. Generating MDX patches for affected files
3. Creating a GitHub PR with the updated content

## Concept Registry

The `concept-registry.ts` file maps regulatory concepts to MDX content files. This mapping is critical for content sync to work correctly.

### Structure

```typescript
{
  conceptId: "pdv-threshold",
  description: "PDV registration threshold (annual revenue limit for mandatory VAT registration)",
  mdxPaths: [
    "vodici/pausalni-obrt.mdx",
    "vodici/freelancer.mdx",
    "rjecnik/pdv.mdx",
  ],
  toolIds: ["pausalni-calculator", "vat-threshold-checker"],
}
```

### Fields

- **conceptId**: Unique identifier matching `RegulatoryRule.conceptId` (required)
- **description**: Human-readable explanation of what this concept represents (required)
- **mdxPaths**: Array of MDX file paths relative to `content/` directory (required)
- **toolIds**: Optional array of calculator/tool IDs that use this concept

## Preventing Dead-Letter Events

**Problem**: If a `RegulatoryRule.conceptId` is NOT in `CONCEPT_REGISTRY`, content sync events will throw `UnmappedConceptError` and be dead-lettered, meaning content won't be updated.

**Solution**: Use the provided tooling to identify and fix gaps.

### Tooling

#### 1. List Unmapped Concepts

Queries the database to find all `conceptId` values that are missing from the registry:

```bash
npx tsx scripts/list-unmapped-concepts.ts
```

Output shows:

- Which concepts are unmapped
- How many rules are affected
- Sample rule titles and dates
- Coverage percentage

#### 2. Generate Concept Stubs

Creates TypeScript code stubs for new concept mappings:

```bash
npx tsx scripts/generate-concept-stubs.ts pdv-new-threshold capital-gains-tax
```

Copy the output and add it to `concept-registry.ts`, then fill in:

- Actual MDX paths that reference this concept
- Accurate description
- Tool IDs (if applicable)

#### 3. Validate Registry

Checks that the registry is valid (no duplicates, files exist, etc.):

```bash
npx tsx scripts/validate-concept-registry.ts
```

This runs automatically in CI and pre-commit hooks.

## Workflow for Adding New Concepts

When you create a new `RegulatoryRule` with a new `conceptId`:

1. **Run the unmapped concepts script**:

   ```bash
   npx tsx scripts/list-unmapped-concepts.ts
   ```

2. **Generate stub code**:

   ```bash
   npx tsx scripts/generate-concept-stubs.ts <conceptId>
   ```

3. **Add mapping to `concept-registry.ts`**:
   - Copy the generated stub
   - Fill in MDX paths that reference this concept
   - Write an accurate description
   - Add tool IDs if applicable

4. **Validate**:

   ```bash
   npx tsx scripts/validate-concept-registry.ts
   ```

5. **Test** (if possible):
   - Release a rule with this conceptId
   - Check that content sync event is processed (not dead-lettered)

## Monitoring

The Releaser agent now includes validation (issue #266):

- **Warning logged** when a rule's `conceptId` is not in `CONCEPT_REGISTRY`
- Helps catch issues before they cause dead-letter events
- Check logs: `docker logs fiskai-worker-content-sync`

### Dashboard Recommendations (Future)

From issue #266, recommended additions:

1. **Unmapped Concepts Dashboard**:
   - Show all rules with unmapped conceptIds
   - Alert when DEAD_LETTERED events accumulate

2. **Content Sync Metrics**:
   - Success rate
   - Dead-letter count by reason
   - Processing latency

## Files in this Directory

- `concept-registry.ts` - Core mapping registry
- `errors.ts` - Content sync error types (includes `UnmappedConceptError`)
- `git-adapter.ts` - Git operations for creating PRs
- `mdx-patcher.ts` - MDX file patching logic
- `event-schema.ts` - ContentSyncEvent type definitions
- `index.ts` - Public exports

## Related Files

- `src/lib/regulatory-truth/agents/releaser.ts` - Emits content sync events
- `src/lib/regulatory-truth/workers/content-sync.worker.ts` - Processes events
- `scripts/list-unmapped-concepts.ts` - Detection tool
- `scripts/generate-concept-stubs.ts` - Code generation tool
- `scripts/validate-concept-registry.ts` - Validation tool

## References

- Issue #266: Content Sync: Missing Concept Mappings for Many RTL Concepts
- Architecture: `/docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md`
