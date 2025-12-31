# Typography System

The FiskAI typography system provides a comprehensive, well-structured set of font stacks, sizes, weights, and pre-composed text styles that ensure consistent typography throughout the application.

## Table of Contents

- [Overview](#overview)
- [Font Stacks](#font-stacks)
- [Font Scale](#font-scale)
- [Text Styles](#text-styles)
- [Usage Examples](#usage-examples)
- [Tailwind Integration](#tailwind-integration)
- [Best Practices](#best-practices)

## Overview

The typography system is defined in `src/design-system/tokens/typography.ts` and provides three levels of abstraction:

1. **Base Tokens** - Font families, weights, sizes, line heights, and letter spacing
2. **Text Styles** - Pre-composed typography presets combining multiple properties
3. **Tailwind Classes** - Utility classes for easy application in components

### Architecture

```
typography.ts
├── Font Stacks (sans, heading, mono)
├── Font Weights (thin to black)
├── Font Sizes (2xs to 9xl)
├── Line Heights (none to loose)
├── Letter Spacing (tighter to widest)
└── Text Styles (display, heading, body, label, code)
```

## Font Stacks

The system uses three font families with comprehensive fallback stacks:

### Sans-Serif (Primary)

- **Token:** `fonts.sans`
- **Font:** Inter (via CSS variable)
- **Usage:** Body text, UI elements, general content
- **Fallbacks:** System UI fonts (native performance)

```tsx
font-family: var(--font-inter), ui-sans-serif, system-ui, -apple-system,
             BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
             Arial, sans-serif
```

### Heading

- **Token:** `fonts.heading`
- **Font:** Inter (via CSS variable)
- **Usage:** Headlines, section titles, display text
- **Note:** Currently uses same font as sans, but structured for future customization

### Monospace

- **Token:** `fonts.mono`
- **Font:** JetBrains Mono (via CSS variable)
- **Usage:** Code blocks, technical content, fixed-width data
- **Fallbacks:** System monospace fonts

```tsx
font-family: var(--font-jetbrains), ui-monospace, SFMono-Regular, "SF Mono",
             Menlo, Consolas, "Liberation Mono", monospace
```

### Zero CLS (Cumulative Layout Shift)

Fonts are loaded via `next/font` and use CSS variables, ensuring:

- Self-hosted fonts for performance and privacy
- Zero layout shift during font loading
- Optimal subset loading

## Font Scale

A comprehensive 14-size scale from 10px to 128px:

| Token  | Size (rem) | Size (px) | Usage                   |
| ------ | ---------- | --------- | ----------------------- |
| `2xs`  | 0.625rem   | 10px      | Fine print, legal text  |
| `xs`   | 0.75rem    | 12px      | Captions, metadata      |
| `sm`   | 0.875rem   | 14px      | Small body text, labels |
| `base` | 1rem       | 16px      | Default body text       |
| `lg`   | 1.125rem   | 18px      | Large body, subheadings |
| `xl`   | 1.25rem    | 20px      | Small headings          |
| `2xl`  | 1.5rem     | 24px      | Medium headings         |
| `3xl`  | 1.875rem   | 30px      | Large headings          |
| `4xl`  | 2.25rem    | 36px      | Section headings        |
| `5xl`  | 3rem       | 48px      | Page titles             |
| `6xl`  | 3.75rem    | 60px      | Hero text               |
| `7xl`  | 4.5rem     | 72px      | Large displays          |
| `8xl`  | 6rem       | 96px      | Extra large displays    |
| `9xl`  | 8rem       | 128px     | Hero banners            |

### Font Weights

| Token        | Value | Usage               |
| ------------ | ----- | ------------------- |
| `thin`       | 100   | Rarely used         |
| `extralight` | 200   | Decorative          |
| `light`      | 300   | Subtle text         |
| `normal`     | 400   | Body text (default) |
| `medium`     | 500   | Subtle emphasis     |
| `semibold`   | 600   | Headings, buttons   |
| `bold`       | 700   | Strong emphasis     |
| `extrabold`  | 800   | Extra emphasis      |
| `black`      | 900   | Maximum weight      |

### Line Heights

| Token     | Value | Usage                  |
| --------- | ----- | ---------------------- |
| `none`    | 1     | No leading             |
| `tight`   | 1.25  | Headings, display text |
| `snug`    | 1.375 | Subheadings            |
| `normal`  | 1.5   | Body text (default)    |
| `relaxed` | 1.625 | Comfortable reading    |
| `loose`   | 2     | Spacious layouts       |

### Letter Spacing

| Token     | Value    | Usage               |
| --------- | -------- | ------------------- |
| `tighter` | -0.05em  | Large display text  |
| `tight`   | -0.025em | Headings            |
| `normal`  | 0em      | Body text (default) |
| `wide`    | 0.025em  | All caps, labels    |
| `wider`   | 0.05em   | Loose tracking      |
| `widest`  | 0.1em    | Extra spacing       |

## Text Styles

Pre-composed typography presets that combine font family, size, weight, line height, and letter spacing for common use cases.

### Display Styles

Large, attention-grabbing text for hero sections and major headings.

| Style        | Size | Weight   | Line Height | Letter Spacing | Usage                        |
| ------------ | ---- | -------- | ----------- | -------------- | ---------------------------- |
| `display-xl` | 60px | bold     | tight       | tight          | Hero sections, landing pages |
| `display-lg` | 48px | bold     | tight       | tight          | Page titles, major sections  |
| `display-md` | 36px | bold     | tight       | tight          | Section headings             |
| `display-sm` | 30px | semibold | tight       | normal         | Subsection headings          |

**Example:**

```tsx
<h1 className="text-display-xl">Welcome to FiskAI</h1>
```

### Heading Styles

Semantic heading hierarchy for content structure.

| Style        | Size | Weight   | Line Height | Letter Spacing | HTML Equivalent    |
| ------------ | ---- | -------- | ----------- | -------------- | ------------------ |
| `heading-xl` | 24px | semibold | snug        | normal         | `<h1>`             |
| `heading-lg` | 20px | semibold | snug        | normal         | `<h2>`             |
| `heading-md` | 18px | semibold | snug        | normal         | `<h3>`             |
| `heading-sm` | 16px | semibold | snug        | normal         | `<h4>`             |
| `heading-xs` | 14px | semibold | snug        | wide           | `<h5>`, small caps |

**Example:**

```tsx
<h2 className="text-heading-lg">Section Title</h2>
<h3 className="text-heading-md">Subsection</h3>
```

### Body Styles

Body text for readable content.

| Style     | Size | Weight | Line Height | Letter Spacing | Usage                     |
| --------- | ---- | ------ | ----------- | -------------- | ------------------------- |
| `body-lg` | 18px | normal | relaxed     | normal         | Large body, introductions |
| `body-md` | 16px | normal | normal      | normal         | Default body text         |
| `body-sm` | 14px | normal | normal      | normal         | Small body, descriptions  |
| `body-xs` | 12px | normal | normal      | normal         | Fine print, metadata      |

**Example:**

```tsx
<p className="text-body-md">This is the default paragraph text.</p>
<p className="text-body-sm text-secondary">Additional context.</p>
```

### Label Styles

Medium-weight text for form labels, UI elements, and navigation.

| Style      | Size | Weight | Line Height | Letter Spacing | Usage                |
| ---------- | ---- | ------ | ----------- | -------------- | -------------------- |
| `label-lg` | 16px | medium | normal      | normal         | Large labels, tabs   |
| `label-md` | 14px | medium | normal      | normal         | Form labels, buttons |
| `label-sm` | 12px | medium | normal      | normal         | Small labels, tags   |

**Example:**

```tsx
<label className="text-label-md">Email Address</label>
<span className="text-label-sm text-accent">NEW</span>
```

### Code Styles

Monospace text for code and technical content.

| Style     | Size | Weight | Line Height | Letter Spacing | Usage                       |
| --------- | ---- | ------ | ----------- | -------------- | --------------------------- |
| `code-lg` | 16px | normal | relaxed     | normal         | Large code blocks           |
| `code-md` | 14px | normal | relaxed     | normal         | Default code                |
| `code-sm` | 12px | normal | relaxed     | normal         | Inline code, small snippets |

**Example:**

```tsx
<code className="text-code-md">const example = "code";</code>
<pre className="text-code-sm">{ JSON.stringify(data) }</pre>
```

## Usage Examples

### Component Usage

The typography system is used consistently throughout the application:

#### Card Component

```tsx
// src/components/ui/card.tsx
<h3 className="text-heading-md text-foreground">Card Title</h3>
<p className="text-body-sm text-secondary">Card description</p>
```

#### Section Heading Pattern

```tsx
// src/components/patterns/SectionHeading.tsx
<span className="text-label-sm text-accent uppercase tracking-wider">
  Section Label
</span>
<h2 className="text-display-md text-foreground">Section Title</h2>
```

#### Button Component

```tsx
// src/components/ui/button.tsx
<button className="text-label-md font-medium">Click Me</button>
```

### Complete Example

```tsx
<article className="bg-surface p-6 rounded-lg">
  {/* Category Label */}
  <span className="text-label-sm text-accent uppercase">Announcement</span>

  {/* Article Title */}
  <h1 className="text-display-md text-foreground mt-2">New Features Released</h1>

  {/* Meta Information */}
  <p className="text-body-xs text-tertiary mt-2">Published on December 29, 2025</p>

  {/* Introduction */}
  <p className="text-body-lg text-secondary mt-4">
    We're excited to announce several new features that will improve your workflow.
  </p>

  {/* Body Content */}
  <div className="text-body-md text-foreground mt-4 space-y-4">
    <p>Regular paragraph content goes here...</p>

    {/* Subsection */}
    <h2 className="text-heading-lg mt-6">Feature Details</h2>
    <p>More detailed information...</p>

    {/* Code Example */}
    <code className="text-code-md bg-surface-1 px-2 py-1 rounded">npm install @fiskai/sdk</code>
  </div>
</article>
```

## Tailwind Integration

Text styles are automatically exposed as Tailwind utility classes through a custom plugin in `tailwind.config.ts`:

```tsx
// Generates classes like:
.text-display-xl {
  font-size: 3.75rem;      /* 60px */
  line-height: 1.25;        /* tight */
  font-weight: 700;         /* bold */
  letter-spacing: -0.025em; /* tight */
  font-family: var(--font-inter), ...;
}

.text-heading-md {
  font-size: 1.125rem;      /* 18px */
  line-height: 1.375;       /* snug */
  font-weight: 600;         /* semibold */
  letter-spacing: 0em;      /* normal */
  font-family: var(--font-inter), ...;
}

.text-body-md {
  font-size: 1rem;          /* 16px */
  line-height: 1.5;         /* normal */
  font-weight: 400;         /* normal */
  letter-spacing: 0em;      /* normal */
  font-family: var(--font-inter), ...;
}
```

### IntelliSense Support

TypeScript types ensure autocomplete for all text styles:

```tsx
import type { TextStyleName } from "@/design-system"

// TextStyleName = "display-xl" | "display-lg" | ... | "code-sm"
const style: TextStyleName = "heading-md" // ✓ Type-safe
```

## Best Practices

### 1. Use Semantic Styles

Choose text styles based on semantic meaning, not just appearance:

```tsx
// GOOD - Semantic usage
<h1 className="text-display-lg">Page Title</h1>
<h2 className="text-heading-xl">Section</h2>
<p className="text-body-md">Content</p>

// AVOID - Size-based selection
<div className="text-2xl">Page Title</div>  // What is this semantically?
```

### 2. Combine with Color Tokens

Always pair typography styles with semantic color tokens:

```tsx
// GOOD - Complete semantic system
<h2 className="text-heading-lg text-foreground">Primary Heading</h2>
<p className="text-body-sm text-secondary">Supporting text</p>
<span className="text-label-sm text-muted">Disabled</span>

// AVOID - Mixing systems
<h2 className="text-heading-lg text-foreground">Heading</h2>
```

### 3. Maintain Hierarchy

Use the appropriate style for the content hierarchy:

```tsx
// GOOD - Clear hierarchy
<h1 className="text-display-xl">Main Title</h1>
<h2 className="text-heading-xl">Section</h2>
<h3 className="text-heading-lg">Subsection</h3>
<p className="text-body-md">Content</p>

// AVOID - Skipping levels or inconsistent sizing
<h1 className="text-display-xl">Main Title</h1>
<h3 className="text-heading-sm">Section</h3>  // Too small jump
```

### 4. Use Labels for UI Elements

Reserve label styles for interactive UI elements:

```tsx
// GOOD
<button className="text-label-md">Submit</button>
<label className="text-label-md">Email</label>
<span className="text-label-sm">Badge</span>

// AVOID - Using body text for UI
<button className="text-body-md">Submit</button>  // Less emphasis
```

### 5. Code Styles for Technical Content

Use monospace code styles only for technical content:

```tsx
// GOOD
<code className="text-code-md">npm install</code>
<pre className="text-code-sm">{JSON.stringify(data)}</pre>

// AVOID - Using code fonts for design
<span className="font-mono">Not code content</span>
```

### 6. Responsive Typography

Adjust text styles for different screen sizes when needed:

```tsx
<h1 className="text-display-md md:text-display-lg lg:text-display-xl">
  Responsive Heading
</h1>

<p className="text-body-sm md:text-body-md">
  Responsive body text
</p>
```

### 7. Avoid Manual Overrides

Don't override text style properties manually:

```tsx
// GOOD - Use the right style
<h2 className="text-heading-lg">Title</h2>

// AVOID - Overriding style properties
<h2 className="text-heading-md text-xl">Title</h2>  // Conflicting sizes
<h2 className="text-heading-md leading-tight">Title</h2>  // Overriding line-height
```

### 8. Test in Dark Mode

Always verify typography in both light and dark modes, especially when combined with color tokens:

```tsx
// Color tokens handle dark mode automatically
<p className="text-body-md text-foreground">Readable in both modes</p>
```

## Common Patterns

### Hero Section

```tsx
<section className="text-center">
  <span className="text-label-sm text-accent uppercase tracking-wider">New Release</span>
  <h1 className="text-display-xl text-foreground mt-4">Welcome to FiskAI</h1>
  <p className="text-body-lg text-secondary mt-6 max-w-2xl mx-auto">
    Modern accounting software for Croatian businesses
  </p>
</section>
```

### Card with Content

```tsx
<div className="bg-surface rounded-lg p-6">
  <h3 className="text-heading-md text-foreground">Feature Name</h3>
  <p className="text-body-sm text-secondary mt-2">Description of the feature and its benefits.</p>
  <a href="#" className="text-label-md text-link mt-4 inline-block">
    Learn More
  </a>
</div>
```

### Form Field

```tsx
<div className="space-y-2">
  <label className="text-label-md text-foreground">Email Address</label>
  <input type="email" className="text-body-md" placeholder="you@example.com" />
  <p className="text-body-xs text-tertiary">We'll never share your email.</p>
</div>
```

### Status Message

```tsx
<div className="bg-success-bg border border-success-border rounded-lg p-4">
  <p className="text-label-md text-success-text">Success!</p>
  <p className="text-body-sm text-success-text mt-1">Your changes have been saved.</p>
</div>
```

## TypeScript Types

All typography tokens are fully typed for IDE autocomplete and type safety:

```tsx
import type {
  FontFamily, // "sans" | "heading" | "mono"
  FontWeight, // "thin" | "extralight" | ... | "black"
  FontSize, // "2xs" | "xs" | ... | "9xl"
  LineHeight, // "none" | "tight" | ... | "loose"
  LetterSpacing, // "tighter" | "tight" | ... | "widest"
  TextStyleName, // "display-xl" | "heading-lg" | "body-md" | ...
  TextStyle, // Full text style interface
  Typography, // Complete typography system type
} from "@/design-system"
```

## Migration Guide

If migrating from manual font sizing to the typography system:

### Before

```tsx
<h1 className="text-4xl font-bold leading-tight tracking-tight">
  Title
</h1>
<p className="text-base leading-relaxed">
  Content
</p>
```

### After

```tsx
<h1 className="text-display-md">
  Title
</h1>
<p className="text-body-md">
  Content
</p>
```

Benefits:

- Single class instead of 3-4 classes
- Consistent with design system
- Semantic naming
- Easier maintenance
- Type-safe

## Resources

- **Token Definition:** `src/design-system/tokens/typography.ts`
- **Tailwind Config:** `tailwind.config.ts` (typography plugin)
- **CSS Variables:** `src/design-system/css/variables.css`
- **Type Definitions:** `src/design-system/types.ts`
- **Usage Examples:** Component library in `src/components/`

## Related Documentation

- [Design System Overview](./README.md)
- [Token Governance](./TOKENS.md)
- [Color System](./tokens/semantic/colors.ts)
- [Spacing System](./tokens/layout/spacing.ts)
