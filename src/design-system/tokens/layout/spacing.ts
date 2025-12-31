/**
 * Spacing Tokens
 *
 * Consistent spacing scale based on a 4px base unit.
 * Used for margins, padding, gaps, and positioning.
 *
 * The scale follows a progression that provides
 * flexibility while maintaining visual consistency.
 *
 * Usage:
 * - spacing[0] = 0px (no spacing)
 * - spacing[1] = 4px (tight)
 * - spacing[2] = 8px (standard)
 * - spacing[4] = 16px (comfortable)
 * - spacing[8] = 32px (spacious)
 */

/**
 * Spacing scale with 4px base unit
 * Keys represent multipliers of the base unit
 */
export const spacing = {
  /** 0px */
  "0": "0px",
  /** 2px */
  "0.5": "2px",
  /** 4px */
  "1": "4px",
  /** 6px */
  "1.5": "6px",
  /** 8px */
  "2": "8px",
  /** 12px */
  "3": "12px",
  /** 16px */
  "4": "16px",
  /** 20px */
  "5": "20px",
  /** 24px */
  "6": "24px",
  /** 32px */
  "8": "32px",
  /** 40px */
  "10": "40px",
  /** 48px */
  "12": "48px",
  /** 64px */
  "16": "64px",
  /** 80px */
  "20": "80px",
  /** 96px */
  "24": "96px",
  /** 112px */
  "28": "112px",
  /** 128px */
  "32": "128px",
} as const

/**
 * Semantic spacing aliases for common use cases
 */
export const spacingSemantics = {
  /** No spacing */
  none: spacing["0"],
  /** Extra extra small - 2px */
  xxs: spacing["0.5"],
  /** Extra small - 4px */
  xs: spacing["1"],
  /** Small - 8px */
  sm: spacing["2"],
  /** Medium - 12px */
  md: spacing["3"],
  /** Large - 16px */
  lg: spacing["4"],
  /** Extra large - 24px */
  xl: spacing["6"],
  /** Extra extra large - 32px */
  "2xl": spacing["8"],
  /** Extra extra extra large - 48px */
  "3xl": spacing["12"],
} as const

/**
 * Component-specific spacing
 */
export const componentSpacing = {
  /** Button padding horizontal */
  buttonPaddingX: spacing["4"],
  /** Button padding vertical */
  buttonPaddingY: spacing["2"],
  /** Button padding horizontal (small) */
  buttonPaddingXSm: spacing["3"],
  /** Button padding vertical (small) */
  buttonPaddingYSm: spacing["1.5"],
  /** Input padding horizontal */
  inputPaddingX: spacing["3"],
  /** Input padding vertical */
  inputPaddingY: spacing["2"],
  /** Card padding */
  cardPadding: spacing["6"],
  /** Card padding (compact) */
  cardPaddingCompact: spacing["4"],
  /** Modal padding */
  modalPadding: spacing["6"],
  /** Section gap */
  sectionGap: spacing["8"],
  /** Stack gap (default) */
  stackGap: spacing["4"],
  /** Inline gap (default) */
  inlineGap: spacing["2"],
} as const

export type SpacingToken = keyof typeof spacing
export type SpacingSemanticToken = keyof typeof spacingSemantics
export type Spacing = typeof spacing
