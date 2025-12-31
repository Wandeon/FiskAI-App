/**
 * Elevation Tokens
 *
 * Shadow and z-index values for creating depth and layering.
 * Shadows create visual hierarchy, while z-index ensures proper stacking.
 *
 * Shadow Guidelines:
 * - sm: Subtle lift (buttons, inputs)
 * - md: Moderate lift (cards, dropdowns)
 * - lg: Significant lift (modals, popovers)
 * - xl/2xl: Maximum lift (tooltips, toasts)
 *
 * Z-Index Guidelines:
 * - base: Default stacking context
 * - dropdown: Dropdown menus
 * - sticky: Sticky headers/elements
 * - modal: Modal dialogs
 * - toast: Toast notifications
 * - tooltip: Tooltips (highest)
 */

/**
 * Box shadow scale
 */
export const shadows = {
  /** No shadow */
  none: "none",
  /** Subtle shadow - inputs, subtle buttons */
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  /** Medium shadow - cards, dropdowns */
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
  /** Large shadow - modals, elevated content */
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
  /** Extra large shadow - prominent floating elements */
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
  /** Maximum shadow - tooltips, highest elevation */
  "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  /** Focus ring shadow - accessibility focus states */
  focus: "0 0 0 3px rgba(59, 130, 246, 0.5)",
  /** Focus ring shadow for dark mode */
  focusDark: "0 0 0 3px rgba(96, 165, 250, 0.5)",
  /** Glow effect - hover states, emphasis */
  glow: "0 0 20px rgba(59, 130, 246, 0.3)",
  /** Card default shadow */
  card: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
  /** Card hover shadow */
  cardHover: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
  /** Elevated component shadow */
  elevated: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
} as const

/**
 * Dark mode shadow variants
 * Shadows are more subtle in dark mode to avoid harsh contrasts
 */
export const shadowsDark = {
  /** No shadow */
  none: "none",
  /** Subtle shadow */
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
  /** Medium shadow */
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
  /** Large shadow */
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)",
  /** Extra large shadow */
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
  /** Maximum shadow */
  "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
  /** Focus ring shadow */
  focus: "0 0 0 3px rgba(96, 165, 250, 0.5)",
  /** Focus ring shadow (same as light in dark mode) */
  focusDark: "0 0 0 3px rgba(96, 165, 250, 0.5)",
  /** Glow effect */
  glow: "0 0 20px rgba(96, 165, 250, 0.3)",
  /** Card default shadow */
  card: "0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.3)",
  /** Card hover shadow */
  cardHover: "0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)",
  /** Elevated component shadow */
  elevated: "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)",
} as const

/**
 * Z-index scale for stacking contexts
 */
export const zIndex = {
  /** Below default stacking */
  behind: "-1",
  /** Default stacking context */
  base: "0",
  /** Slightly elevated */
  raised: "1",
  /** Dropdown menus */
  dropdown: "1000",
  /** Sticky headers */
  sticky: "1100",
  /** Fixed navigation */
  fixed: "1200",
  /** Modal backdrop */
  modalBackdrop: "1300",
  /** Modal dialog */
  modal: "1400",
  /** Popover/Tooltip */
  popover: "1500",
  /** Toast notifications */
  toast: "1600",
  /** Tooltip (highest) */
  tooltip: "1700",
} as const

/**
 * Combined elevation tokens
 */
export const elevation = {
  shadows: {
    light: shadows,
    dark: shadowsDark,
  },
  zIndex,
} as const

export type ShadowToken = keyof typeof shadows
export type ZIndexToken = keyof typeof zIndex
export type Shadows = typeof shadows
export type ZIndex = typeof zIndex
export type Elevation = typeof elevation
