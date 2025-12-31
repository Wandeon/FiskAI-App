/**
 * Border Radius Tokens
 *
 * Consistent border radius scale for rounded corners.
 * Used for buttons, cards, inputs, and other UI elements.
 *
 * The scale provides options from sharp corners to fully rounded.
 */

/**
 * Border radius scale
 */
export const radius = {
  /** No rounding - 0px */
  none: "0px",
  /** Small rounding - 2px */
  sm: "2px",
  /** Medium rounding - 4px (default for inputs) */
  md: "4px",
  /** Large rounding - 6px (default for buttons) */
  lg: "6px",
  /** Extra large rounding - 8px (default for cards) */
  xl: "8px",
  /** 2x extra large - 12px */
  "2xl": "12px",
  /** 3x extra large - 16px */
  "3xl": "16px",
  /** Full rounding - 9999px (pills, avatars) */
  full: "9999px",
} as const

/**
 * Semantic radius aliases for common components
 */
export const radiusSemantics = {
  /** Button border radius */
  button: radius.lg,
  /** Small button border radius */
  buttonSm: radius.md,
  /** Input/form control border radius */
  input: radius.md,
  /** Card border radius */
  card: radius.xl,
  /** Modal border radius */
  modal: radius["2xl"],
  /** Badge/tag border radius */
  badge: radius.full,
  /** Avatar border radius */
  avatar: radius.full,
  /** Tooltip border radius */
  tooltip: radius.md,
  /** Dropdown border radius */
  dropdown: radius.lg,
} as const

export type RadiusToken = keyof typeof radius
export type RadiusSemanticToken = keyof typeof radiusSemantics
export type Radius = typeof radius
