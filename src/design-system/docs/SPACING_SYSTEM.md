# FiskAI Design System - Spacing System Documentation

This document provides comprehensive documentation for the FiskAI spacing system, addressing Issue #232: spacing scale follows consistent 4px base unit.

## Overview

The FiskAI spacing system is built on a **4px base unit**, providing consistent and predictable spacing across all interfaces. This system ensures visual harmony, improves scalability, and maintains consistent rhythm in layouts.

## Status: PASSING

The spacing system successfully follows industry best practices with a consistent 4px base unit pattern, providing a complete range from 0px to 128px.

## Architecture

```
Base Unit: 4px
    ↓
Spacing Scale (spacing.ts)
    ↓
Semantic Aliases (spacingSemantics)
    ↓
Component Spacing (componentSpacing)
    ↓
Tailwind Config
    ↓
Components
```

## Core Spacing Scale

**Location:** `src/design-system/tokens/layout/spacing.ts`

The spacing scale uses numeric keys that represent **multipliers of the 4px base unit**:

```tsx
export const spacing = {
  '0': '0px',      // 0 × 4px
  '0.5': '2px',    // 0.5 × 4px
  '1': '4px',      // 1 × 4px
  '1.5': '6px',    // 1.5 × 4px
  '2': '8px',      // 2 × 4px
  '3': '12px',     // 3 × 4px
  '4': '16px',     // 4 × 4px
  '5': '20px',     // 5 × 4px
  '6': '24px',     // 6 × 4px
  '8': '32px',     // 8 × 4px
  '10': '40px',    // 10 × 4px
  '12': '48px',    // 12 × 4px
  '16': '64px',    // 16 × 4px
  '20': '80px',    // 20 × 4px
  '24': '96px',    // 24 × 4px
  '28': '112px',   // 28 × 4px
  '32': '128px',   // 32 × 4px
}
```

### Scale Characteristics

- **Consistent base:** Every value is a multiple of 4px (including half-steps like 0.5 and 1.5)
- **Progressive growth:** Larger gaps between values at higher ranges (1,2,3,4,5,6,8,10,12,16...)
- **Common values included:** Covers the most frequently used spacing values in UI design
- **Flexible range:** From 0px (no spacing) to 128px (extra large sections)

## Semantic Spacing Aliases

For improved readability and semantic meaning, the system provides named aliases:

```tsx
export const spacingSemantics = {
  none: spacing['0'],     // 0px - No spacing
  xxs: spacing['0.5'],    // 2px - Extra extra small
  xs: spacing['1'],       // 4px - Extra small
  sm: spacing['2'],       // 8px - Small
  md: spacing['3'],       // 12px - Medium
  lg: spacing['4'],       // 16px - Large
  xl: spacing['6'],       // 24px - Extra large
  '2xl': spacing['8'],    // 32px - 2× extra large
  '3xl': spacing['12'],   // 48px - 3× extra large
}
```

### When to Use Semantic Aliases

Use semantic names when the spacing represents a **conceptual size**:

- `gap-md` - A medium-sized gap between related items
- `space-y-lg` - Large vertical spacing
- `p-xl` - Extra large padding

Use numeric tokens when the spacing represents a **precise measurement**:

- `space-y-4` - Specific 16px spacing
- `gap-8` - Exact 32px gap
- `p-6` - Precise 24px padding

## Component-Specific Spacing

Pre-defined spacing values for common component patterns:

```tsx
export const componentSpacing = {
  // Button Spacing
  buttonPaddingX: spacing['4'],        // 16px - Horizontal padding (default)
  buttonPaddingY: spacing['2'],        // 8px - Vertical padding (default)
  buttonPaddingXSm: spacing['3'],      // 12px - Small button horizontal
  buttonPaddingYSm: spacing['1.5'],    // 6px - Small button vertical

  // Input Spacing
  inputPaddingX: spacing['3'],         // 12px - Horizontal padding
  inputPaddingY: spacing['2'],         // 8px - Vertical padding

  // Card Spacing
  cardPadding: spacing['6'],           // 24px - Standard card padding
  cardPaddingCompact: spacing['4'],    // 16px - Compact card padding

  // Modal Spacing
  modalPadding: spacing['6'],          // 24px - Modal content padding

  // Layout Spacing
  sectionGap: spacing['8'],            // 32px - Gap between major sections
  stackGap: spacing['4'],              // 16px - Default vertical stack gap
  inlineGap: spacing['2'],             // 8px - Default horizontal inline gap
}
```

### Component Spacing Usage

These tokens ensure consistency across similar components:

```tsx
// Button component
<button className="px-4 py-2">  // 16px × 8px padding
  Submit
</button>

// Card component
<div className="p-6">  // 24px padding on all sides
  Card content
</div>

// Section layout
<div className="space-y-8">  // 32px gap between sections
  <Section />
  <Section />
</div>
```

## Tailwind Integration

The spacing scale overrides Tailwind's default spacing to ensure consistency:

**Location:** `tailwind.config.ts`

```tsx
module.exports = {
  theme: {
    extend: {
      spacing: spacing,  // Overrides default Tailwind spacing
    }
  }
}
```

This means all Tailwind spacing utilities use the 4px base scale:

- `p-{n}` - Padding
- `m-{n}` - Margin
- `gap-{n}` - Gap (flexbox/grid)
- `space-{x|y}-{n}` - Space between children
- `w-{n}` / `h-{n}` - Width/height (for spacing values)
- `top-{n}` / `right-{n}` / `bottom-{n}` / `left-{n}` - Positioning
- `inset-{n}` - All sides positioning

## Usage Guidelines

### Choosing the Right Spacing Value

| Use Case | Recommended Token | Value | Example |
|----------|------------------|-------|---------|
| Tight inline spacing | `1` or `xs` | 4px | Icon and text |
| Standard inline gap | `2` or `sm` | 8px | Button group items |
| Related items | `3` or `md` | 12px | Form label and input |
| Comfortable padding | `4` or `lg` | 16px | Button padding, card elements |
| Section spacing | `6` or `xl` | 24px | Card padding, modal content |
| Major sections | `8` or `2xl` | 32px | Page sections |
| Large sections | `12` or `3xl` | 48px | Hero section padding |
| Extra large sections | `16` | 64px | Landing page sections |
| Maximum spacing | `32` | 128px | Major page divisions |

### Common Patterns

#### Stack Layouts (Vertical Spacing)

```tsx
// Tight stack (form fields)
<div className="space-y-3">  // 12px between items
  <Input />
  <Input />
</div>

// Standard stack (content sections)
<div className="space-y-4">  // 16px between items
  <Paragraph />
  <Paragraph />
</div>

// Spacious stack (page sections)
<div className="space-y-8">  // 32px between items
  <Section />
  <Section />
</div>
```

#### Inline Layouts (Horizontal Spacing)

```tsx
// Tight inline (badges, chips)
<div className="flex gap-1">  // 4px gap
  <Badge />
  <Badge />
</div>

// Standard inline (button groups)
<div className="flex gap-2">  // 8px gap
  <Button />
  <Button />
</div>

// Spacious inline (navigation items)
<div className="flex gap-6">  // 24px gap
  <NavItem />
  <NavItem />
</div>
```

#### Container Padding

```tsx
// Compact containers
<div className="p-4">  // 16px all sides
  Content
</div>

// Standard containers (cards)
<div className="p-6">  // 24px all sides
  Content
</div>

// Large containers (modals, pages)
<div className="p-8">  // 32px all sides
  Content
</div>

// Responsive padding
<div className="p-4 md:p-6 lg:p-8">
  Content scales with viewport
</div>
```

#### Grid Gaps

```tsx
// Tight grid (compact data)
<div className="grid grid-cols-3 gap-2">  // 8px gap
  <GridItem />
</div>

// Standard grid (cards)
<div className="grid grid-cols-3 gap-4">  // 16px gap
  <Card />
</div>

// Spacious grid (feature showcase)
<div className="grid grid-cols-3 gap-6">  // 24px gap
  <Feature />
</div>
```

## Responsive Spacing

Use Tailwind's responsive prefixes to adjust spacing at different breakpoints:

```tsx
// Mobile-first responsive spacing
<div className="p-4 md:p-6 lg:p-8">
  Padding increases with viewport size
</div>

<div className="space-y-4 md:space-y-6 lg:space-y-8">
  Vertical spacing increases with viewport size
</div>

<div className="gap-2 md:gap-4 lg:gap-6">
  Grid/flex gap increases with viewport size
</div>
```

### Responsive Spacing Patterns

| Element Type | Mobile | Tablet | Desktop |
|--------------|--------|--------|---------|
| Page padding | `p-4` | `md:p-6` | `lg:p-8` |
| Card padding | `p-4` | `md:p-6` | `lg:p-6` |
| Section gaps | `space-y-6` | `md:space-y-8` | `lg:space-y-12` |
| Grid gaps | `gap-4` | `md:gap-6` | `lg:gap-8` |

## Negative Spacing

Use negative values for overlapping layouts:

```tsx
// Overlap effect
<div className="-mt-8">  // Negative 32px top margin
  Overlaps previous element
</div>

// Compensate for child spacing
<div className="-mx-4">  // Negative horizontal margin
  <div className="px-4">Child with padding</div>
</div>
```

## Best Practices

### DO

✅ **Use the spacing scale consistently**
```tsx
<div className="p-6 space-y-4">  // ✓ Using scale values
```

✅ **Use semantic names for clarity**
```tsx
<div className="gap-md">  // ✓ Clear intent
```

✅ **Stack responsive spacing**
```tsx
<div className="p-4 md:p-6 lg:p-8">  // ✓ Scales with viewport
```

✅ **Use component spacing tokens in custom components**
```tsx
import { componentSpacing } from '@/design-system/tokens/layout/spacing'

const CustomButton = styled.button`
  padding: ${componentSpacing.buttonPaddingY} ${componentSpacing.buttonPaddingX};
`
```

### DON'T

❌ **Use arbitrary values**
```tsx
<div className="p-[13px]">  // ✗ Not on the scale
```

❌ **Mix spacing systems**
```tsx
<div className="p-5">  // ✗ This is 20px, which is fine, but be consistent
<div className="p-[1.25rem]">  // ✗ Use spacing tokens instead
```

❌ **Use pixel values in CSS**
```tsx
.custom {
  padding: 17px;  // ✗ Use spacing tokens instead
}
```

❌ **Skip responsive considerations**
```tsx
<div className="p-12">  // ✗ Too large on mobile
```

## Accessibility Considerations

### Touch Targets

Ensure interactive elements meet minimum touch target sizes (44×44px):

```tsx
// Button with adequate touch target
<button className="px-4 py-2 min-h-[44px]">  // ✓ 16px + (2×8px) = 32px height + content
  Button
</button>

// Icon button with adequate touch target
<button className="p-3 min-w-[44px] min-h-[44px]">  // ✓ 44×44px minimum
  <Icon />
</button>
```

### Spacing for Readability

Adequate spacing improves readability and scannability:

```tsx
// Readable paragraph spacing
<div className="space-y-4">  // ✓ 16px between paragraphs
  <p>Paragraph 1</p>
  <p>Paragraph 2</p>
</div>

// Readable list spacing
<ul className="space-y-2">  // ✓ 8px between list items
  <li>Item 1</li>
  <li>Item 2</li>
</ul>
```

### Focus Indicators

Ensure focus indicators have adequate spacing:

```tsx
// Focus ring with offset
<button className="focus:ring-2 focus:ring-offset-2 focus:ring-border-focus">
  Button
</button>
```

## TypeScript Support

The spacing system is fully typed:

```tsx
import type { SpacingToken, SpacingSemanticToken } from '@/design-system/tokens/layout/spacing'

// Type-safe spacing usage
const buttonPadding: SpacingToken = '4'  // ✓ Valid
const buttonPadding: SpacingToken = '7'  // ✗ TypeScript error

// Semantic tokens
const gap: SpacingSemanticToken = 'md'  // ✓ Valid
const gap: SpacingSemanticToken = 'large'  // ✗ TypeScript error
```

## Migration from Hardcoded Values

If you're converting components from hardcoded spacing values:

### Common Conversions

| Old Value | New Token | Reasoning |
|-----------|-----------|-----------|
| `p-[10px]` | `p-2` or `p-3` | Use 8px or 12px from scale |
| `p-[14px]` | `p-3` or `p-4` | Use 12px or 16px from scale |
| `p-[18px]` | `p-4` or `p-5` | Use 16px or 20px from scale |
| `gap-[15px]` | `gap-4` | Use 16px (closest scale value) |
| `space-y-[25px]` | `space-y-6` | Use 24px (closest scale value) |

### Migration Steps

1. **Identify hardcoded spacing** - Look for arbitrary values like `p-[13px]`
2. **Find closest scale value** - Round to nearest value on the 4px scale
3. **Test visual appearance** - Ensure the change doesn't break layouts
4. **Update all instances** - Be consistent across similar components

## Common Questions

### Q: Why 4px as the base unit?

**A:** The 4px base unit is an industry standard because:
- It divides evenly into common viewport widths
- It scales well across different screen densities
- It provides enough granularity without being too restrictive
- It aligns with 8px design grids commonly used by designers

### Q: What if I need spacing that's not on the scale?

**A:** First, check if a nearby scale value works. The scale is designed to cover 95% of use cases. If you truly need a custom value:

1. Verify the design requirement
2. Check if a scale value can be adjusted
3. Use an arbitrary value as a last resort: `p-[13px]`
4. Document the reason in a code comment

### Q: Should I use numeric tokens or semantic names?

**A:**
- **Numeric tokens (`p-4`)**: More common, clearer mapping to pixel values
- **Semantic names (`gap-md`)**: Better for abstract concepts, easier to understand intent

Use whichever is clearer in context.

### Q: How do I handle spacing in custom CSS?

**A:** Import the spacing tokens:

```tsx
import { spacing } from '@/design-system/tokens/layout/spacing'

const CustomComponent = styled.div`
  padding: ${spacing['6']};  // 24px
  gap: ${spacing['4']};      // 16px
`
```

### Q: Can I use spacing tokens for width and height?

**A:** Yes, but only for spacing-related dimensions:

```tsx
// ✓ Good - spacing-based dimensions
<div className="w-8 h-8">Icon container</div>

// ✗ Avoid - use sizing tokens instead for content dimensions
<div className="w-64">Card</div>  // Use max-w-sm, max-w-md, etc.
```

## Examples

### Form Layout

```tsx
<form className="space-y-6">
  <div className="space-y-2">
    <label className="block text-sm font-medium">
      Email
    </label>
    <input className="px-3 py-2 border rounded" />
  </div>

  <div className="space-y-2">
    <label className="block text-sm font-medium">
      Password
    </label>
    <input className="px-3 py-2 border rounded" />
  </div>

  <button className="px-4 py-2 bg-interactive text-white rounded">
    Submit
  </button>
</form>
```

### Card Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <div className="p-6 bg-surface border border-default rounded-lg">
    <h3 className="text-lg font-semibold mb-2">Card Title</h3>
    <p className="text-secondary mb-4">Card description text.</p>
    <button className="px-4 py-2 bg-interactive text-white rounded">
      Action
    </button>
  </div>
  {/* More cards... */}
</div>
```

### Navigation Layout

```tsx
<nav className="flex items-center justify-between p-4 border-b border-default">
  <div className="flex items-center gap-8">
    <Logo />
    <div className="flex gap-6">
      <NavLink />
      <NavLink />
      <NavLink />
    </div>
  </div>

  <div className="flex items-center gap-2">
    <Button variant="ghost" className="px-3 py-2">
      Login
    </Button>
    <Button className="px-4 py-2">
      Sign Up
    </Button>
  </div>
</nav>
```

### Modal Layout

```tsx
<div className="fixed inset-0 flex items-center justify-center p-4">
  <div className="bg-overlay absolute inset-0" />
  <div className="relative bg-surface p-6 rounded-lg max-w-md w-full space-y-4">
    <h2 className="text-xl font-semibold">Modal Title</h2>
    <p className="text-secondary">Modal content goes here.</p>
    <div className="flex gap-2 justify-end">
      <button className="px-4 py-2 border border-default rounded">
        Cancel
      </button>
      <button className="px-4 py-2 bg-interactive text-white rounded">
        Confirm
      </button>
    </div>
  </div>
</div>
```

## Tools & Validation

### Visual Inspection

Use browser DevTools to inspect computed spacing values:

1. Open DevTools (F12)
2. Select element
3. Check "Computed" tab for actual pixel values
4. Verify values match the 4px scale

### ESLint Integration

While there's no specific ESLint rule for spacing (arbitrary values are sometimes necessary), you can:

1. Search for arbitrary spacing values: `p-\[.*px\]`
2. Review and convert to scale values where possible
3. Document reasons for keeping arbitrary values

## Related Documentation

- [Design Tokens Governance](../TOKENS.md) - Token management rules
- [Color System](./COLOR_SYSTEM.md) - Color token documentation
- [Tailwind Configuration](../../../tailwind.config.ts) - Full Tailwind setup

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-29 | Initial spacing system documentation |

---

**Last Updated:** 2025-12-29
**Status:** Active
**Issue:** #232 - Spacing scale follows consistent 4px base unit
