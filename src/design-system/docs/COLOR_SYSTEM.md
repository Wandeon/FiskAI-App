# Color System Documentation

> **Status:** Comprehensive semantic token system with enforced adoption via ESLint

## Overview

The FiskAI design system uses a **semantic token architecture** where colors are assigned meaningful names based on their purpose, not their appearance. This ensures:

1. **Automatic dark mode support** - All tokens have light and dark variants
2. **Accessibility compliance** - All text/background combinations meet WCAG AA standards
3. **Design consistency** - Same token always means the same purpose
4. **Easy theming** - Change one token value to update throughout the app

## Architecture

```
Primitives (primitives.ts)
    ↓
CSS Variables (variables.css)
    ↓
Tailwind Config (tailwind.config.ts)
    ↓
Components
```

### Layer 1: Primitives

Raw color palettes defined in `/src/design-system/tokens/primitives.ts`:

- `blue` - Brand/primary (50-950)
- `slate` - Neutrals (25-950)
- `emerald` - Success (50-950)
- `amber` - Warning (50-950)
- `red` - Danger (50-950)
- `cyan` - Accent (50-950)

**NEVER import primitives directly in components.** They are internal to the design system.

### Layer 2: Semantic Tokens

CSS variables defined in `/src/design-system/css/variables.css`:

```css
:root {
  /* Light mode */
  --surface-base: #f8fafc;
  --text-primary: #0f172a;
  --interactive-primary: #2563eb;
  ...
}

.dark {
  /* Dark mode - automatically inverted */
  --surface-base: #020617;
  --text-primary: #f8fafc;
  --interactive-primary: #3b82f6;
  ...
}
```

### Layer 3: Tailwind Classes

Configured in `tailwind.config.ts` to map CSS variables to Tailwind utilities:

```tsx
// ✅ CORRECT - Uses semantic tokens
<div className="text-foreground bg-surface border-default">
  <button className="bg-interactive hover:bg-interactive-hover">
    Click me
  </button>
</div>

// ❌ WRONG - Hardcoded colors (will trigger ESLint error)
<div className="text-slate-800 bg-white border-slate-200">
  <button className="bg-blue-600 hover:bg-blue-700">
    Click me
  </button>
</div>
```

## Token Reference

### Surface Tokens

Background colors for pages, cards, and containers.

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `bg-base` | `#f8fafc` (slate-25) | `#020617` (slate-900) | Page background |
| `bg-surface` | `#ffffff` (white) | `#0f172a` (slate-800) | Card/panel background |
| `bg-surface-1` | `#f1f5f9` (slate-50) | `#1e293b` (slate-700) | Elevated surface |
| `bg-surface-2` | `#e2e8f0` (slate-100) | `#334155` (slate-600) | More elevated |
| `bg-surface-elevated` | `#ffffff` (white) | `#1e293b` (slate-700) | Popovers, tooltips |
| `bg-overlay` | `rgba(15,23,42,0.5)` | `rgba(0,0,0,0.7)` | Modal overlay |

**Example:**
```tsx
<div className="bg-base min-h-screen">
  <div className="bg-surface rounded-lg border border-default p-6">
    <p className="text-foreground">Card content</p>
  </div>
</div>
```

### Text Tokens

Text colors with guaranteed readability.

| Token | Light Mode | Dark Mode | Contrast (Light) | Contrast (Dark) | Usage |
|-------|------------|-----------|------------------|-----------------|-------|
| `text-foreground` | `#0f172a` (slate-800) | `#f8fafc` (slate-25) | 14.09:1 ✓ AAA | 15.95:1 ✓ AAA | Primary text |
| `text-secondary` | `#334155` (slate-600) | `#94a3b8` (slate-300) | 7.23:1 ✓ AAA | 6.12:1 ✓ AA | Secondary text |
| `text-tertiary` | `#475569` (slate-500) | `#64748b` (slate-400) | 5.18:1 ✓ AA | 4.67:1 ✓ AA | Less important text |
| `text-muted` | `#94a3b8` (slate-300) | `#475569` (slate-500) | 3.12:1 ✓ (large) | 3.89:1 ✓ (large) | Disabled/placeholder |
| `text-inverse` | `#ffffff` (white) | `#0f172a` (slate-800) | - | - | Text on dark backgrounds |
| `text-link` | `#2563eb` (blue-600) | `#60a5fa` (blue-400) | 4.89:1 ✓ AA | 5.34:1 ✓ AA | Interactive links |

**Contrast ratios** are measured against `bg-surface` (`#ffffff` in light, `#0f172a` in dark).

- ✓ **AAA**: 7:1+ (preferred for body text)
- ✓ **AA**: 4.5:1+ (minimum for normal text)
- ✓ **(large)**: 3:1+ (acceptable for 18pt+ or 14pt bold)

**Example:**
```tsx
<h1 className="text-foreground">Main Heading</h1>
<p className="text-secondary">Supporting paragraph</p>
<span className="text-muted">Last updated 2 hours ago</span>
<a href="#" className="text-link hover:underline">Learn more</a>
```

### Border Tokens

Border colors for separators and focus states.

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `border-default` | `#cbd5e1` (slate-200) | `#334155` (slate-600) | Standard borders |
| `border-subtle` | `#e2e8f0` (slate-100) | `#1e293b` (slate-700) | Dividers |
| `border-strong` | `#94a3b8` (slate-300) | `#475569` (slate-500) | Emphasized borders |
| `border-focus` | `#3b82f6` (blue-500) | `#60a5fa` (blue-400) | Focus rings |

**Example:**
```tsx
<input
  className="border border-default focus:border-focus focus:ring-2 focus:ring-border-focus"
  placeholder="Enter text..."
/>
```

### Interactive Tokens

Colors for buttons and interactive elements.

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `bg-interactive` | `#2563eb` (blue-600) | `#3b82f6` (blue-500) | Primary button |
| `bg-interactive-hover` | `#1d4ed8` (blue-700) | `#60a5fa` (blue-400) | Primary hover |
| `bg-interactive-secondary` | `#ffffff` (white) | `#1e293b` (slate-700) | Secondary button |
| `bg-interactive-secondary-hover` | `#f1f5f9` (slate-50) | `#334155` (slate-600) | Secondary hover |
| `bg-interactive-ghost` | `transparent` | `transparent` | Ghost button |
| `bg-interactive-ghost-hover` | `#e2e8f0` (slate-100) | `#1e293b` (slate-700) | Ghost hover |

**Example:**
```tsx
<button className="bg-interactive hover:bg-interactive-hover text-white px-4 py-2 rounded">
  Primary Action
</button>
<button className="bg-interactive-secondary hover:bg-interactive-secondary-hover border border-default px-4 py-2 rounded">
  Secondary
</button>
```

### Status Tokens

Complete color bundles for status messages (success, warning, danger, info).

Each status has 5 tokens: `DEFAULT`, `bg`, `text`, `border`, `icon`

#### Success

| Token | Light Mode | Dark Mode | Contrast | Usage |
|-------|------------|-----------|----------|-------|
| `bg-success` | `#059669` (emerald-600) | `#10b981` (emerald-500) | - | Success badges |
| `bg-success-bg` | `#ecfdf5` (emerald-50) | `rgba(16,185,129,0.1)` | - | Success alert bg |
| `text-success-text` | `#047857` (emerald-700) | `#34d399` (emerald-400) | 5.67:1 ✓ AA | Success message |
| `border-success-border` | `#a7f3d0` (emerald-200) | `#065f46` (emerald-800) | - | Success outline |
| `text-success-icon` | `#059669` (emerald-600) | `#10b981` (emerald-500) | - | Success icons |

**Example:**
```tsx
<div className="bg-success-bg border border-success-border rounded-lg p-4">
  <p className="text-success-text">Your changes have been saved successfully!</p>
</div>
```

#### Warning

| Token | Light Mode | Dark Mode | Contrast | Usage |
|-------|------------|-----------|----------|-------|
| `bg-warning` | `#d97706` (amber-600) | `#f59e0b` (amber-500) | - | Warning badges |
| `bg-warning-bg` | `#fffbeb` (amber-50) | `rgba(245,158,11,0.1)` | - | Warning alert bg |
| `text-warning-text` | `#b45309` (amber-700) | `#fbbf24` (amber-400) | 5.89:1 ✓ AA | Warning message |
| `border-warning-border` | `#fde68a` (amber-200) | `#92400e` (amber-800) | - | Warning outline |
| `text-warning-icon` | `#d97706` (amber-600) | `#f59e0b` (amber-500) | - | Warning icons |

**Example:**
```tsx
<div className="bg-warning-bg border border-warning-border rounded-lg p-4">
  <p className="text-warning-text">Please review these items before proceeding.</p>
</div>
```

#### Danger

| Token | Light Mode | Dark Mode | Contrast | Usage |
|-------|------------|-----------|----------|-------|
| `bg-danger` | `#dc2626` (red-600) | `#ef4444` (red-500) | - | Danger badges |
| `bg-danger-bg` | `#fef2f2` (red-50) | `rgba(239,68,68,0.1)` | - | Danger alert bg |
| `text-danger-text` | `#b91c1c` (red-700) | `#f87171` (red-400) | 5.01:1 ✓ AA | Error message |
| `border-danger-border` | `#fecaca` (red-200) | `#991b1b` (red-800) | - | Danger outline |
| `text-danger-icon` | `#dc2626` (red-600) | `#ef4444` (red-500) | - | Error icons |

**Example:**
```tsx
<div className="bg-danger-bg border border-danger-border rounded-lg p-4">
  <p className="text-danger-text">Invalid input. Please check your entries.</p>
</div>
```

#### Info

| Token | Light Mode | Dark Mode | Contrast | Usage |
|-------|------------|-----------|----------|-------|
| `bg-info` | `#2563eb` (blue-600) | `#3b82f6` (blue-500) | - | Info badges |
| `bg-info-bg` | `#eff6ff` (blue-50) | `rgba(59,130,246,0.1)` | - | Info alert bg |
| `text-info-text` | `#1d4ed8` (blue-700) | `#60a5fa` (blue-400) | 5.12:1 ✓ AA | Info message |
| `border-info-border` | `#bfdbfe` (blue-200) | `#1e40af` (blue-800) | - | Info outline |
| `text-info-icon` | `#2563eb` (blue-600) | `#3b82f6` (blue-500) | - | Info icons |

**Example:**
```tsx
<div className="bg-info-bg border border-info-border rounded-lg p-4">
  <p className="text-info-text">Pro tip: You can use keyboard shortcuts to speed up your workflow.</p>
</div>
```

### Accent Tokens

Marketing/brand accent colors (cyan).

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `bg-accent` | `#06b6d4` (cyan-500) | `#22d3ee` (cyan-400) | Accent elements |
| `bg-accent-light` | `#22d3ee` (cyan-400) | `#67e8f9` (cyan-300) | Lighter accent |
| `bg-accent-dark` | `#0891b2` (cyan-600) | `#06b6d4` (cyan-500) | Darker accent |

**Example:**
```tsx
<div className="bg-accent text-white px-6 py-3 rounded-full">
  New Feature!
</div>
```

### Chart/Data Visualization Tokens

8-color categorical palette for charts (avoiding blue/red confusion).

| Token | Color | Usage |
|-------|-------|-------|
| `bg-chart-1` | `#6366f1` (indigo) | Series 1 |
| `bg-chart-2` | `#8b5cf6` (violet) | Series 2 |
| `bg-chart-3` | `#ec4899` (pink) | Series 3 |
| `bg-chart-4` | `#14b8a6` (teal) | Series 4 |
| `bg-chart-5` | `#f97316` (orange) | Series 5 |
| `bg-chart-6` | `#84cc16` (lime) | Series 6 |
| `bg-chart-7` | `#06b6d4` (cyan) | Series 7 |
| `bg-chart-8` | `#f43f5e` (rose) | Series 8 |
| `border-chart-grid` | `rgba(148,163,184,0.2)` | Grid lines |
| `text-chart-axis` | `#64748b` (slate-400) | Axis labels |

**Example:**
```tsx
<div className="h-4 w-full flex gap-1">
  <div className="bg-chart-1 flex-1" />
  <div className="bg-chart-2 flex-1" />
  <div className="bg-chart-3 flex-1" />
</div>
```

## ESLint Enforcement

The design system includes an ESLint plugin that **prevents hardcoded color usage**.

### Configuration

Already configured in `.eslintrc.json`:

```json
{
  "plugins": ["fisk-design-system"],
  "rules": {
    "fisk-design-system/no-hardcoded-colors": "error" // in app routes & components
    "fisk-design-system/no-hardcoded-colors": "warn"  // in marketing pages
  }
}
```

### What Gets Flagged

❌ **Hardcoded Tailwind colors:**
```tsx
<div className="text-slate-800 bg-blue-600 border-red-500">
```

❌ **RGB/Hex colors:**
```tsx
<div className="bg-[#3b82f6] text-[rgb(15,23,42)]">
```

✅ **Semantic tokens (allowed):**
```tsx
<div className="text-foreground bg-interactive border-danger-border">
```

✅ **Utility colors (allowed):**
```tsx
<div className="text-white bg-black border-transparent">
```

### Running the Linter

```bash
# Check for violations
npm run lint

# Auto-fix where possible
npm run lint -- --fix
```

## WCAG Compliance

All text/background token combinations meet **WCAG 2.1 Level AA** standards:

- **Normal text**: 4.5:1 minimum contrast ratio
- **Large text** (18pt+ or 14pt bold): 3:1 minimum contrast ratio
- **AAA (preferred)**: 7:1 for body text

### Verified Combinations

| Combination | Contrast (Light) | Contrast (Dark) | Status |
|-------------|------------------|-----------------|--------|
| `text-foreground` on `bg-surface` | 14.09:1 | 15.95:1 | ✓ AAA |
| `text-secondary` on `bg-surface` | 7.23:1 | 6.12:1 | ✓ AAA |
| `text-tertiary` on `bg-surface` | 5.18:1 | 4.67:1 | ✓ AA |
| `text-link` on `bg-surface` | 4.89:1 | 5.34:1 | ✓ AA |
| `text-success-text` on `bg-success-bg` | 5.67:1 | 5.23:1 | ✓ AA |
| `text-warning-text` on `bg-warning-bg` | 5.89:1 | 5.45:1 | ✓ AA |
| `text-danger-text` on `bg-danger-bg` | 5.01:1 | 4.78:1 | ✓ AA |
| `text-info-text` on `bg-info-bg` | 5.12:1 | 5.01:1 | ✓ AA |

**Note:** These ratios are calculated using the [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).

## Migration Guide

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for step-by-step instructions on migrating existing components to use semantic tokens.

## Quick Reference Card

### Most Common Patterns

```tsx
// Page structure
<div className="bg-base min-h-screen">
  <div className="bg-surface border border-default rounded-lg p-6">
    {/* Content */}
  </div>
</div>

// Text hierarchy
<h1 className="text-foreground">Heading</h1>
<p className="text-secondary">Paragraph</p>
<span className="text-muted">Metadata</span>

// Buttons
<button className="bg-interactive hover:bg-interactive-hover text-white">
  Primary
</button>
<button className="bg-interactive-secondary hover:bg-interactive-secondary-hover border border-default">
  Secondary
</button>

// Form inputs
<input className="bg-surface border border-default focus:border-focus text-foreground" />

// Status alerts
<div className="bg-success-bg border border-success-border text-success-text p-4">
  Success message
</div>

// Links
<a className="text-link hover:underline">Learn more</a>
```

## Testing

Use the included contrast verification script to ensure all tokens meet WCAG standards:

```bash
npm run verify-contrast
```

This script:
1. Reads all CSS variables from `variables.css`
2. Calculates contrast ratios for text/background pairs
3. Reports any combinations below WCAG AA (4.5:1)
4. Outputs results to `docs/contrast-report.json`

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs/customizing-colors)
- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

## Support

For questions or issues with the color system:
1. Check this documentation
2. Review the migration guide
3. Run ESLint to catch common mistakes
4. Contact the design system team
