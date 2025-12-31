/**
 * Primitive Design Tokens
 *
 * Raw color values that form the foundation of the design system.
 * These values should NEVER be imported directly by components.
 * Instead, use semantic tokens from ./semantic/* which reference these primitives.
 *
 * @internal This module is for internal design system use only
 */

/**
 * Blue palette - Primary brand color
 * Used for primary actions, links, and focus states
 */
export const blue = {
  50: "#eff6ff",
  100: "#dbeafe",
  200: "#bfdbfe",
  300: "#93c5fd",
  400: "#60a5fa",
  500: "#3b82f6",
  600: "#2563eb",
  700: "#1d4ed8",
  800: "#1e40af",
  900: "#1e3a8a",
  950: "#172554",
} as const

/**
 * Slate palette - Neutral colors
 * Used for text, backgrounds, borders, and UI chrome
 */
export const slate = {
  25: "#f8fafc",
  50: "#f1f5f9",
  100: "#e2e8f0",
  200: "#cbd5e1",
  300: "#94a3b8",
  400: "#64748b",
  500: "#475569",
  600: "#334155",
  700: "#1e293b",
  800: "#0f172a",
  900: "#020617",
  950: "#010409",
} as const

/**
 * Emerald palette - Success states
 * Used for success messages, positive actions, and confirmations
 */
export const emerald = {
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
  950: "#022c22",
} as const

/**
 * Amber palette - Warning states
 * Used for warnings, cautions, and attention-needed states
 */
export const amber = {
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
  950: "#451a03",
} as const

/**
 * Red palette - Danger/Error states
 * Used for errors, destructive actions, and critical warnings
 */
export const red = {
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
  950: "#450a0a",
} as const

/**
 * Cyan palette - Accent color
 * Used for secondary emphasis and decorative elements
 */
export const cyan = {
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
  950: "#083344",
} as const

/**
 * White color constant
 */
export const white = "#ffffff" as const

/**
 * Black color constant
 */
export const black = "#000000" as const

/**
 * Transparent color constant
 */
export const transparent = "transparent" as const

/**
 * All primitive color palettes
 */
export const primitives = {
  blue,
  slate,
  emerald,
  amber,
  red,
  cyan,
  white,
  black,
  transparent,
} as const

export type BluePalette = typeof blue
export type SlatePalette = typeof slate
export type EmeraldPalette = typeof emerald
export type AmberPalette = typeof amber
export type RedPalette = typeof red
export type CyanPalette = typeof cyan
export type Primitives = typeof primitives
