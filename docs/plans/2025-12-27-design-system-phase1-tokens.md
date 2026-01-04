# Phase 1: Design System Token Files

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create all token files that form the foundation of the design system.

**Architecture:** 5-layer token system with primitives at base, semantic tokens for UI purposes, layout tokens for spacing/radius, and specialized tokens for typography/motion/charts.

**Tech Stack:** TypeScript

---

## Task 1: Create Directory Structure

**Files:**

- Create: `src/design-system/tokens/` directory
- Create: `src/design-system/tokens/semantic/` directory
- Create: `src/design-system/tokens/layout/` directory

**Step 1: Create directories**

```bash
mkdir -p src/design-system/tokens/semantic
mkdir -p src/design-system/tokens/layout
mkdir -p src/design-system/eslint
mkdir -p src/design-system/css
```

**Step 2: Verify structure**

```bash
ls -la src/design-system/
```

Expected: `tokens/`, `eslint/`, `css/` directories exist

---

## Task 2: Create Primitives Token File

**Files:**

- Create: `src/design-system/tokens/primitives.ts`

**Step 1: Create primitives.ts**

```typescript
/**
 * PRIMITIVES - Raw color values
 *
 * NEVER import these directly in components.
 * Use semantic tokens instead.
 *
 * These are contrast-first, perceptually balanced values.
 */

export const primitives = {
  // Primary - Blue (trust, professionalism, finance)
  blue: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6", // Primary (WCAG AA on white)
    600: "#2563eb", // Primary hover
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
  },

  // Neutrals - Slate (cool-toned to complement blue)
  slate: {
    25: "#f8fafc", // Lightest surface
    50: "#f1f5f9", // Light surface
    100: "#e2e8f0", // Borders (light)
    200: "#cbd5e1", // Stronger borders
    300: "#94a3b8", // Muted text (light mode)
    400: "#64748b", // Secondary text
    500: "#475569", // Body text (light mode)
    600: "#334155", // Borders (dark mode)
    700: "#1e293b", // Surface (dark mode)
    800: "#0f172a", // Deep surface
    900: "#020617", // Darkest
  },

  // Success - Emerald
  emerald: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
  },

  // Warning - Amber
  amber: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  },

  // Danger - Red
  red: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
  },

  // Accent - Cyan (for marketing highlights)
  cyan: {
    50: "#ecfeff",
    100: "#cffafe",
    200: "#a5f3fc",
    300: "#67e8f9",
    400: "#22d3ee",
    500: "#06b6d4",
    600: "#0891b2",
    700: "#0e7490",
    800: "#155e75",
    900: "#164e63",
  },

  // Pure values
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const

export type Primitives = typeof primitives
```

**Step 2: Verify file compiles**

```bash
npx tsc src/design-system/tokens/primitives.ts --noEmit --skipLibCheck
```

Expected: No errors

---

## Task 3: Create Semantic Surface Tokens

**Files:**

- Create: `src/design-system/tokens/semantic/surfaces.ts`

**Step 1: Create surfaces.ts**

```typescript
/**
 * SURFACE TOKENS - The "Surface Ladder"
 *
 * Defines background colors for different elevation levels.
 * Use these for cards, modals, page backgrounds, etc.
 */

import { primitives } from "../primitives"

export const surfaces = {
  light: {
    /** Page background */
    base: primitives.slate[25],
    /** Cards, containers (default) */
    surface0: primitives.white,
    /** Nested cards, hover states */
    surface1: primitives.slate[50],
    /** Deeper nesting, active states */
    surface2: primitives.slate[100],
    /** Modals, dropdowns (use with shadow) */
    elevated: primitives.white,
    /** Behind modals */
    overlay: "rgba(15, 23, 42, 0.4)",
  },
  dark: {
    /** Page background */
    base: primitives.slate[900],
    /** Cards, containers */
    surface0: primitives.slate[800],
    /** Nested cards, hover states */
    surface1: primitives.slate[700],
    /** Deeper nesting, active states */
    surface2: primitives.slate[600],
    /** Modals, dropdowns */
    elevated: primitives.slate[700],
    /** Behind modals */
    overlay: "rgba(0, 0, 0, 0.6)",
  },
} as const

export type Surfaces = typeof surfaces
```

**Step 2: Verify file compiles**

```bash
npx tsc src/design-system/tokens/semantic/surfaces.ts --noEmit --skipLibCheck
```

---

## Task 4: Create Semantic Text Tokens

**Files:**

- Create: `src/design-system/tokens/semantic/text.ts`

**Step 1: Create text.ts**

```typescript
/**
 * TEXT TOKENS - Text Hierarchy
 *
 * Defines text colors for different purposes.
 * Use these instead of arbitrary gray values.
 */

import { primitives } from "../primitives"

export const text = {
  light: {
    /** Headings, important text */
    primary: primitives.slate[900],
    /** Body text */
    secondary: primitives.slate[600],
    /** Captions, hints */
    tertiary: primitives.slate[500],
    /** Disabled states */
    disabled: primitives.slate[400],
    /** Text on dark backgrounds */
    inverse: primitives.white,
    /** Links, clickable text */
    link: primitives.blue[600],
    // Status text
    success: primitives.emerald[700],
    warning: primitives.amber[700],
    danger: primitives.red[700],
  },
  dark: {
    /** Headings, important text */
    primary: primitives.slate[25],
    /** Body text */
    secondary: primitives.slate[300],
    /** Captions, hints */
    tertiary: primitives.slate[400],
    /** Disabled states */
    disabled: primitives.slate[500],
    /** Text on light backgrounds */
    inverse: primitives.slate[900],
    /** Links, clickable text */
    link: primitives.blue[400],
    // Status text
    success: primitives.emerald[500],
    warning: primitives.amber[500],
    danger: primitives.red[500],
  },
} as const

export type TextColors = typeof text
```

---

## Task 5: Create Semantic Border Tokens

**Files:**

- Create: `src/design-system/tokens/semantic/borders.ts`

**Step 1: Create borders.ts**

```typescript
/**
 * BORDER TOKENS
 *
 * Defines border colors for different contexts.
 */

import { primitives } from "../primitives"

export const borders = {
  light: {
    /** Default borders */
    default: primitives.slate[200],
    /** Subtle borders */
    subtle: primitives.slate[100],
    /** Strong/emphasized borders */
    strong: primitives.slate[300],
    /** Focus ring color */
    focus: primitives.blue[500],
    // Status borders
    success: primitives.emerald[200],
    warning: primitives.amber[200],
    danger: primitives.red[300],
  },
  dark: {
    /** Default borders */
    default: primitives.slate[600],
    /** Subtle borders */
    subtle: primitives.slate[700],
    /** Strong/emphasized borders */
    strong: primitives.slate[500],
    /** Focus ring color */
    focus: primitives.blue[400],
    // Status borders
    success: primitives.emerald[600],
    warning: primitives.amber[600],
    danger: primitives.red[600],
  },
} as const

export type BorderColors = typeof borders
```

---

## Task 6: Create Semantic Interactive Tokens

**Files:**

- Create: `src/design-system/tokens/semantic/interactive.ts`

**Step 1: Create interactive.ts**

```typescript
/**
 * INTERACTIVE TOKENS
 *
 * Defines colors for interactive elements (buttons, links, etc.)
 */

import { primitives } from "../primitives"

export const interactive = {
  light: {
    /** Primary button background */
    primary: primitives.blue[600],
    /** Primary button hover */
    primaryHover: primitives.blue[700],
    /** Secondary button background */
    secondary: primitives.white,
    /** Secondary button hover */
    secondaryHover: primitives.slate[50],
    /** Danger button background */
    danger: primitives.red[600],
    /** Danger button hover */
    dangerHover: primitives.red[700],
    /** Ghost button background */
    ghost: primitives.transparent,
    /** Ghost button hover */
    ghostHover: primitives.slate[100],
  },
  dark: {
    /** Primary button background */
    primary: primitives.blue[500],
    /** Primary button hover */
    primaryHover: primitives.blue[400],
    /** Secondary button background */
    secondary: primitives.slate[700],
    /** Secondary button hover */
    secondaryHover: primitives.slate[600],
    /** Danger button background */
    danger: primitives.red[600],
    /** Danger button hover */
    dangerHover: primitives.red[500],
    /** Ghost button background */
    ghost: primitives.transparent,
    /** Ghost button hover */
    ghostHover: primitives.slate[700],
  },
} as const

export type InteractiveColors = typeof interactive
```

---

## Task 7: Create Semantic Colors Index

**Files:**

- Create: `src/design-system/tokens/semantic/colors.ts`

**Step 1: Create colors.ts**

```typescript
/**
 * STATUS COLORS
 *
 * Pre-bundled status color combinations (bg, text, border).
 */

import { primitives } from "../primitives"

export const statusColors = {
  light: {
    success: {
      bg: primitives.emerald[50],
      text: primitives.emerald[700],
      border: primitives.emerald[200],
      icon: primitives.emerald[600],
    },
    warning: {
      bg: primitives.amber[50],
      text: primitives.amber[700],
      border: primitives.amber[200],
      icon: primitives.amber[600],
    },
    danger: {
      bg: primitives.red[50],
      text: primitives.red[700],
      border: primitives.red[300],
      icon: primitives.red[600],
    },
    info: {
      bg: primitives.blue[50],
      text: primitives.blue[700],
      border: primitives.blue[200],
      icon: primitives.blue[600],
    },
  },
  dark: {
    success: {
      bg: "rgba(16, 185, 129, 0.1)",
      text: primitives.emerald[400],
      border: primitives.emerald[600],
      icon: primitives.emerald[500],
    },
    warning: {
      bg: "rgba(245, 158, 11, 0.1)",
      text: primitives.amber[400],
      border: primitives.amber[600],
      icon: primitives.amber[500],
    },
    danger: {
      bg: "rgba(239, 68, 68, 0.1)",
      text: primitives.red[400],
      border: primitives.red[600],
      icon: primitives.red[500],
    },
    info: {
      bg: "rgba(59, 130, 246, 0.1)",
      text: primitives.blue[400],
      border: primitives.blue[600],
      icon: primitives.blue[500],
    },
  },
} as const

export type StatusColors = typeof statusColors
```

---

## Task 8: Create Semantic Index

**Files:**

- Create: `src/design-system/tokens/semantic/index.ts`

**Step 1: Create index.ts**

```typescript
/**
 * SEMANTIC TOKENS - All semantic tokens re-exported
 */

export { surfaces } from "./surfaces"
export { text } from "./text"
export { borders } from "./borders"
export { interactive } from "./interactive"
export { statusColors } from "./colors"

export type { Surfaces } from "./surfaces"
export type { TextColors } from "./text"
export type { BorderColors } from "./borders"
export type { InteractiveColors } from "./interactive"
export type { StatusColors } from "./colors"
```

---

## Task 9: Create Layout Spacing Tokens

**Files:**

- Create: `src/design-system/tokens/layout/spacing.ts`

**Step 1: Create spacing.ts**

```typescript
/**
 * SPACING TOKENS - 4px base unit
 *
 * Use these for padding, margin, and gap values.
 * Avoids arbitrary values like p-[15px].
 */

export const spacing = {
  0: "0px",
  0.5: "2px", // Micro adjustments
  1: "4px", // Atomic unit
  1.5: "6px",
  2: "8px", // Tight
  2.5: "10px",
  3: "12px", // Default gap
  3.5: "14px",
  4: "16px", // Standard padding
  5: "20px",
  6: "24px", // Section padding
  7: "28px",
  8: "32px", // Large gap
  9: "36px",
  10: "40px",
  11: "44px",
  12: "48px", // Section margins
  14: "56px",
  16: "64px", // Page sections
  20: "80px",
  24: "96px", // Hero spacing
  28: "112px",
  32: "128px",
} as const

export type Spacing = typeof spacing
export type SpacingKey = keyof typeof spacing
```

---

## Task 10: Create Layout Radius Tokens

**Files:**

- Create: `src/design-system/tokens/layout/radius.ts`

**Step 1: Create radius.ts**

```typescript
/**
 * RADIUS TOKENS - Border radius scale
 *
 * Use these for consistent rounded corners.
 */

export const radius = {
  none: "0px",
  sm: "4px", // Badges, small buttons
  md: "8px", // Buttons, inputs (DEFAULT)
  lg: "12px", // Cards
  xl: "16px", // Modals
  "2xl": "24px", // Large cards
  "3xl": "32px", // Extra large
  full: "9999px", // Pills, avatars
} as const

export type Radius = typeof radius
export type RadiusKey = keyof typeof radius
```

---

## Task 11: Create Layout Elevation Tokens

**Files:**

- Create: `src/design-system/tokens/layout/elevation.ts`

**Step 1: Create elevation.ts**

```typescript
/**
 * ELEVATION TOKENS - Shadows and z-index
 *
 * Use these for consistent depth and layering.
 */

export const shadows = {
  none: "none",
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
  "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  // Glow effects
  focus: "0 0 0 3px rgba(59, 130, 246, 0.3)",
  focusDark: "0 0 0 3px rgba(96, 165, 250, 0.3)",
  glow: "0 0 40px rgba(99, 102, 241, 0.35)",
  // Card shadows
  card: "0 10px 30px rgba(15, 23, 42, 0.08)",
  cardHover: "0 25px 50px rgba(15, 23, 42, 0.12)",
  elevated: "0 35px 60px rgba(15, 23, 42, 0.25)",
} as const

export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  modal: 300,
  toast: 400, // Nothing beats toast
  tooltip: 500,
} as const

export type Shadows = typeof shadows
export type ZIndex = typeof zIndex
```

---

## Task 12: Create Layout Index

**Files:**

- Create: `src/design-system/tokens/layout/index.ts`

**Step 1: Create index.ts**

```typescript
/**
 * LAYOUT TOKENS - All layout tokens re-exported
 */

export { spacing } from "./spacing"
export { radius } from "./radius"
export { shadows, zIndex } from "./elevation"

export type { Spacing, SpacingKey } from "./spacing"
export type { Radius, RadiusKey } from "./radius"
export type { Shadows, ZIndex } from "./elevation"
```

---

## Task 13: Create Typography Tokens

**Files:**

- Create: `src/design-system/tokens/typography.ts`

**Step 1: Create typography.ts**

```typescript
/**
 * TYPOGRAPHY TOKENS
 *
 * Pre-composed text styles for consistent typography.
 * Use .text-heading-xl, .text-body-base, etc.
 */

export const fonts = {
  sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  heading: ["Sora", "Inter", "sans-serif"],
  mono: ["JetBrains Mono", "Menlo", "Monaco", "Consolas", "monospace"],
} as const

export const fontWeights = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const

/**
 * Pre-composed text styles
 * These combine font-size, line-height, weight, and letter-spacing
 */
export const textStyles = {
  // Display (marketing, heroes)
  "display-xl": {
    fontSize: "60px",
    lineHeight: "72px",
    fontWeight: fontWeights.bold,
    letterSpacing: "-0.02em",
    fontFamily: fonts.heading.join(", "),
  },
  "display-lg": {
    fontSize: "48px",
    lineHeight: "56px",
    fontWeight: fontWeights.bold,
    letterSpacing: "-0.02em",
    fontFamily: fonts.heading.join(", "),
  },
  "display-md": {
    fontSize: "36px",
    lineHeight: "44px",
    fontWeight: fontWeights.bold,
    letterSpacing: "-0.02em",
    fontFamily: fonts.heading.join(", "),
  },

  // Headings (app content)
  "heading-xl": {
    fontSize: "32px",
    lineHeight: "40px",
    fontWeight: fontWeights.bold,
    letterSpacing: "-0.01em",
    fontFamily: fonts.heading.join(", "),
  },
  "heading-lg": {
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: fontWeights.semibold,
    letterSpacing: "-0.01em",
    fontFamily: fonts.heading.join(", "),
  },
  "heading-md": {
    fontSize: "20px",
    lineHeight: "28px",
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.heading.join(", "),
  },
  "heading-sm": {
    fontSize: "16px",
    lineHeight: "24px",
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.heading.join(", "),
  },
  "heading-xs": {
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: fontWeights.semibold,
    fontFamily: fonts.heading.join(", "),
  },

  // Body
  "body-lg": {
    fontSize: "18px",
    lineHeight: "28px",
    fontWeight: fontWeights.normal,
    fontFamily: fonts.sans.join(", "),
  },
  "body-base": {
    fontSize: "16px",
    lineHeight: "24px",
    fontWeight: fontWeights.normal,
    fontFamily: fonts.sans.join(", "),
  },
  "body-sm": {
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: fontWeights.normal,
    fontFamily: fonts.sans.join(", "),
  },
  "body-xs": {
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: fontWeights.normal,
    fontFamily: fonts.sans.join(", "),
  },

  // UI-specific
  label: {
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: fontWeights.medium,
    fontFamily: fonts.sans.join(", "),
  },
  "label-sm": {
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: fontWeights.medium,
    fontFamily: fonts.sans.join(", "),
  },
  caption: {
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: fontWeights.normal,
    fontFamily: fonts.sans.join(", "),
  },
  overline: {
    fontSize: "11px",
    lineHeight: "16px",
    fontWeight: fontWeights.semibold,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    fontFamily: fonts.sans.join(", "),
  },

  // Code
  code: {
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: fontWeights.normal,
    fontFamily: fonts.mono.join(", "),
  },
  "code-sm": {
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: fontWeights.normal,
    fontFamily: fonts.mono.join(", "),
  },
} as const

export type Fonts = typeof fonts
export type TextStyles = typeof textStyles
export type TextStyleKey = keyof typeof textStyles
```

---

## Task 14: Create Motion Tokens

**Files:**

- Create: `src/design-system/tokens/motion.ts`

**Step 1: Create motion.ts**

```typescript
/**
 * MOTION TOKENS - Animation system
 *
 * Intent-based animation with reduced-motion support.
 */

export const duration = {
  instant: "0ms",
  fastest: "50ms",
  fast: "100ms",
  normal: "150ms",
  slow: "200ms",
  slower: "300ms",
  slowest: "500ms",
} as const

export const easing = {
  linear: "linear",
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  // Expressive
  spring: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  smooth: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  snappy: "cubic-bezier(0.2, 0, 0, 1)",
} as const

/**
 * Intent-based animation patterns
 * Use these instead of arbitrary duration/easing combinations
 */
export const intent = {
  /** Elements appearing on screen */
  entrance: {
    duration: duration.normal,
    easing: easing.easeOut,
  },
  /** Elements leaving screen */
  exit: {
    duration: duration.fast,
    easing: easing.easeIn,
  },
  /** User interactions (button press, toggle) */
  feedback: {
    duration: duration.fast,
    easing: easing.easeInOut,
  },
  /** Drawing attention */
  attention: {
    duration: duration.slow,
    easing: easing.spring,
  },
  /** Loading states */
  loading: {
    duration: duration.slower,
    easing: easing.linear,
  },
} as const

/**
 * Reduced motion configuration
 * When prefers-reduced-motion is set, use these values
 */
export const reducedMotion = {
  /** Strategy: make all animations instant */
  strategy: "instant" as const,
  /** Exceptions: these animations still run (for accessibility) */
  exceptions: ["loading"] as const,
}

/**
 * Keyframe definitions for common animations
 */
export const keyframes = {
  fadeIn: {
    from: { opacity: "0" },
    to: { opacity: "1" },
  },
  fadeOut: {
    from: { opacity: "1" },
    to: { opacity: "0" },
  },
  scaleIn: {
    from: { transform: "scale(0.95)", opacity: "0" },
    to: { transform: "scale(1)", opacity: "1" },
  },
  scaleOut: {
    from: { transform: "scale(1)", opacity: "1" },
    to: { transform: "scale(0.95)", opacity: "0" },
  },
  slideUp: {
    from: { transform: "translateY(8px)", opacity: "0" },
    to: { transform: "translateY(0)", opacity: "1" },
  },
  slideDown: {
    from: { transform: "translateY(-8px)", opacity: "0" },
    to: { transform: "translateY(0)", opacity: "1" },
  },
  slideInRight: {
    from: { transform: "translateX(100%)", opacity: "0" },
    to: { transform: "translateX(0)", opacity: "1" },
  },
  slideInLeft: {
    from: { transform: "translateX(-100%)", opacity: "0" },
    to: { transform: "translateX(0)", opacity: "1" },
  },
} as const

export type Duration = typeof duration
export type Easing = typeof easing
export type Intent = typeof intent
export type Keyframes = typeof keyframes
```

---

## Task 15: Create Data Visualization Tokens

**Files:**

- Create: `src/design-system/tokens/data-vis.ts`

**Step 1: Create data-vis.ts**

```typescript
/**
 * DATA VISUALIZATION TOKENS
 *
 * Categorical palette for charts/graphs.
 * DISTINCT from semantic status colors to avoid confusion
 * (e.g., red in a chart doesn't mean "danger").
 */

export const categorical = {
  /** Series 1 - Indigo (NOT Blue to avoid interactive confusion) */
  series1: "#6366f1",
  /** Series 2 - Violet */
  series2: "#8b5cf6",
  /** Series 3 - Pink */
  series3: "#ec4899",
  /** Series 4 - Teal (NOT Cyan to avoid accent confusion) */
  series4: "#14b8a6",
  /** Series 5 - Orange */
  series5: "#f97316",
  /** Series 6 - Lime */
  series6: "#84cc16",
  /** Series 7 - Cyan */
  series7: "#06b6d4",
  /** Series 8 - Rose */
  series8: "#f43f5e",
} as const

/** Sequential palette for heatmaps, gradients */
export const sequential = {
  blue: ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1e40af"],
  emerald: ["#ecfdf5", "#a7f3d0", "#34d399", "#059669", "#065f46"],
} as const

/** Diverging palette for positive/negative comparisons */
export const diverging = {
  negative: "#ef4444",
  neutral: "#94a3b8",
  positive: "#22c55e",
} as const

/** Chart UI elements */
export const chartElements = {
  grid: "rgba(148, 163, 184, 0.2)",
  axis: "#64748b",
  tooltip: {
    bg: "#0f172a",
    text: "#f8fafc",
    border: "#334155",
  },
  crosshair: "rgba(59, 130, 246, 0.5)",
} as const

export type Categorical = typeof categorical
export type Sequential = typeof sequential
export type Diverging = typeof diverging
export type ChartElements = typeof chartElements
```

---

## Task 16: Create Main Token Index

**Files:**

- Create: `src/design-system/tokens/index.ts`

**Step 1: Create tokens index.ts**

```typescript
/**
 * DESIGN SYSTEM TOKENS
 *
 * Main entry point for all design tokens.
 * Import from here for type-safe access.
 */

// Primitives (internal use only - don't export to components)
export { primitives } from "./primitives"

// Semantic tokens
export * from "./semantic"

// Layout tokens
export * from "./layout"

// Typography
export {
  fonts,
  fontWeights,
  textStyles,
  type Fonts,
  type TextStyles,
  type TextStyleKey,
} from "./typography"

// Motion
export {
  duration,
  easing,
  intent,
  reducedMotion,
  keyframes,
  type Duration,
  type Easing,
  type Intent,
  type Keyframes,
} from "./motion"

// Data visualization
export {
  categorical,
  sequential,
  diverging,
  chartElements,
  type Categorical,
  type Sequential,
  type Diverging,
  type ChartElements,
} from "./data-vis"
```

---

## Task 17: Create Design System Types

**Files:**

- Create: `src/design-system/types.ts`

**Step 1: Create types.ts**

```typescript
/**
 * DESIGN SYSTEM TYPES
 *
 * TypeScript types for type-safe component props.
 */

// Semantic text colors that components can use
export type SemanticTextColor =
  | "primary"
  | "secondary"
  | "tertiary"
  | "disabled"
  | "inverse"
  | "link"
  | "success"
  | "warning"
  | "danger"

// Semantic background colors
export type SemanticBgColor =
  | "base"
  | "surface"
  | "surface-1"
  | "surface-2"
  | "elevated"
  | "interactive"
  | "interactive-hover"
  | "success"
  | "warning"
  | "danger"

// Semantic border colors
export type SemanticBorderColor =
  | "default"
  | "subtle"
  | "strong"
  | "focus"
  | "success"
  | "warning"
  | "danger"

// Status variants
export type StatusVariant = "success" | "warning" | "danger" | "info"

// Button variants
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "link"

// Badge variants
export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral"

// Size variants
export type SizeVariant = "sm" | "md" | "lg"

// Text style variants
export type TextStyleVariant =
  | "display-xl"
  | "display-lg"
  | "display-md"
  | "heading-xl"
  | "heading-lg"
  | "heading-md"
  | "heading-sm"
  | "heading-xs"
  | "body-lg"
  | "body-base"
  | "body-sm"
  | "body-xs"
  | "label"
  | "label-sm"
  | "caption"
  | "overline"
  | "code"
  | "code-sm"

// Chart series
export type ChartSeries =
  | "series1"
  | "series2"
  | "series3"
  | "series4"
  | "series5"
  | "series6"
  | "series7"
  | "series8"
```

---

## Task 18: Create Design System Main Export

**Files:**

- Create: `src/design-system/index.ts`

**Step 1: Create main index.ts**

```typescript
/**
 * FISK AI DESIGN SYSTEM
 *
 * Main entry point.
 *
 * @example
 * import { textStyles, categorical, type ButtonVariant } from '@/design-system';
 */

// Tokens
export * from "./tokens"

// Types
export * from "./types"
```

---

## Task 19: Verify All Files Compile

**Step 1: Run TypeScript check on design-system directory**

```bash
npx tsc --noEmit src/design-system/**/*.ts
```

Expected: No errors

**Step 2: Commit Phase 1**

```bash
git add src/design-system/
git commit -m "feat(design-system): add token files (phase 1)

- Add primitives with contrast-first color values
- Add semantic tokens (surfaces, text, borders, interactive, status)
- Add layout tokens (spacing, radius, elevation)
- Add typography tokens with pre-composed text styles
- Add motion tokens with intent-based animation
- Add data visualization tokens for charts
- Add TypeScript types for type-safe props"
```

---

## Verification Checklist

- [ ] `src/design-system/tokens/primitives.ts` exists and compiles
- [ ] `src/design-system/tokens/semantic/` contains all 5 files
- [ ] `src/design-system/tokens/layout/` contains all 4 files
- [ ] `src/design-system/tokens/typography.ts` exists
- [ ] `src/design-system/tokens/motion.ts` exists
- [ ] `src/design-system/tokens/data-vis.ts` exists
- [ ] `src/design-system/types.ts` exists
- [ ] `src/design-system/index.ts` exports everything
- [ ] All files compile without TypeScript errors
- [ ] Commit created with all Phase 1 files
