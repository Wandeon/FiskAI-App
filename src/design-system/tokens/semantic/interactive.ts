/**
 * Interactive Semantic Tokens
 *
 * Colors for interactive elements like buttons, links, and controls.
 * Each interactive style has default and hover states.
 *
 * Variants:
 * - primary: Main call-to-action (blue)
 * - secondary: Secondary actions (slate)
 * - danger: Destructive actions (red)
 * - ghost: Minimal/transparent actions
 */

import { slate, white, blue, red, transparent } from "../primitives"

/**
 * Light mode interactive colors
 */
export const interactiveLight = {
  /** Primary button background */
  primary: blue[600],
  /** Primary button hover */
  primaryHover: blue[700],
  /** Primary button active/pressed */
  primaryActive: blue[800],
  /** Primary button text */
  primaryText: white,

  /** Secondary button background */
  secondary: slate[100],
  /** Secondary button hover */
  secondaryHover: slate[200],
  /** Secondary button active/pressed */
  secondaryActive: slate[300],
  /** Secondary button text */
  secondaryText: slate[700],

  /** Danger button background */
  danger: red[600],
  /** Danger button hover */
  dangerHover: red[700],
  /** Danger button active/pressed */
  dangerActive: red[800],
  /** Danger button text */
  dangerText: white,

  /** Ghost button background */
  ghost: transparent,
  /** Ghost button hover */
  ghostHover: slate[100],
  /** Ghost button active/pressed */
  ghostActive: slate[200],
  /** Ghost button text */
  ghostText: slate[700],

  /** Outline button border */
  outlineBorder: slate[300],
  /** Outline button hover border */
  outlineBorderHover: slate[400],
  /** Outline button text */
  outlineText: slate[700],
} as const

/**
 * Dark mode interactive colors
 */
export const interactiveDark = {
  /** Primary button background */
  primary: blue[500],
  /** Primary button hover */
  primaryHover: blue[400],
  /** Primary button active/pressed */
  primaryActive: blue[600],
  /** Primary button text */
  primaryText: white,

  /** Secondary button background */
  secondary: slate[700],
  /** Secondary button hover */
  secondaryHover: slate[600],
  /** Secondary button active/pressed */
  secondaryActive: slate[500],
  /** Secondary button text */
  secondaryText: slate[100],

  /** Danger button background */
  danger: red[600],
  /** Danger button hover */
  dangerHover: red[500],
  /** Danger button active/pressed */
  dangerActive: red[700],
  /** Danger button text */
  dangerText: white,

  /** Ghost button background */
  ghost: transparent,
  /** Ghost button hover */
  ghostHover: slate[700],
  /** Ghost button active/pressed */
  ghostActive: slate[600],
  /** Ghost button text */
  ghostText: slate[200],

  /** Outline button border */
  outlineBorder: slate[500],
  /** Outline button hover border */
  outlineBorderHover: slate[400],
  /** Outline button text */
  outlineText: slate[200],
} as const

/**
 * Combined interactive tokens with light/dark variants
 */
export const interactive = {
  light: interactiveLight,
  dark: interactiveDark,
} as const

export type InteractiveToken = keyof typeof interactiveLight
export type Interactive = typeof interactive
