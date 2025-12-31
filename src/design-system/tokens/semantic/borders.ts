/**
 * Border Semantic Tokens
 *
 * Border colors for visual boundaries and separators.
 * These tokens ensure consistent border appearance across the application.
 *
 * Hierarchy:
 * - default: Standard borders for cards, inputs, etc.
 * - subtle: Light borders for minimal separation
 * - strong: Emphasized borders for high contrast
 * - focus: Focus ring color for accessibility
 *
 * Status colors:
 * - success: Success state borders
 * - warning: Warning state borders
 * - danger: Error/danger state borders
 */

import { slate, blue, emerald, amber, red } from "../primitives"

/**
 * Light mode border colors
 */
export const bordersLight = {
  /** Default border - standard UI elements */
  default: slate[200],
  /** Subtle border - minimal separation */
  subtle: slate[100],
  /** Strong border - high emphasis */
  strong: slate[300],
  /** Focus ring - accessibility */
  focus: blue[500],
  /** Success state border */
  success: emerald[500],
  /** Warning state border */
  warning: amber[500],
  /** Danger state border */
  danger: red[500],
} as const

/**
 * Dark mode border colors
 */
export const bordersDark = {
  /** Default border - standard UI elements */
  default: slate[600],
  /** Subtle border - minimal separation */
  subtle: slate[700],
  /** Strong border - high emphasis */
  strong: slate[500],
  /** Focus ring - accessibility */
  focus: blue[400],
  /** Success state border */
  success: emerald[500],
  /** Warning state border */
  warning: amber[500],
  /** Danger state border */
  danger: red[500],
} as const

/**
 * Combined border tokens with light/dark variants
 */
export const borders = {
  light: bordersLight,
  dark: bordersDark,
} as const

export type BorderToken = keyof typeof bordersLight
export type Borders = typeof borders
