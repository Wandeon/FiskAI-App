/**
 * Status Color Bundles
 *
 * Complete color bundles for status states (success, warning, danger, info).
 * Each bundle includes background, text, border, and icon colors
 * for consistent status indication throughout the application.
 *
 * Usage:
 * - Alerts and notifications
 * - Form validation states
 * - Status badges
 * - Toast messages
 */

import { blue, emerald, amber, red } from "../primitives"

/**
 * Success status colors - Light mode
 */
export const successLight = {
  /** Background for success areas */
  bg: emerald[50],
  /** Stronger background for emphasis */
  bgStrong: emerald[100],
  /** Text color for success messages */
  text: emerald[700],
  /** Border color for success elements */
  border: emerald[500],
  /** Icon color for success indicators */
  icon: emerald[600],
} as const

/**
 * Success status colors - Dark mode
 */
export const successDark = {
  /** Background for success areas */
  bg: "rgba(16, 185, 129, 0.15)",
  /** Stronger background for emphasis */
  bgStrong: "rgba(16, 185, 129, 0.25)",
  /** Text color for success messages */
  text: emerald[400],
  /** Border color for success elements */
  border: emerald[500],
  /** Icon color for success indicators */
  icon: emerald[400],
} as const

/**
 * Warning status colors - Light mode
 */
export const warningLight = {
  /** Background for warning areas */
  bg: amber[50],
  /** Stronger background for emphasis */
  bgStrong: amber[100],
  /** Text color for warning messages */
  text: amber[700],
  /** Border color for warning elements */
  border: amber[500],
  /** Icon color for warning indicators */
  icon: amber[600],
} as const

/**
 * Warning status colors - Dark mode
 */
export const warningDark = {
  /** Background for warning areas */
  bg: "rgba(245, 158, 11, 0.15)",
  /** Stronger background for emphasis */
  bgStrong: "rgba(245, 158, 11, 0.25)",
  /** Text color for warning messages */
  text: amber[400],
  /** Border color for warning elements */
  border: amber[500],
  /** Icon color for warning indicators */
  icon: amber[400],
} as const

/**
 * Danger/Error status colors - Light mode
 */
export const dangerLight = {
  /** Background for danger areas */
  bg: red[50],
  /** Stronger background for emphasis */
  bgStrong: red[100],
  /** Text color for danger messages */
  text: red[700],
  /** Border color for danger elements */
  border: red[500],
  /** Icon color for danger indicators */
  icon: red[600],
} as const

/**
 * Danger/Error status colors - Dark mode
 */
export const dangerDark = {
  /** Background for danger areas */
  bg: "rgba(239, 68, 68, 0.15)",
  /** Stronger background for emphasis */
  bgStrong: "rgba(239, 68, 68, 0.25)",
  /** Text color for danger messages */
  text: red[400],
  /** Border color for danger elements */
  border: red[500],
  /** Icon color for danger indicators */
  icon: red[400],
} as const

/**
 * Info status colors - Light mode
 */
export const infoLight = {
  /** Background for info areas */
  bg: blue[50],
  /** Stronger background for emphasis */
  bgStrong: blue[100],
  /** Text color for info messages */
  text: blue[700],
  /** Border color for info elements */
  border: blue[500],
  /** Icon color for info indicators */
  icon: blue[600],
} as const

/**
 * Info status colors - Dark mode
 */
export const infoDark = {
  /** Background for info areas */
  bg: "rgba(59, 130, 246, 0.15)",
  /** Stronger background for emphasis */
  bgStrong: "rgba(59, 130, 246, 0.25)",
  /** Text color for info messages */
  text: blue[400],
  /** Border color for info elements */
  border: blue[500],
  /** Icon color for info indicators */
  icon: blue[400],
} as const

/**
 * Combined status colors with light/dark variants
 */
export const statusColors = {
  light: {
    success: successLight,
    warning: warningLight,
    danger: dangerLight,
    info: infoLight,
  },
  dark: {
    success: successDark,
    warning: warningDark,
    danger: dangerDark,
    info: infoDark,
  },
} as const

export type StatusColorBundle = typeof successLight
export type StatusVariant = "success" | "warning" | "danger" | "info"
export type StatusColors = typeof statusColors
