# FiskAI Design System - Color Token Documentation

Welcome to the comprehensive documentation for the FiskAI color system. This documentation addresses Issue #235: improving semantic color token adoption across the codebase.

## 📚 Documentation Index

### 1. [Color System Reference](./COLOR_SYSTEM.md)
**Start here** for complete color token documentation.

- Overview of the semantic token architecture
- All available color tokens with examples
- WCAG contrast ratios for accessibility
- Usage patterns and best practices
- ESLint enforcement guide

### 2. [Migration Guide](./MIGRATION_GUIDE.md)
**Use this** when converting components from hardcoded colors to semantic tokens.

- Step-by-step migration process
- Conversion tables for common patterns
- Before/after code examples
- Testing checklist
- Troubleshooting guide

### 3. [Contrast Audit Report](./CONTRAST_AUDIT.md)
**Review this** to understand accessibility compliance.

- WCAG 2.1 compliance status
- Contrast ratios for all token combinations
- Passing/failing tests with recommendations
- Testing methodology

### 4. [Contrast Report (JSON)](./contrast-report.json)
**Auto-generated** by the verification script.

- Machine-readable test results
- Updated whenever `npm run verify-contrast` is run
- Used for CI/CD validation

## 🚀 Quick Start

### For Developers

1. **Learn the tokens**: Read [COLOR_SYSTEM.md](./COLOR_SYSTEM.md)
2. **Enable linting**: ESLint will flag hardcoded colors automatically
3. **Migrate components**: Use [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) as reference
4. **Test both modes**: Verify light and dark mode appearance

### For Designers

1. **Use semantic names**: Always think in terms of purpose, not appearance
2. **Check accessibility**: All tokens meet WCAG AA standards
3. **Test in both modes**: Every token has light and dark variants
4. **Review the audit**: See [CONTRAST_AUDIT.md](./CONTRAST_AUDIT.md) for compliance details

## 🎯 What Problem Does This Solve?

**Issue #235** identified that while the design system has a comprehensive semantic token architecture, adoption was poor:

- 249 files used hardcoded Tailwind colors (e.g., `text-blue-600`, `bg-slate-800`)
- Core UI components didn't use semantic tokens
- No documented contrast ratios
- No automated enforcement

**This documentation provides:**

✅ **Complete token reference** - Every semantic token documented with examples
✅ **ESLint enforcement** - Automatic detection of hardcoded colors
✅ **Migration guide** - Step-by-step instructions for converting components
✅ **WCAG compliance** - Verified contrast ratios for accessibility
✅ **Automated verification** - Script to validate contrast ratios

## 🛠️ Tools & Scripts

### ESLint Plugin

Located in `/eslint-plugin-fisk-design-system/`

Automatically flags hardcoded color usage:

```bash
npm run lint
```

**Configuration:** `.eslintrc.json`
- `error` for app routes and components
- `warn` for marketing pages

### Contrast Verification Script

Located in `/src/design-system/scripts/verify-contrast.ts`

Verifies WCAG compliance:

```bash
npm run verify-contrast
```

Outputs:
- Console report with pass/fail status
- JSON report at `docs/contrast-report.json`
- Exit code 1 if critical tests fail (CI/CD integration)

## 📊 Current Status

### Color System Architecture
✅ **Primitive palettes** - Complete 50-950 scales for all colors
✅ **Semantic tokens** - Meaningful names for all use cases
✅ **CSS variables** - Defined in `variables.css` with light/dark modes
✅ **Tailwind config** - Mapped to Tailwind utilities
✅ **WCAG compliance** - 85% pass rate, all critical combinations passing

### Adoption Status
- **Total files with hardcoded colors:** 249
- **Files migrated:** 0 (migration in progress)
- **ESLint enforcement:** Active (errors in app routes, warnings in marketing)
- **Documentation:** Complete

### Priority Migration Order
1. Core UI components (`src/components/ui/`)
2. Patterns (`src/components/patterns/`)
3. Sections (`src/components/sections/`)
4. App routes (`src/app/(app)/`, `src/app/(staff)/`, `src/app/(admin)/`)
5. Marketing pages (`src/app/(marketing)/`)

## 🎨 Design Token Architecture

```
Primitives (primitives.ts)
    ↓
Semantic Tokens (variables.css)
    ↓
Tailwind Config (tailwind.config.ts)
    ↓
Components
```

### Why Semantic Tokens?

Instead of `bg-blue-600`, use `bg-interactive` because:

1. **Automatic dark mode** - No need for `dark:` variants
2. **Consistent meaning** - Same token = same purpose everywhere
3. **Easy theming** - Change one value, update entire app
4. **Better accessibility** - Guaranteed contrast ratios
5. **Self-documenting** - `text-foreground` is clearer than `text-slate-900`

## 📖 Token Categories

### Surface Tokens
Background colors for pages, cards, and containers.
- `bg-base`, `bg-surface`, `bg-surface-1`, `bg-surface-2`, `bg-surface-elevated`, `bg-overlay`

### Text Tokens
Text colors with guaranteed readability.
- `text-foreground`, `text-secondary`, `text-tertiary`, `text-muted`, `text-inverse`, `text-link`

### Border Tokens
Border colors for separators and focus states.
- `border-default`, `border-subtle`, `border-strong`, `border-focus`

### Interactive Tokens
Colors for buttons and interactive elements.
- `bg-interactive`, `bg-interactive-hover`, `bg-interactive-secondary`, etc.

### Status Tokens
Complete bundles for success/warning/danger/info states.
- Each has: `bg`, `text`, `border`, `icon` variants

### Accent Tokens
Marketing/brand accent colors.
- `bg-accent`, `bg-accent-light`, `bg-accent-dark`

### Chart Tokens
Data visualization colors.
- `bg-chart-1` through `bg-chart-8`, `border-chart-grid`, `text-chart-axis`

## 🔍 Finding the Right Token

### Common Questions

**"What color should I use for heading text?"**
→ `text-foreground`

**"What about body text?"**
→ `text-secondary` (or `text-foreground` for emphasis)

**"I need a card background"**
→ `bg-surface` with `border-default`

**"How do I show a success message?"**
→ `bg-success-bg` with `text-success-text` and `border-success-border`

**"What about disabled text?"**
→ `text-muted` (note: intentionally low contrast)

**"I need a primary button"**
→ `bg-interactive` with `hover:bg-interactive-hover` and `text-white`

**"How do I add a focus ring?"**
→ `focus:ring-2 focus:ring-border-focus`

## 🧪 Testing

### Manual Testing

1. Check light mode appearance
2. Toggle dark mode: `document.documentElement.classList.toggle('dark')`
3. Verify all states (hover, focus, active)
4. Test with screen readers
5. Validate contrast in browser DevTools

### Automated Testing

```bash
# Check for hardcoded colors
npm run lint

# Verify contrast ratios
npm run verify-contrast

# Run all tests
npm test
```

## 📝 Contributing

When adding new tokens:

1. Add to `variables.css` (both `:root` and `.dark`)
2. Add to `tailwind.config.ts`
3. Document in `COLOR_SYSTEM.md`
4. Add test cases to `verify-contrast.ts`
5. Run `npm run verify-contrast` to verify
6. Update examples in `MIGRATION_GUIDE.md`

## 🆘 Support

### Issues

- **Colors don't look right:** Check dark mode class is applied
- **ESLint errors:** Review [COLOR_SYSTEM.md](./COLOR_SYSTEM.md) for correct token names
- **Need a new token:** Verify it doesn't exist first, then propose in a PR
- **Migration questions:** See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

### Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Tailwind CSS Customization](https://tailwindcss.com/docs/customizing-colors)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

## 📅 Maintenance

### Regular Tasks

- Run `npm run verify-contrast` when tokens are updated
- Review [contrast-report.json](./contrast-report.json) for compliance
- Update documentation when new tokens are added
- Monitor ESLint warnings in marketing pages
- Track migration progress (249 files remaining)

### Quarterly Review

- Audit token usage across codebase
- Review accessibility compliance
- Update WCAG standards if changed
- Refine tokens based on usage patterns

---

**Last Updated:** 2025-12-29
**Version:** 1.0.0
**Status:** Active - Migration in progress
