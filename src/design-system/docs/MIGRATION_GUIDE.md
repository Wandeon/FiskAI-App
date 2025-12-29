# Color System Migration Guide

This guide helps you migrate components from hardcoded Tailwind colors to semantic design tokens.

## Quick Start

1. **Enable ESLint** - It will flag all hardcoded colors
2. **Run the linter** - See all files that need updating
3. **Use this guide** - Find the right semantic token for each hardcoded color
4. **Test in both modes** - Verify light and dark mode appearance

## Migration Process

### Step 1: Identify Violations

Run ESLint to find all hardcoded colors:

```bash
npm run lint
```

You'll see errors like:

```
error  Avoid hardcoded color "text-slate-800". Use semantic tokens instead: text-foreground
error  Avoid hardcoded color "bg-blue-600". Use semantic tokens instead: bg-interactive
```

### Step 2: Replace With Semantic Tokens

Use the conversion table below to replace hardcoded colors with semantic tokens.

### Step 3: Test Both Modes

Always verify your changes in both light and dark mode:

```tsx
// Toggle dark mode in DevTools
document.documentElement.classList.toggle('dark');
```

### Step 4: Commit

Once all ESLint errors are resolved and both modes look correct, commit your changes.

## Conversion Table

### Text Colors

| Hardcoded Color | Semantic Token | Usage |
|----------------|----------------|-------|
| `text-slate-900` | `text-foreground` | Headings, primary text |
| `text-slate-800` | `text-foreground` | Headings, primary text |
| `text-slate-700` | `text-foreground` | Headings, primary text |
| `text-slate-600` | `text-secondary` | Body text, labels |
| `text-slate-500` | `text-tertiary` | Captions, metadata |
| `text-slate-400` | `text-muted` | Disabled text, placeholders |
| `text-slate-300` | `text-muted` | Disabled text (dark bg) |
| `text-gray-*` | Use `slate` equivalents | Same as slate |
| `text-white` | `text-inverse` or keep `text-white` | Text on dark backgrounds |
| `text-blue-600` | `text-link` | Interactive text, links |
| `text-blue-700` | `text-link` | Links |
| `text-blue-500` | `text-link` | Links |

**Example migration:**

```tsx
// Before
<h1 className="text-slate-900">Welcome</h1>
<p className="text-slate-600">Description</p>
<span className="text-slate-400">Metadata</span>

// After
<h1 className="text-foreground">Welcome</h1>
<p className="text-secondary">Description</p>
<span className="text-muted">Metadata</span>
```

### Background Colors

| Hardcoded Color | Semantic Token | Usage |
|----------------|----------------|-------|
| `bg-slate-25` | `bg-base` | Page background |
| `bg-slate-50` | `bg-surface-1` | Subtle backgrounds |
| `bg-slate-100` | `bg-surface-2` | More elevated |
| `bg-slate-200` | `bg-surface-2` | More elevated |
| `bg-white` | `bg-surface` | Cards, panels |
| `bg-gray-*` | Use `slate` equivalents | Same as slate |
| `bg-blue-600` | `bg-interactive` | Primary buttons |
| `bg-blue-700` | `bg-interactive-hover` | Primary button hover |
| `bg-blue-500` | `bg-interactive` | Primary buttons |
| `bg-blue-50` | `bg-info-bg` | Info alerts |
| `bg-emerald-50` | `bg-success-bg` | Success alerts |
| `bg-amber-50` | `bg-warning-bg` | Warning alerts |
| `bg-red-50` | `bg-danger-bg` | Error alerts |

**Example migration:**

```tsx
// Before
<div className="bg-white border rounded-lg">
  <button className="bg-blue-600 hover:bg-blue-700">Click</button>
</div>

// After
<div className="bg-surface border border-default rounded-lg">
  <button className="bg-interactive hover:bg-interactive-hover">Click</button>
</div>
```

### Border Colors

| Hardcoded Color | Semantic Token | Usage |
|----------------|----------------|-------|
| `border-slate-200` | `border-default` | Standard borders |
| `border-slate-300` | `border-default` | Standard borders |
| `border-slate-100` | `border-subtle` | Dividers, subtle lines |
| `border-slate-400` | `border-strong` | Emphasized borders |
| `border-gray-*` | Use `slate` equivalents | Same as slate |
| `border-blue-500` | `border-focus` | Focus rings |
| `border-blue-600` | `border-focus` | Focus rings |
| `border-emerald-200` | `border-success-border` | Success outlines |
| `border-amber-200` | `border-warning-border` | Warning outlines |
| `border-red-200` | `border-danger-border` | Error outlines |

**Example migration:**

```tsx
// Before
<input className="border border-slate-300 focus:border-blue-500" />

// After
<input className="border border-default focus:border-focus" />
```

### Status Colors

#### Success

| Hardcoded Color | Semantic Token |
|----------------|----------------|
| `bg-emerald-50` | `bg-success-bg` |
| `bg-emerald-100` | `bg-success-bg` |
| `text-emerald-700` | `text-success-text` |
| `text-emerald-600` | `text-success-text` |
| `border-emerald-200` | `border-success-border` |
| `text-emerald-600` (icons) | `text-success-icon` |

**Example:**

```tsx
// Before
<div className="bg-emerald-50 border border-emerald-200 p-4">
  <p className="text-emerald-700">Success!</p>
</div>

// After
<div className="bg-success-bg border border-success-border p-4">
  <p className="text-success-text">Success!</p>
</div>
```

#### Warning

| Hardcoded Color | Semantic Token |
|----------------|----------------|
| `bg-amber-50` | `bg-warning-bg` |
| `bg-amber-100` | `bg-warning-bg` |
| `text-amber-700` | `text-warning-text` |
| `text-amber-600` | `text-warning-text` |
| `border-amber-200` | `border-warning-border` |
| `text-amber-600` (icons) | `text-warning-icon` |

#### Danger/Error

| Hardcoded Color | Semantic Token |
|----------------|----------------|
| `bg-red-50` | `bg-danger-bg` |
| `bg-red-100` | `bg-danger-bg` |
| `text-red-700` | `text-danger-text` |
| `text-red-600` | `text-danger-text` |
| `border-red-200` | `border-danger-border` |
| `text-red-600` (icons) | `text-danger-icon` |

#### Info

| Hardcoded Color | Semantic Token |
|----------------|----------------|
| `bg-blue-50` | `bg-info-bg` |
| `bg-blue-100` | `bg-info-bg` |
| `text-blue-700` | `text-info-text` |
| `text-blue-600` | `text-info-text` |
| `border-blue-200` | `border-info-border` |
| `text-blue-600` (icons) | `text-info-icon` |

### Interactive Elements

#### Buttons

```tsx
// Before - Primary
<button className="bg-blue-600 hover:bg-blue-700 text-white">
  Primary
</button>

// After - Primary
<button className="bg-interactive hover:bg-interactive-hover text-white">
  Primary
</button>

// Before - Secondary
<button className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700">
  Secondary
</button>

// After - Secondary
<button className="bg-interactive-secondary hover:bg-interactive-secondary-hover border border-default text-foreground">
  Secondary
</button>

// Before - Ghost
<button className="hover:bg-slate-100 text-slate-700">
  Ghost
</button>

// After - Ghost
<button className="bg-interactive-ghost hover:bg-interactive-ghost-hover text-foreground">
  Ghost
</button>
```

#### Links

```tsx
// Before
<a href="#" className="text-blue-600 hover:text-blue-700 hover:underline">
  Learn more
</a>

// After
<a href="#" className="text-link hover:underline">
  Learn more
</a>
```

#### Form Inputs

```tsx
// Before
<input
  className="bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500"
  placeholder="Enter text..."
/>

// After
<input
  className="bg-surface border border-default text-foreground placeholder:text-muted focus:border-focus focus:ring-border-focus"
  placeholder="Enter text..."
/>
```

## Common Patterns

### Card Component

```tsx
// Before
<div className="bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md">
  <div className="p-6">
    <h3 className="text-slate-900 font-semibold">Card Title</h3>
    <p className="text-slate-600 mt-2">Card description</p>
  </div>
</div>

// After
<div className="bg-surface border border-default rounded-lg shadow-sm hover:shadow-md">
  <div className="p-6">
    <h3 className="text-foreground font-semibold">Card Title</h3>
    <p className="text-secondary mt-2">Card description</p>
  </div>
</div>
```

### Alert Component

```tsx
// Before - Success Alert
<div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
  <div className="flex items-center gap-3">
    <CheckCircle className="h-5 w-5 text-emerald-600" />
    <div>
      <p className="text-emerald-900 font-semibold">Success</p>
      <p className="text-emerald-700 text-sm">Your changes were saved.</p>
    </div>
  </div>
</div>

// After - Success Alert
<div className="bg-success-bg border border-success-border rounded-lg p-4">
  <div className="flex items-center gap-3">
    <CheckCircle className="h-5 w-5 text-success-icon" />
    <div>
      <p className="text-foreground font-semibold">Success</p>
      <p className="text-success-text text-sm">Your changes were saved.</p>
    </div>
  </div>
</div>
```

### Badge Component

```tsx
// Before
<span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
  New
</span>

// After
<span className="inline-flex items-center rounded-full bg-info-bg px-2.5 py-0.5 text-xs font-medium text-info-text">
  New
</span>
```

### Modal/Dialog

```tsx
// Before
<div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm">
  <div className="bg-white rounded-lg shadow-xl p-6">
    <h2 className="text-slate-900 text-lg font-semibold">Dialog Title</h2>
    <p className="text-slate-600 mt-2">Dialog content</p>
    <div className="mt-4 flex gap-2">
      <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
        Confirm
      </button>
      <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded">
        Cancel
      </button>
    </div>
  </div>
</div>

// After
<div className="fixed inset-0 bg-overlay backdrop-blur-sm">
  <div className="bg-surface-elevated rounded-lg shadow-xl p-6">
    <h2 className="text-foreground text-lg font-semibold">Dialog Title</h2>
    <p className="text-secondary mt-2">Dialog content</p>
    <div className="mt-4 flex gap-2">
      <button className="bg-interactive hover:bg-interactive-hover text-white px-4 py-2 rounded">
        Confirm
      </button>
      <button className="bg-interactive-secondary hover:bg-interactive-secondary-hover border border-default text-foreground px-4 py-2 rounded">
        Cancel
      </button>
    </div>
  </div>
</div>
```

## Edge Cases

### When to Keep Hardcoded Colors

Some cases where hardcoded colors are acceptable:

1. **Utility colors**: `text-white`, `bg-black`, `border-transparent`, `bg-current`
2. **One-off marketing elements**: Unique brand moments that shouldn't change with theme
3. **Chart/data viz**: Use `bg-chart-1` through `bg-chart-8` tokens instead

### Dark Mode Specific Styles

If you need dark-mode-specific overrides:

```tsx
// Before
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
  Content
</div>

// After - Usually not needed, tokens handle this
<div className="bg-surface text-foreground">
  Content
</div>

// If you truly need mode-specific styles
<div className="bg-surface text-foreground dark:bg-surface-elevated">
  Content
</div>
```

### Opacity Modifiers

Tailwind opacity modifiers work with semantic tokens:

```tsx
// Before
<div className="bg-blue-600/20">Content</div>

// After
<div className="bg-interactive/20">Content</div>
```

### Arbitrary Values

Avoid arbitrary color values. If you need them, create a new semantic token instead:

```tsx
// Bad
<div className="bg-[#3b82f6]">Content</div>

// Good - Define a token in variables.css
<div className="bg-accent">Content</div>
```

## Testing Checklist

After migrating a component, verify:

- [ ] All ESLint errors are resolved
- [ ] Component looks correct in **light mode**
- [ ] Component looks correct in **dark mode**
- [ ] Focus states are visible and accessible
- [ ] Text is readable (good contrast)
- [ ] Status colors (success/warning/danger) are distinct
- [ ] Hover states work properly
- [ ] No visual regressions compared to before

## Automated Migration

For large-scale migrations, you can use a script to automate common replacements:

```bash
# Run the migration script (replaces common patterns)
npm run migrate-colors
```

This script:
1. Backs up your files
2. Replaces common hardcoded colors with semantic tokens
3. Reports any patterns it couldn't migrate
4. Runs ESLint to verify the changes

**Note:** Always review automated changes before committing.

## Troubleshooting

### ESLint Still Showing Errors

If ESLint flags a semantic token as hardcoded:

1. Make sure you're using the token correctly (e.g., `text-foreground` not `text-forground`)
2. Check that the token exists in `tailwind.config.ts`
3. Restart your editor/LSP server

### Colors Look Wrong in Dark Mode

1. Verify the token exists in both `:root` and `.dark` in `variables.css`
2. Check that `dark` class is applied to `<html>` or `<body>`
3. Test with DevTools: `document.documentElement.classList.toggle('dark')`

### Need a New Color

If no existing token fits your use case:

1. Check if a similar token exists (see [COLOR_SYSTEM.md](./COLOR_SYSTEM.md))
2. Consider if this is truly a new semantic need
3. If yes, propose a new token by:
   - Adding it to `variables.css` (light and dark)
   - Adding it to `tailwind.config.ts`
   - Documenting it in `COLOR_SYSTEM.md`
   - Creating a PR for review

## Migration Priority

Migrate files in this order:

1. **Core UI components** (`src/components/ui/`) - Highest impact
2. **Patterns** (`src/components/patterns/`) - Used frequently
3. **Sections** (`src/components/sections/`) - Visible to users
4. **App routes** (`src/app/(app)/`, `src/app/(staff)/`, `src/app/(admin)/`)
5. **Marketing pages** (`src/app/(marketing)/`) - Lower priority (only warnings)

## Getting Help

If you're stuck:

1. Check the [COLOR_SYSTEM.md](./COLOR_SYSTEM.md) reference
2. Look at recently migrated components for examples
3. Run ESLint - it provides suggestions
4. Ask the design system team

## Progress Tracking

Track migration progress:

```bash
# Count remaining violations
npm run lint 2>&1 | grep "no-hardcoded-colors" | wc -l

# List files with violations
npm run lint 2>&1 | grep "no-hardcoded-colors" | cut -d':' -f1 | sort -u
```

Current status (as of 2025-12-29):
- **Total files with hardcoded colors:** 249
- **Files migrated:** 0
- **Remaining:** 249

## Next Steps

1. Start with core UI components
2. Migrate one file at a time
3. Test thoroughly in both modes
4. Commit frequently with clear messages
5. Create PRs for review

---

**Questions?** Contact the design system team or open an issue in the repo.
