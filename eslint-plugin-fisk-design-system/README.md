# ESLint Plugin: Fisk Design System

Custom ESLint plugin for enforcing semantic color token usage in the FiskAI design system.

## Rules

### `no-hardcoded-colors`

Prevents the use of hardcoded Tailwind color classes (like `text-blue-600`, `bg-slate-800`) in favor of semantic design tokens.

**Bad:**
```tsx
<div className="text-slate-800 bg-white border-slate-200">
  <button className="bg-blue-600 hover:bg-blue-700">Click</button>
</div>
```

**Good:**
```tsx
<div className="text-foreground bg-surface border-default">
  <button className="bg-interactive hover:bg-interactive-hover">Click</button>
</div>
```

## Configuration

The plugin is already configured in `.eslintrc.json`:

```json
{
  "plugins": ["fisk-design-system"],
  "rules": {
    "fisk-design-system/no-hardcoded-colors": "error"
  }
}
```

## Semantic Token Reference

See `/home/admin/fiskai-worktrees/agent-10-marketing/src/design-system/docs/COLOR_SYSTEM.md` for complete documentation.

### Quick Reference

**Text:**
- `text-foreground` - Primary text
- `text-secondary` - Secondary text
- `text-tertiary` - Tertiary text
- `text-muted` - Disabled/muted text
- `text-link` - Link color

**Backgrounds:**
- `bg-surface` - Primary surface
- `bg-surface-1` - Elevated surface
- `bg-surface-2` - More elevated surface

**Borders:**
- `border-default` - Default border
- `border-subtle` - Subtle border
- `border-strong` - Strong border
- `border-focus` - Focus ring

**Interactive:**
- `bg-interactive` - Primary button
- `bg-interactive-hover` - Primary button hover

**Status:**
- `bg-success-bg`, `text-success-text`, `border-success-border`
- `bg-warning-bg`, `text-warning-text`, `border-warning-border`
- `bg-danger-bg`, `text-danger-text`, `border-danger-border`
- `bg-info-bg`, `text-info-text`, `border-info-border`
