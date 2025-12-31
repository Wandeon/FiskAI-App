/**
 * Design System Tokens - Main Export
 *
 * This module exports all design tokens for the FiskAI design system.
 * Tokens are organized into categories:
 *
 * - primitives: Raw color values (internal use only)
 * - semantic: Context-aware colors (surfaces, text, borders, interactive)
 * - layout: Spacing, radius, elevation
 * - typography: Fonts, weights, text styles
 * - motion: Animation duration, easing, keyframes
 * - dataVis: Data visualization colors and elements
 *
 * Usage:
 * ```typescript
 * import { semantic, layout, typography } from '@/design-system/tokens';
 *
 * // Use semantic colors for theme-aware styling
 * const bgColor = semantic.surfaces.light.surface0;
 *
 * // Use layout tokens for consistent spacing
 * const padding = layout.spacing['4']; // 16px
 *
 * // Use typography for text styling
 * const headingStyle = typography.textStyles['heading-lg'];
 * ```
 */

// Primitives (internal use - not recommended for direct component use)
export {
  primitives,
  blue,
  slate,
  emerald,
  amber,
  red,
  cyan,
  white,
  black,
  transparent,
  type BluePalette,
  type SlatePalette,
  type EmeraldPalette,
  type AmberPalette,
  type RedPalette,
  type CyanPalette,
  type Primitives,
} from "./primitives"

// Semantic tokens
export {
  semantic,
  surfaces,
  surfacesLight,
  surfacesDark,
  text,
  textLight,
  textDark,
  borders,
  bordersLight,
  bordersDark,
  interactive,
  interactiveLight,
  interactiveDark,
  statusColors,
  successLight,
  successDark,
  warningLight,
  warningDark,
  dangerLight,
  dangerDark,
  infoLight,
  infoDark,
  type SurfaceToken,
  type Surfaces,
  type TextToken,
  type Text,
  type BorderToken,
  type Borders,
  type InteractiveToken,
  type Interactive,
  type StatusColorBundle,
  type StatusVariant,
  type StatusColors,
} from "./semantic"

// Layout tokens
export {
  layout,
  spacing,
  spacingSemantics,
  componentSpacing,
  radius,
  radiusSemantics,
  shadows,
  shadowsDark,
  zIndex,
  elevation,
  type SpacingToken,
  type SpacingSemanticToken,
  type Spacing,
  type RadiusToken,
  type RadiusSemanticToken,
  type Radius,
  type ShadowToken,
  type ZIndexToken,
  type Shadows,
  type ZIndex,
  type Elevation,
  type Layout,
} from "./layout"

// Typography tokens
export {
  typography,
  fonts,
  fontWeights,
  fontSizes,
  lineHeights,
  letterSpacing,
  textStyles,
  type TextStyle,
  type FontFamily,
  type FontWeight,
  type FontSize,
  type LineHeight,
  type LetterSpacing,
  type TextStyleName,
  type Typography,
} from "./typography"

// Motion tokens
export {
  motion,
  duration,
  easing,
  motionIntent,
  reducedMotion,
  keyframes,
  type Duration,
  type Easing,
  type MotionIntent,
  type Keyframe,
  type Motion,
} from "./motion"

// Data visualization tokens
export {
  dataVis,
  categorical,
  categoricalArray,
  sequential,
  diverging,
  chartElements,
  dataVisOpacity,
  type CategoricalSeries,
  type SequentialPalette,
  type DivergingPalette,
  type ChartElement,
  type DataVis,
} from "./data-vis"

// Import values for combined tokens object
import { primitives as primitivesImport } from "./primitives"
import { semantic as semanticImport } from "./semantic"
import { layout as layoutImport } from "./layout"
import { typography as typographyImport } from "./typography"
import { motion as motionImport } from "./motion"
import { dataVis as dataVisImport } from "./data-vis"

/**
 * Complete tokens object combining all token categories
 */
export const tokens = {
  primitives: primitivesImport,
  semantic: semanticImport,
  layout: layoutImport,
  typography: typographyImport,
  motion: motionImport,
  dataVis: dataVisImport,
} as const

export type Tokens = typeof tokens
