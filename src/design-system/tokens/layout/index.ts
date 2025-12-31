/**
 * Layout Tokens Index
 *
 * Re-exports all layout-related tokens.
 * These tokens define spacing, sizing, and visual depth.
 */

export {
  spacing,
  spacingSemantics,
  componentSpacing,
  type SpacingToken,
  type SpacingSemanticToken,
  type Spacing,
} from "./spacing"

export {
  radius,
  radiusSemantics,
  type RadiusToken,
  type RadiusSemanticToken,
  type Radius,
} from "./radius"

export {
  shadows,
  shadowsDark,
  zIndex,
  elevation,
  type ShadowToken,
  type ZIndexToken,
  type Shadows,
  type ZIndex,
  type Elevation,
} from "./elevation"

// Import values for combined layout object
import { spacing, spacingSemantics, componentSpacing } from "./spacing"

import { radius, radiusSemantics } from "./radius"

import { shadows, shadowsDark, zIndex } from "./elevation"

/**
 * Combined layout tokens object for convenience
 */
export const layout = {
  spacing,
  spacingSemantics,
  componentSpacing,
  radius,
  radiusSemantics,
  shadows,
  shadowsDark,
  zIndex,
} as const

export type Layout = typeof layout
