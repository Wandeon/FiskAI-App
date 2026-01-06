# Design System Cleanup - Progress & Exit Criteria

**Updated:** 2026-01-06
**Branch:** fix/design-cleanup
**Status:** Hardening Complete - Quarantine Established

---

## Current State

### Quarantine Boundary

| Metric | Value | Status |
|--------|-------|--------|
| Violations outside quarantine | 0 | ENFORCED |
| Violations inside quarantine | 103 | CAPPED |
| Quarantine cap | 103 | NO GROWTH ALLOWED |

### Quarantine Folders

All raw Tailwind palette usage (`text-*-N`, `bg-*-N`, `border-*-N`) is confined to:

```
src/components/news/           # Dark-first news UI (14 files)
src/components/assistant-v2/   # Cockpit/HUD aesthetic (6 files)
src/components/marketing/      # Hero/landing gradients (9 files)
src/components/knowledge-hub/  # Category color-coding (tools, comparisons)
src/components/ui/command-palette/  # Entry type colors
src/app/(marketing)/           # Marketing routes
```

### Enforcement Mechanisms

1. **ESLint** - `fisk-design-system/no-hardcoded-colors`
   - `error` for all of `src/**` by default
   - `warn` only for quarantine folders

2. **CI Script** - `scripts/check-raw-palette.mjs`
   - Fails if ANY violations exist outside quarantine
   - Fails if quarantine violations exceed cap (103)
   - Run in CI: `node scripts/check-raw-palette.mjs`

---

## Exit Criteria

### Level 1: Quarantine Stable (CURRENT)

- [x] All violations contained in defined folders
- [x] ESLint enforces `error` outside quarantine
- [x] CI script prevents spread
- [x] Cap set to baseline (103)

### Level 2: Quarantine Shrinking

- [ ] Reduce quarantine violations to < 80
- [ ] Each reduction lowers the cap
- [ ] Document migration patterns in ADR

### Level 3: Quarantine Eliminated

- [ ] Quarantine violations at 0
- [ ] Remove quarantine ESLint override
- [ ] Remove CI script quarantine logic
- [ ] All components use semantic tokens

---

## Migration Path for Quarantined Components

### Option A: Semantic Token Migration

For components that can use existing tokens:

```tsx
// Before (quarantined)
className="text-cyan-300 hover:text-cyan-100"

// After (token)
className="text-accent hover:text-accent-light"
```

### Option B: New Semantic Tokens

For components needing new categories:

1. Define tokens in `src/design-system/css/variables.css`
2. Add to Tailwind config in `tailwind.config.ts`
3. Migrate component to use new tokens
4. Decrement quarantine cap

### Option C: Justified Quarantine

For components that MUST use raw palette:

1. Add `@design-override` comment with justification
2. Document in this file
3. Component remains in quarantine

---

## Legacy CSS Variables

**Status:** MAPPED (working via `globals.css`)

| Variable | Mapped To | Count |
|----------|-----------|-------|
| `var(--background)` | `var(--surface-base)` | 6 |
| `var(--foreground)` | `var(--text-primary)` | 243 |
| `var(--surface)` | `var(--surface-0)` | 138 |
| `var(--border)` | `var(--border-default)` | 267 |

**Exit Criteria:**
- Migrate during feature work, not dedicated sweep
- Remove legacy vars when count reaches 0
- No urgency - current implementation works correctly

---

## Brand Color Layer

**Status:** INTENTIONAL (146 usages)

Brand colors (`text-brand-600`, `bg-brand-500`, etc.) are intentional for:
- Primary CTAs
- Logo/branding elements
- Accent highlights

**Exit Criteria:**
- Future migration to `--interactive-primary` tokens
- Not a violation - serves specific design purpose
- Migrate when design system matures

---

## Commands

```bash
# Check quarantine status
node scripts/check-raw-palette.mjs

# Check with custom cap
node scripts/check-raw-palette.mjs --cap=90

# Run full design system check (typecheck + lint + design)
npm run typecheck && npm run lint && node scripts/check-raw-palette.mjs
```

---

## History

| Date | Action | Violations |
|------|--------|------------|
| 2026-01-06 | Baseline established | 125 raw palette |
| 2026-01-06 | ESLint enforcement for app/admin/staff | 3 → 0 in admin |
| 2026-01-06 | Token migration in components | 95 → 50 |
| 2026-01-06 | Quarantine hardening | 103 in quarantine, 0 outside |
