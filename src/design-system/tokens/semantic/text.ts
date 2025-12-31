/**
 * Text Semantic Tokens
 *
 * Text colors for typography throughout the application.
 * These tokens ensure consistent text appearance and proper contrast ratios.
 *
 * Hierarchy:
 * - primary: Main body text, highest emphasis
 * - secondary: Supporting text, medium emphasis
 * - tertiary: Subtle text, lowest emphasis
 * - disabled: Non-interactive disabled text
 * - inverse: Text on inverted backgrounds
 * - link: Interactive link text
 *
 * Status colors for contextual text:
 * - success: Positive/success messages
 * - warning: Warning/caution messages
 * - danger: Error/danger messages
 */

import { slate, white, blue, emerald, amber, red } from "../primitives"

/**
 * Light mode text colors
 */
export const textLight = {
  /** Primary text - highest emphasis */
  primary: slate[900],
  /** Secondary text - medium emphasis */
  secondary: slate[600],
  /** Tertiary text - lowest emphasis */
  tertiary: slate[400],
  /** Disabled text - non-interactive */
  disabled: slate[300],
  /** Inverse text - for dark backgrounds */
  inverse: white,
  /** Link text - interactive */
  link: blue[600],
  /** Link hover state */
  linkHover: blue[700],
  /** Success text */
  success: emerald[700],
  /** Warning text */
  warning: amber[700],
  /** Danger/error text */
  danger: red[600],
} as const

/**
 * Dark mode text colors
 */
export const textDark = {
  /** Primary text - highest emphasis */
  primary: slate[50],
  /** Secondary text - medium emphasis */
  secondary: slate[300],
  /** Tertiary text - lowest emphasis */
  tertiary: slate[400],
  /** Disabled text - non-interactive */
  disabled: slate[500],
  /** Inverse text - for light backgrounds */
  inverse: slate[900],
  /** Link text - interactive */
  link: blue[400],
  /** Link hover state */
  linkHover: blue[300],
  /** Success text */
  success: emerald[400],
  /** Warning text */
  warning: amber[400],
  /** Danger/error text */
  danger: red[400],
} as const

/**
 * Combined text tokens with light/dark variants
 */
export const text = {
  light: textLight,
  dark: textDark,
} as const

export type TextToken = keyof typeof textLight
export type Text = typeof text
