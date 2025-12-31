/**
 * Surface Semantic Tokens
 *
 * Surface colors define the background layers of the application.
 * These create visual hierarchy through a layered surface system.
 *
 * Surface Ladder (from bottom to top):
 * - base: The application's root background
 * - surface0: Primary content areas (cards, panels)
 * - surface1: Elevated content within surface0
 * - surface2: Further elevated content
 * - elevated: Floating elements (dropdowns, popovers)
 * - overlay: Modal/dialog backdrop overlay
 */

import { slate, white, black } from "../primitives"

/**
 * Light mode surface colors
 * Uses lighter slate values for a clean, bright interface
 */
export const surfacesLight = {
  /** Root application background */
  base: slate[50],
  /** Primary content areas */
  surface0: white,
  /** Slightly elevated content */
  surface1: slate[25],
  /** Further elevated content */
  surface2: slate[50],
  /** Floating elements like dropdowns */
  elevated: white,
  /** Modal/dialog backdrop */
  overlay: "rgba(15, 23, 42, 0.5)",
} as const

/**
 * Dark mode surface colors
 * Uses darker slate values for reduced eye strain
 */
export const surfacesDark = {
  /** Root application background */
  base: slate[900],
  /** Primary content areas */
  surface0: slate[800],
  /** Slightly elevated content */
  surface1: slate[700],
  /** Further elevated content */
  surface2: slate[600],
  /** Floating elements like dropdowns */
  elevated: slate[700],
  /** Modal/dialog backdrop */
  overlay: "rgba(0, 0, 0, 0.7)",
} as const

/**
 * Combined surface tokens with light/dark variants
 */
export const surfaces = {
  light: surfacesLight,
  dark: surfacesDark,
} as const

export type SurfaceToken = keyof typeof surfacesLight
export type Surfaces = typeof surfaces
