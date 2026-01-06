# Design System Cleanup - Baseline Report

**Generated:** 2026-01-06
**Updated:** 2026-01-06 (Phase 3 in progress)
**Branch:** fix/design-cleanup
**Purpose:** Establish violation counts before cleanup migration

---

## Executive Summary

| Category | Before | After | Progress |
|----------|--------|-------|----------|
| Raw Tailwind palette | 125 | 103 (quarantined) | -18%, HARDENED |
| Violations outside quarantine | - | 0 | ENFORCED |
| Arbitrary color values | 960 | TBD | - |
| Hex colors in code | 1070 | TBD | - |
| Legacy CSS variables | 513 | TBD | - |
| Brand color usage | 146 | 146 | OK (valid) |

---

## Migration Progress

### Phase 1: Baseline ✅
Created initial violation inventory.

### Phase 2: ESLint Enforcement ✅
- Set `fisk-design-system/no-hardcoded-colors` to `error` for app/admin/staff
- Fixed 3 violations in admin (migrated to semantic tokens)
- Kept `warn` for marketing and components (pending migration)

### Phase 3: Token Migration ✅
- Fixed 45+ violations in src/components
- Additional fixes in app/staff, components/ai, components/staff, lib/documents
- Remaining 103 violations quarantined with mechanical enforcement

### Phase 3.5: Quarantine Hardening ✅
- Defined quarantine boundary (6 folder paths)
- ESLint enforces `error` outside quarantine, `warn` inside
- CI script `scripts/check-raw-palette.mjs` prevents spread
- Cap set to 103 - violations cannot increase
- Quarantine folders:
  - `src/components/news/` - Dark-first news UI
  - `src/components/assistant-v2/` - Cockpit/HUD aesthetic
  - `src/components/marketing/` - Hero/landing gradients
  - `src/components/knowledge-hub/` - Category color-coding
  - `src/components/ui/command-palette/` - Entry type colors
  - `src/app/(marketing)/` - Marketing routes

### Phase 4: Spacing Normalization ⏭️ SKIPPED
- Zero arbitrary spacing violations in app/admin/staff routes
- No action required

### Phase 5: Legacy CSS Variables 📋 DEFERRED
- 191 usages in app routes (app: 152, admin: 37, staff: 2)
- Variables are correctly mapped via globals.css compatibility layer
- Recommend: Migrate incrementally during feature work, not a dedicated sweep
- Low priority since current implementation works correctly

### Phase 6: Brand Deprecation 📋 DOCUMENTED
- 146 brand-* usages are intentional for primary CTA/branding
- Future path: Migrate to semantic `--interactive-primary` tokens
- Not a violation - brand colors serve a specific design purpose

---

## 1. Raw Tailwind Palette Usage

**Pattern:** `(text|bg|border)-(slate|gray|blue|red|green|amber|emerald|cyan)-[0-9]+`

**Total:** 50 usages (down from 125)

### By Scope (Post-Migration)

| Scope | Before | After | Status |
|-------|--------|-------|--------|
| src/app/(app) | 0 | 0 | ✅ CLEAN |
| src/app/(admin) | 3 | 0 | ✅ CLEAN (ESLint error) |
| src/app/(staff) | 0 | 0 | ✅ CLEAN (ESLint error) |
| src/app/(marketing) | 26 | 26 | 🔶 QUARANTINED |
| src/components | 95 | 50 | 🔄 MIGRATING |

### Remaining Violations by Category

| Component Group | Count | Status |
|-----------------|-------|--------|
| news/ | 14 | QUARANTINE (dark-mode news UI) |
| marketing/ | 19 | QUARANTINE (hero/landing) |
| assistant-v2/ | 17 | QUARANTINE (cockpit UI) |

### Top Violators

```
14 text-cyan-300
10 border-cyan-500
 8 text-blue-300
 6 text-red-900
 6 border-emerald-500
 5 text-green-500
 5 text-green-300
 5 border-blue-300
 4 bg-red-400
 4 bg-cyan-500
```

### Command Used

```bash
grep -rE "(text|bg|border)-(slate|gray|blue|red|green|amber|emerald|cyan)-[0-9]+" src/ \
  --include="*.tsx" --include="*.ts" --include="*.css" | wc -l
```

---

## 2. Arbitrary Color Values

**Pattern:** `(bg|text|border)-\[...\]`

**Total:** 960 usages

### By Scope

| Scope | Count | Status |
|-------|-------|--------|
| src/app/(app) | 274 | NEEDS REVIEW |
| src/app/(admin) | 51 | NEEDS REVIEW |
| src/app/(staff) | 2 | NEAR-CLEAN |
| src/app/(marketing) | 1 | CLEAN |
| src/components | 616 | HIGHEST PRIORITY |

**Note:** Many arbitrary values may be using CSS variables (e.g., `bg-[var(--surface)]`), which is acceptable. Need to distinguish:
- `bg-[var(--token)]` - OK (using design tokens)
- `bg-[#hexcolor]` - NOT OK (hardcoded)

### Command Used

```bash
grep -rE "(bg|text|border)-\[" src/ --include="*.tsx" --include="*.ts" | wc -l
```

---

## 3. Hex Colors in Code

**Pattern:** `#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})`

**Total:** 1070 usages

### By Scope

| Scope | Count | Status |
|-------|-------|--------|
| src/app/(app) | 4 | NEAR-CLEAN |
| src/app/(admin) | 0 | CLEAN |
| src/app/(staff) | 0 | CLEAN |
| src/app/(marketing) | 17 | QUARANTINED |
| src/components | 20 | NEEDS MIGRATION |

### Top Hex Colors

```
61 #ffffff
48 #666
45 #0f172a
34 #10b981
31 #64748b
29 #f59e0b
28 #e2e8f0
27 #ef4444
26 #333
24 #6b7280
23 #2563eb
22 #94a3b8
22 #0891b2
20 #667eea
20 #3b82f6
20 #334155
19 #f8fafc
19 #475569
18 #dc2626
17 #f8f9fa
```

**Note:** Most hex colors are in CSS files or chart/visualization components.

### Command Used

```bash
grep -rE "#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b" src/ \
  --include="*.tsx" --include="*.ts" --include="*.css" | wc -l
```

---

## 4. Legacy CSS Variable Usage

**Pattern:** `var(--(background|foreground|surface|border))`

**Total:** 513 usages

### Breakdown

| Variable | Count |
|----------|-------|
| var(--border) | 267 |
| var(--foreground) | 243 |
| var(--surface) | 138 |
| var(--background) | 6 |

### By Scope

| Scope | Count | Status |
|-------|-------|--------|
| src/app/(app) | 152 | MAPPED (via globals.css) |
| src/app/(admin) | 37 | MAPPED |
| src/app/(staff) | 2 | MAPPED |
| src/app/(marketing) | 1 | MAPPED |
| src/components | 308 | MAPPED |

**Status:** These are mapped to design tokens in `globals.css`:
```css
--background: var(--surface-base);
--foreground: var(--text-primary);
--surface: var(--surface-0);
--border: var(--border-default);
```

Legacy variables work correctly but should eventually be replaced with semantic Tailwind classes.

### Command Used

```bash
grep -rE "var\(--(background|foreground|surface|border)\)" src/ \
  --include="*.tsx" --include="*.ts" --include="*.css" | wc -l
```

---

## 5. Brand Color Usage

**Pattern:** `(bg|text|border)-brand-`

**Total:** 146 usages

### Breakdown

```
58 text-brand-600
37 text-brand-700
26 bg-brand-50
16 bg-brand-100
15 bg-brand-500
14 bg-brand-600
13 border-brand-500
12 border-brand-200
 9 text-brand-400
 5 bg-brand-950
 5 bg-brand-700
 4 text-brand-500
 3 text-brand-300
 2 text-brand-800
 2 border-brand-300
 2 bg-brand-900
 1 text-brand-900
 1 text-brand-100
 1 border-brand-600
```

**Status:** Brand colors are intentional for primary CTA and branding. These should migrate to semantic tokens (e.g., `--interactive-primary`) but are not violations.

### Command Used

```bash
grep -rE "(bg|text|border)-brand-" src/ \
  --include="*.tsx" --include="*.ts" --include="*.css" | wc -l
```

---

## 6. Current ESLint Configuration

```json
"fisk-design-system/no-hardcoded-colors": "warn"
```

Override for marketing:
```json
{
  "files": ["src/app/(marketing)/**/*"],
  "rules": {
    "fisk-design-system/no-hardcoded-colors": "warn"
  }
}
```

---

## 7. Quarantined Files (@design-override)

Files with intentional raw color usage:

| File | Override Count | Reason |
|------|----------------|--------|
| src/components/marketing/MarketingHomeClient.tsx | 6 | Hero dark gradient, decorative orbs |
| src/components/marketing/MarketingHeader.tsx | 6 | Dark header, CTAs |
| src/components/auth/FloatingOrbs.tsx | 4 | Framer-motion animations |
| src/components/layout/DashboardBackground.tsx | 1 | Decorative background |

---

## 8. Migration Priority Matrix

| Scope | Raw Palette | Arbitrary | Hex | Priority |
|-------|-------------|-----------|-----|----------|
| src/app/(app) | 0 | 274 | 4 | MEDIUM |
| src/app/(admin) | 3 | 51 | 0 | LOW |
| src/app/(staff) | 0 | 2 | 0 | DONE |
| src/app/(marketing) | 26 | 1 | 17 | QUARANTINE |
| src/components | 95 | 616 | 20 | HIGH |

### Recommended Order

1. **Phase 2:** Enforce ESLint `error` for app/admin/staff (already near-clean)
2. **Phase 3A:** Migrate src/components raw palette (95 → 0)
3. **Phase 3B:** Migrate src/app/(app) arbitrary values (274 → semantic)
4. **Phase 5:** Remove legacy CSS variables after all migrations
5. **Phase 6:** Document brand deprecation path

---

## 9. Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Raw palette in app/admin/staff | 3 | 0 |
| ESLint rule for app/admin/staff | warn | error |
| Legacy vars removed | 513 | 0 |
| Brand usage documented | No | Yes |

---

## Appendix: Raw Command Outputs

See `docs/audits/design-cleanup/artifacts/baseline/` for full grep outputs.
