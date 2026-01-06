# Token Gaps Analysis

**Generated:** 2026-01-06
**Purpose:** Identify missing semantic tokens to replace raw palette usage

---

## Summary

| Area | Raw Colors | Intent Categories | Tokens Needed |
|------|------------|-------------------|---------------|
| command-palette | 2 | Type coloring | category-* |
| knowledge-hub | 4 | Type coloring, deadlines | category-*, already have chart-* |
| news | 14 | Accent, status, links | accent-*, existing status tokens |
| assistant-v2 | 25 | Authority levels, section types | authority-*, section-* |
| marketing components | 29 | Hero accents, decorative, status | accent-*, already exists |
| marketing routes | 34 | Status, accents, validation | existing tokens should work |

---

## 1. Command Palette (2 violations)

| Raw Color | Visual Intent | Proposed Token | Exists? |
|-----------|---------------|----------------|---------|
| `bg-violet-500/20` | Guide entry type | `bg-category-guide/20` | NO - create |
| `text-violet-400` | Guide entry text | `text-category-guide` | NO - create |

**Analysis:** Uses violet to distinguish "guide" type from "action", "tool", etc.
Other types already use: `accent` (action), `success` (tool), `warning` (comparison), `surface` (default).

**Solution:** Add category tokens for consistent type coloring.

---

## 2. Knowledge Hub (4 violations)

| Raw Color | File | Visual Intent | Proposed Token | Exists? |
|-----------|------|---------------|----------------|---------|
| `bg-purple-600` | DeadlineCalendar | PDV deadline type | `bg-chart-2` | YES |
| `text-purple-300` | TLDRBox | Highlight title | `text-accent-light` | YES |
| `border-indigo-400/30` | ComparisonCell | D.O.O. type | `border-chart-1/30` | YES |
| `border-orange-400/30` | ComparisonCell | Freelancer type | `border-chart-5/30` | YES |

**Analysis:** All can use existing chart-* tokens. These are category distinctions.

**Solution:** Map to existing chart tokens (already defined for data viz).

---

## 3. News (14 violations)

| Raw Color | Count | Visual Intent | Proposed Token | Exists? |
|-----------|-------|---------------|----------------|---------|
| `text-cyan-300` | 2 | Accent text on dark | `text-accent-light` | YES |
| `border-cyan-500` | 2 | Accent border | `border-accent` | YES |
| `text-blue-300` | 5 | Info/link text dark | `text-info-text` | YES |
| `border-blue-300` | 1 | Link border | `border-info-border` | YES |
| `text-green-300` | 2 | Positive indicator | `text-success-text` | YES |
| `text-red-300` | 1 | Negative indicator | `text-danger-text` | YES |
| `text-yellow-300` | 1 | Warning indicator | `text-warning-text` | YES |
| `border-emerald-500` | 1 | Success border | `border-success` | YES |

**Analysis:** All intents map to existing tokens!

**Solution:** Direct migration to existing semantic tokens.

---

## 4. Assistant V2 (25 violations)

| Raw Color | Visual Intent | Proposed Token | Exists? |
|-----------|---------------|----------------|---------|
| `bg-blue-900/30`, `bg-blue-950/20` | Info section bg | `bg-info-bg` | YES |
| `bg-amber-900/30`, `bg-amber-950/20` | Warning section bg | `bg-warning-bg` | YES |
| `bg-cyan-900/20` | Highlight section bg | `bg-accent/20` | YES |
| `bg-red-950/30` | Error section bg | `bg-danger-bg` | YES |
| `bg-purple-900/30` | Authority expert bg | `bg-category-expert/30` | NO - create |
| `text-cyan-200`, `text-cyan-100` | Accent text | `text-accent-light` | YES |
| `border-cyan-500/20` | Accent border | `border-accent/20` | YES |
| `bg-green-900/30` | Official authority | `bg-success/30` | YES |
| `text-green-300` | Official authority text | `text-success-text` | YES |
| `bg-blue-900/30` | Info authority | `bg-info/30` | YES |
| `text-blue-300` | Info authority text | `text-info-text` | YES |
| `text-purple-300` | Expert authority text | `text-category-expert` | NO - create |
| `border-purple-500/20` | Expert authority border | `border-category-expert/20` | NO - create |
| `bg-yellow-600`, `bg-yellow-700` | Deadline indicator | `bg-warning`, `bg-warning-dark` | PARTIAL |

**Analysis:** Most map to existing status tokens. Need category-expert for authority badges.

**Solution:** Add category-expert token, add warning-dark variant.

---

## 5. Marketing Components (29 violations)

| Raw Color | Visual Intent | Proposed Token | Exists? |
|-----------|---------------|----------------|---------|
| `bg-slate-950/85,90` | Dark overlay | `bg-surface-base` | YES (in dark mode) |
| `bg-cyan-500/10,20` | Hero accent glow | `bg-accent/10` | YES |
| `border-cyan-400/30` | Accent border subtle | `border-accent/30` | YES |
| `text-cyan-300,200` | Accent text | `text-accent`, `text-accent-light` | YES |
| `border-blue-300` | Link/info border | `border-info-border` | YES |
| `bg-green-600`, `bg-green-400` | Success indicator | `bg-success` | YES |
| `bg-red-400` | Danger indicator | `bg-danger` | YES |
| `bg-yellow-400` | Warning indicator | `bg-warning` | YES |
| `text-rose-400` | Destructive action | `text-danger` | YES |
| `text-purple-300` | Feature highlight | `text-category-feature` | NO - consider |
| `bg-purple-500` | Feature badge | `bg-category-feature` | NO - consider |
| `border-cyan-500` | Accent border | `border-accent` | YES |
| `bg-blue-500`, `bg-indigo-500` | Decorative orbs | @design-override | EFFECT |

**Analysis:** Most map to existing tokens. Purple for "feature" badges. Decorative orbs need override.

---

## 6. Marketing Routes (34 violations)

| Raw Color | Visual Intent | Proposed Token | Exists? |
|-----------|---------------|----------------|---------|
| `text-green-500,900` | Valid/success | `text-success`, `text-success-text` | YES |
| `text-red-700,900,300` | Invalid/error | `text-danger`, `text-danger-text` | YES |
| `text-amber-200,300` | Caution/tip | `text-warning-text` | YES |
| `text-cyan-400` | Accent | `text-accent` | YES |
| `text-blue-100,200` | Info on dark | `text-info-text` | YES |
| `text-indigo-600,700,900` | Invitation accent | `text-interactive-primary` | YES |
| `bg-indigo-50,100` | Invitation bg | `bg-info-bg` | YES |
| `text-purple-500` | Role selector | `text-category-feature` | CONSIDER |
| `bg-purple-50`, `border-purple-200` | Calculator section | `bg-info-bg`, `border-info-border` | YES |
| `bg-green-600,700` | Success button | `bg-success` | YES |
| `text-rose-300,400` | Migration warning | `text-danger-text` | YES |
| `text-green-300` | Migration success | `text-success-text` | YES |
| `border-red-200`, `text-red-700` | Error state | `border-danger-border`, `text-danger-text` | YES |
| `border-cyan-500` | Accent border | `border-accent` | YES |

**Analysis:** Almost all map to existing tokens!

---

## New Tokens Required

Based on gap analysis, we need these new tokens:

### 1. Category Tokens (for type/category distinctions)

```css
/* Category coloring for guides, features, experts */
--category-guide: #8b5cf6;      /* violet-500 */
--category-guide-text: #a78bfa; /* violet-400 for dark bg */
--category-guide-bg: rgba(139, 92, 246, 0.2);

--category-expert: #a855f7;     /* purple-500 */
--category-expert-text: #d8b4fe; /* purple-300 for dark bg */
--category-expert-bg: rgba(168, 85, 247, 0.2);

--category-feature: #8b5cf6;    /* same as guide, for marketing */
```

### 2. Warning Dark Variant

```css
/* For deadline indicators on dark bg */
--warning-dark: #ca8a04;        /* yellow-600 equivalent */
```

### 3. Surface Dark Overlay

```css
/* Already exists as overlay, verify usage */
--surface-overlay-heavy: rgba(15, 23, 42, 0.9); /* slate-950/90 */
```

---

## Token Mapping Reference

### Existing Tokens That Replace Raw Colors

| Raw Palette | → Semantic Token |
|-------------|------------------|
| `text-cyan-*` | `text-accent` / `text-accent-light` |
| `border-cyan-*` | `border-accent` |
| `bg-cyan-500/*` | `bg-accent/*` |
| `text-blue-*` | `text-info-text` / `text-link` |
| `border-blue-*` | `border-info-border` |
| `bg-blue-900/*` | `bg-info-bg` (dark mode handles it) |
| `text-green-*` | `text-success` / `text-success-text` |
| `border-emerald-*` | `border-success` / `border-success-border` |
| `bg-green-*` | `bg-success` / `bg-success-bg` |
| `text-red-*` | `text-danger` / `text-danger-text` |
| `border-red-*` | `border-danger-border` |
| `bg-red-950/*` | `bg-danger-bg` |
| `text-amber-*` / `text-yellow-*` | `text-warning-text` |
| `bg-amber-*` | `bg-warning-bg` |
| `bg-slate-950` | `bg-surface-base` (dark mode) / `bg-overlay` |
| `text-indigo-*` | `text-interactive-primary` |

---

## Migration Priority

1. **command-palette** (2 violations) - Add category-guide token, migrate
2. **knowledge-hub** (4 violations) - Use existing chart-* tokens
3. **news** (14 violations) - Direct migration to existing tokens
4. **assistant-v2** (25 violations) - Add category-expert, migrate rest
5. **marketing** (63 violations) - Mostly existing tokens, few overrides for decorative

---

## @design-override Candidates

Only these should remain with raw colors:

1. **Gradient orbs** in marketing hero (bg-blue-500, bg-indigo-500, bg-cyan-500) - animated decorative elements
2. **Chart colors** if not yet mapped to chart-* tokens
3. **Complex canvas/motion** elements

All others must migrate to semantic tokens.
