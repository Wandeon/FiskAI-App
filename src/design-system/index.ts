/**
 * FiskAI Design System
 *
 * A comprehensive design system providing tokens, types, and utilities
 * for building consistent, accessible, and beautiful user interfaces.
 *
 * @module @fiskai/design-system
 *
 * @example
 * ```typescript
 * // Import tokens
 * import { tokens, semantic, layout, typography } from '@/design-system';
 *
 * // Import types
 * import type { ButtonVariant, ThemeMode, SpacingValue } from '@/design-system';
 *
 * // Use in components
 * const Button = ({ variant }: { variant: ButtonVariant }) => {
 *   const bg = variant === 'primary'
 *     ? semantic.interactive.light.primary
 *     : semantic.interactive.light.secondary;
 *   // ...
 * };
 * ```
 */

// ============================================================================
// Tokens
// ============================================================================

export {
  // Main tokens export
  tokens,
  type Tokens,

  // Primitives (internal use)
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

  // Semantic colors
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

  // Layout
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

  // Typography
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

  // Motion
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

  // Data visualization
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
} from "./tokens"

// ============================================================================
// Types
// ============================================================================

export type {
  // Theme
  ThemeMode,

  // Semantic colors
  SemanticTextColor,
  SemanticBgColor,
  SemanticBorderColor,
  SemanticColorCategory,

  // Component variants
  ButtonVariant,
  ButtonSize,
  BadgeVariant,
  BadgeSize,
  AlertVariant,
  InputState,
  InputSize,
  CardVariant,
  CardPadding,
  AvatarSize,
  SpinnerSize,
  TooltipPlacement,
  ModalSize,

  // Layout
  SpacingValue,
  RadiusValue,
  ShadowValue,
  ZIndexValue,
  Breakpoint,
  ResponsiveValue,
  FlexDirection,
  FlexJustify,
  FlexAlign,

  // Typography
  FontFamilyValue,
  FontWeightValue,
  FontSizeValue,
  TextStyleValue,
  TextAlign,
  TextTransform,
  TextDecoration,

  // Motion
  DurationValue,
  EasingValue,
  MotionIntentValue,

  // Data visualization
  ChartSeriesColor,
  ChartType,

  // Utility types
  OptionalProps,
  RequiredProps,
  WithChildren,
  WithClassName,
  WithStyle,
  CommonProps,
  WithTestId,
  WithA11y,
  PolymorphicProps,
  PolymorphicRef,
  PolymorphicPropsWithRef,
} from "./types"
