# FiskAI Design System

A self-enforcing design system with tokenized colors, typography, spacing, and motion.

## Quick Start

```tsx
// Import types for type-safe props
import type { ButtonVariant, StatusVariant } from "@/design-system"

// Use semantic Tailwind classes
;<div className="bg-surface text-foreground border-border">
  <h1 className="text-heading-xl">Title</h1>
  <p className="text-body-base text-secondary">Description</p>
  <Button variant="primary">Action</Button>
  <Badge variant="success">Status</Badge>
</div>
```

## Available Classes

### Surfaces

- `bg-base` - Page background
- `bg-surface` - Cards (default)
- `bg-surface-1` - Nested cards, hover states
- `bg-surface-2` - Deeper nesting
- `bg-surface-elevated` - Modals

### Text

- `text-foreground` - Primary text
- `text-secondary` - Body text
- `text-tertiary` - Captions
- `text-muted` - Disabled
- `text-link` - Links

### Status

- `bg-success-bg`, `text-success-text`, `border-success-border`
- `bg-warning-bg`, `text-warning-text`, `border-warning-border`
- `bg-danger-bg`, `text-danger-text`, `border-danger-border`
- `bg-info-bg`, `text-info-text`, `border-info-border`

### Typography

- `text-display-xl`, `text-display-lg`, `text-display-md`
- `text-heading-xl`, `text-heading-lg`, `text-heading-md`, `text-heading-sm`
- `text-body-lg`, `text-body-base`, `text-body-sm`, `text-body-xs`
- `text-label`, `text-caption`, `text-overline`, `text-code`

### Interactive

- `bg-interactive`, `hover:bg-interactive-hover`
- `border-border-focus`

### Charts

- `text-chart-1` through `text-chart-8`

## Enforcement

Hardcoded colors are blocked by ESLint:

```tsx
// BLOCKED
<div className="text-blue-600">Error!</div>

// ALLOWED
<div className="text-link">Correct!</div>
```

### Escape Hatch

```tsx
// @design-override: Partner brand requirement
<div className="bg-[#AB1234]">Partner content</div>
```

## Documentation

- [Architecture](../../docs/plans/2025-12-27-design-system-architecture.md)
- [Governance](./TOKENS.md)
- [Accessibility](./ACCESSIBILITY.md) - Motion and animation accessibility guidelines
