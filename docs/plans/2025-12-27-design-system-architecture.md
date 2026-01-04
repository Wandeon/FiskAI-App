# FiskAI Design System Architecture

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement the phase plans.

**Goal:** Create a self-enforcing, tokenized design system that makes visual inconsistency impossible through TypeScript types, restricted Tailwind config, ESLint rules, and pre-commit hooks.

**Architecture:** A 5-layer token system (primitives → semantic → layout → typography → motion) with path-scoped enforcement (strict for /app, relaxed for /marketing) and controlled escape hatches.

**Tech Stack:** TypeScript, Tailwind CSS, CSS Variables, Custom ESLint Rules, Husky Pre-commit Hooks

---

## Problem Statement

The FiskAI codebase has 30+ different color patterns scattered across 145+ pages:

- Components use hardcoded Tailwind colors (`blue-600`, `red-500`, `gray-200`) instead of design tokens
- Status colors are inconsistent (`green-*` vs `emerald-*`, `amber-*` vs `yellow-*`)
- No enforcement mechanism exists
- Marketing pages use `cyan` which isn't formally defined
- Two competing badge systems exist with different color schemes

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FISK AI DESIGN SYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 0: PRIMITIVES (never imported directly)                              │
│  └── Raw color values, perceptually balanced                                │
│                                                                             │
│  LAYER 1: SEMANTIC TOKENS                                                   │
│  ├── surfaces.ts  - Surface ladder (0, 1, 2, elevated, overlay)            │
│  ├── text.ts      - Text hierarchy (primary, secondary, tertiary)          │
│  ├── borders.ts   - Border tokens                                           │
│  └── interactive.ts - Interactive states                                    │
│                                                                             │
│  LAYER 2: LAYOUT TOKENS                                                     │
│  ├── spacing.ts   - 4px base unit scale                                     │
│  ├── radius.ts    - Border radius scale                                     │
│  └── elevation.ts - z-index + shadows                                       │
│                                                                             │
│  LAYER 3: SPECIALIZED TOKENS                                                │
│  ├── typography.ts - Complete text styles                                   │
│  ├── motion.ts     - Animation + reduced-motion                             │
│  └── data-vis.ts   - Chart categorical palette                              │
│                                                                             │
│  LAYER 4: ENFORCEMENT                                                       │
│  ├── TypeScript types                                                       │
│  ├── Restricted Tailwind config                                             │
│  ├── Custom ESLint rule                                                     │
│  └── Pre-commit hook                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/design-system/
├── tokens/
│   ├── primitives.ts      # Raw values (NEVER used directly)
│   ├── semantic/
│   │   ├── colors.ts      # Status colors (success, warning, danger)
│   │   ├── surfaces.ts    # Surface ladder
│   │   ├── text.ts        # Text hierarchy
│   │   ├── borders.ts     # Border tokens
│   │   └── interactive.ts # Interactive states
│   ├── layout/
│   │   ├── spacing.ts     # 4px base unit scale
│   │   ├── radius.ts      # Border radius scale
│   │   └── elevation.ts   # z-index + shadows
│   ├── typography.ts      # Text styles
│   ├── motion.ts          # Animation tokens
│   ├── data-vis.ts        # Chart palette
│   └── index.ts           # Main export
├── css/
│   └── variables.css      # CSS custom properties
├── eslint/
│   ├── no-hardcoded-colors.js
│   └── index.js
├── types.ts               # TypeScript types
└── index.ts               # Public API
```

## Token Definitions

### Primitives (Layer 0)

Contrast-first, perceptually balanced palette:

| Color   | Purpose             | Key Values                 |
| ------- | ------------------- | -------------------------- |
| Blue    | Primary/Interactive | 500: #3b82f6, 600: #2563eb |
| Slate   | Neutrals            | 25: #f8fafc → 900: #020617 |
| Emerald | Success             | 500: #10b981, 700: #047857 |
| Amber   | Warning             | 500: #f59e0b, 700: #b45309 |
| Red     | Danger              | 500: #ef4444, 700: #b91c1c |
| Cyan    | Accent (marketing)  | 400: #22d3ee, 500: #06b6d4 |

### Semantic Tokens (Layer 1)

#### Surface Ladder

| Token     | Light Mode | Dark Mode  | Use Case             |
| --------- | ---------- | ---------- | -------------------- |
| base      | slate-25   | slate-900  | Page background      |
| surface-0 | #ffffff    | slate-800  | Cards (default)      |
| surface-1 | slate-50   | slate-700  | Nested, hover states |
| surface-2 | slate-100  | slate-600  | Deeper nesting       |
| elevated  | #ffffff    | slate-700  | Modals, dropdowns    |
| overlay   | rgba black | rgba black | Behind modals        |

#### Text Hierarchy

| Token     | Light Mode | Dark Mode | Use Case            |
| --------- | ---------- | --------- | ------------------- |
| primary   | slate-900  | slate-25  | Headings, important |
| secondary | slate-600  | slate-300 | Body text           |
| tertiary  | slate-500  | slate-400 | Captions, hints     |
| disabled  | slate-400  | slate-500 | Disabled states     |
| inverse   | #ffffff    | slate-900 | On dark backgrounds |
| link      | blue-600   | blue-400  | Interactive text    |

### Layout Tokens (Layer 2)

#### Spacing (4px base)

| Token | Value | Use Case         |
| ----- | ----- | ---------------- |
| 1     | 4px   | Atomic unit      |
| 2     | 8px   | Tight            |
| 3     | 12px  | Default gap      |
| 4     | 16px  | Standard padding |
| 6     | 24px  | Section padding  |
| 8     | 32px  | Large gap        |
| 12    | 48px  | Section margins  |
| 16    | 64px  | Page sections    |

#### Radius

| Token | Value  | Use Case              |
| ----- | ------ | --------------------- |
| sm    | 4px    | Badges, small buttons |
| md    | 8px    | Buttons, inputs       |
| lg    | 12px   | Cards                 |
| xl    | 16px   | Modals                |
| full  | 9999px | Pills, avatars        |

### Typography Tokens (Layer 3)

Pre-composed text styles:

| Token      | Size | Line Height | Weight | Use Case        |
| ---------- | ---- | ----------- | ------ | --------------- |
| display-xl | 60px | 72px        | 700    | Hero headlines  |
| display-lg | 48px | 56px        | 700    | Marketing       |
| heading-xl | 32px | 40px        | 700    | Page titles     |
| heading-lg | 24px | 32px        | 600    | Section headers |
| heading-md | 20px | 28px        | 600    | Subsections     |
| heading-sm | 16px | 24px        | 600    | Card titles     |
| body-lg    | 18px | 28px        | 400    | Large body      |
| body-base  | 16px | 24px        | 400    | Default body    |
| body-sm    | 14px | 20px        | 400    | Small text      |
| body-xs    | 12px | 16px        | 400    | Captions        |
| label      | 14px | 20px        | 500    | Form labels     |
| overline   | 11px | 16px        | 600    | Overlines       |

### Data Visualization Tokens

Categorical palette (distinct from semantic status colors):

| Series | Color  | Hex     | Notes                         |
| ------ | ------ | ------- | ----------------------------- |
| 1      | Indigo | #6366f1 | Not Blue (avoids interactive) |
| 2      | Violet | #8b5cf6 |                               |
| 3      | Pink   | #ec4899 |                               |
| 4      | Teal   | #14b8a6 | Not Cyan (avoids accent)      |
| 5      | Orange | #f97316 |                               |
| 6      | Lime   | #84cc16 |                               |
| 7      | Cyan   | #06b6d4 |                               |
| 8      | Rose   | #f43f5e |                               |

### Motion Tokens

Intent-based animation:

| Intent    | Duration | Easing    | Use Case              |
| --------- | -------- | --------- | --------------------- |
| entrance  | 150ms    | easeOut   | Elements appearing    |
| exit      | 100ms    | easeIn    | Elements disappearing |
| feedback  | 100ms    | easeInOut | Button press, toggle  |
| attention | 200ms    | spring    | Draw eye              |
| loading   | 300ms    | linear    | Spinners, progress    |

## Enforcement Strategy

### 1. TypeScript Types

```typescript
type SemanticTextColor =
  | "primary"
  | "secondary"
  | "tertiary"
  | "disabled"
  | "inverse"
  | "link"
  | "success"
  | "warning"
  | "danger"
type SemanticBgColor =
  | "base"
  | "surface"
  | "surface-1"
  | "surface-2"
  | "elevated"
  | "interactive"
  | "success"
  | "warning"
  | "danger"
```

### 2. Restricted Tailwind Config

Override (not extend) the `colors` key to expose ONLY semantic tokens. Raw colors like `blue-600` won't exist.

### 3. Path-Scoped ESLint

| Path                     | Enforcement Level |
| ------------------------ | ----------------- |
| `src/app/(app)/**`       | ERROR             |
| `src/app/(admin)/**`     | ERROR             |
| `src/app/(staff)/**`     | ERROR             |
| `src/components/**`      | ERROR             |
| `src/app/(marketing)/**` | WARNING           |

### 4. Escape Hatch

```javascript
// @design-override: Brand partner requirement
<div className="bg-[#123456]" />
```

## Implementation Phases

| Phase | Description                   | Files Created/Modified       |
| ----- | ----------------------------- | ---------------------------- |
| 1     | Token files (all layers)      | src/design-system/tokens/\*  |
| 2     | CSS variables in globals.css  | src/app/globals.css          |
| 3     | Tailwind config (restrictive) | tailwind.config.ts           |
| 4     | Typography plugin             | tailwind.config.ts           |
| 5     | ESLint rule + config          | src/design-system/eslint/\*  |
| 6     | Migrate Button component      | src/components/ui/button.tsx |
| 7     | Migrate remaining components  | src/components/ui/\*         |
| 8     | Pre-commit hook               | .husky/pre-commit            |
| 9     | TOKENS.md governance          | src/design-system/TOKENS.md  |

## Success Criteria

1. **Zero raw Tailwind colors** in app/admin/staff pages
2. **All components** use design tokens
3. **ESLint blocks** hardcoded colors (with escape hatch)
4. **Pre-commit prevents** violations from being committed
5. **Dark mode works** automatically via CSS variables
6. **Charts use** categorical palette (not status colors)
7. **Typography is** consistent via text-style classes

## Related Documents

- [Phase 1: Token Files](./2025-12-27-design-system-phase1-tokens.md)
- [Phase 2: CSS Variables](./2025-12-27-design-system-phase2-css.md)
- [Phase 3-4: Tailwind Config](./2025-12-27-design-system-phase3-4-tailwind.md)
- [Phase 5: ESLint Enforcement](./2025-12-27-design-system-phase5-eslint.md)
- [Phase 6-7: Component Migration](./2025-12-27-design-system-phase6-7-components.md)
- [Phase 8-9: Hooks & Governance](./2025-12-27-design-system-phase8-9-governance.md)
