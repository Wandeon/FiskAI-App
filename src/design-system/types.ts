/**
 * Design System Types
 *
 * TypeScript type definitions for the design system.
 * These types enable type-safe usage of design tokens in components.
 */

import type {
  SurfaceToken,
  TextToken,
  BorderToken,
  InteractiveToken,
  StatusVariant,
  SpacingToken,
  RadiusToken,
  ShadowToken,
  ZIndexToken,
  FontFamily,
  FontWeight,
  FontSize,
  TextStyleName,
  Duration,
  Easing,
  CategoricalSeries,
} from "./tokens"

// ============================================================================
// Color Types
// ============================================================================

/**
 * Theme mode for color selection
 */
export type ThemeMode = "light" | "dark"

/**
 * Semantic text color tokens
 */
export type SemanticTextColor = TextToken

/**
 * Semantic background color tokens
 */
export type SemanticBgColor = SurfaceToken | StatusVariant

/**
 * Semantic border color tokens
 */
export type SemanticBorderColor = BorderToken

/**
 * All semantic color categories
 */
export type SemanticColorCategory = "surfaces" | "text" | "borders" | "interactive" | "statusColors"

// ============================================================================
// Component Variant Types
// ============================================================================

/**
 * Button variant types
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline"

/**
 * Button size types
 */
export type ButtonSize = "sm" | "md" | "lg"

/**
 * Badge variant types
 */
export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "outline"

/**
 * Badge size types
 */
export type BadgeSize = "sm" | "md" | "lg"

/**
 * Alert variant types (maps to status)
 */
export type AlertVariant = StatusVariant

/**
 * Input state types
 */
export type InputState = "default" | "focus" | "error" | "disabled" | "success"

/**
 * Input size types
 */
export type InputSize = "sm" | "md" | "lg"

/**
 * Card variant types
 */
export type CardVariant = "default" | "elevated" | "outlined" | "interactive"

/**
 * Card padding types
 */
export type CardPadding = "none" | "sm" | "md" | "lg"

/**
 * Avatar size types
 */
export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"

/**
 * Spinner size types
 */
export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl"

/**
 * Tooltip placement types
 */
export type TooltipPlacement =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-start"
  | "top-end"
  | "right-start"
  | "right-end"
  | "bottom-start"
  | "bottom-end"
  | "left-start"
  | "left-end"

/**
 * Modal size types
 */
export type ModalSize = "sm" | "md" | "lg" | "xl" | "full"

// ============================================================================
// Layout Types
// ============================================================================

/**
 * Spacing value types
 */
export type SpacingValue = SpacingToken

/**
 * Border radius value types
 */
export type RadiusValue = RadiusToken

/**
 * Shadow value types
 */
export type ShadowValue = ShadowToken

/**
 * Z-index value types
 */
export type ZIndexValue = ZIndexToken

/**
 * Responsive breakpoint types
 */
export type Breakpoint = "sm" | "md" | "lg" | "xl" | "2xl"

/**
 * Responsive value wrapper
 */
export type ResponsiveValue<T> = T | Partial<Record<Breakpoint, T>>

/**
 * Flex direction types
 */
export type FlexDirection = "row" | "row-reverse" | "column" | "column-reverse"

/**
 * Flex justify types
 */
export type FlexJustify = "start" | "end" | "center" | "between" | "around" | "evenly"

/**
 * Flex align types
 */
export type FlexAlign = "start" | "end" | "center" | "baseline" | "stretch"

// ============================================================================
// Typography Types
// ============================================================================

/**
 * Font family types
 */
export type FontFamilyValue = FontFamily

/**
 * Font weight types
 */
export type FontWeightValue = FontWeight

/**
 * Font size types
 */
export type FontSizeValue = FontSize

/**
 * Text style preset types
 */
export type TextStyleValue = TextStyleName

/**
 * Text alignment types
 */
export type TextAlign = "left" | "center" | "right" | "justify"

/**
 * Text transform types
 */
export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize"

/**
 * Text decoration types
 */
export type TextDecoration = "none" | "underline" | "line-through"

// ============================================================================
// Motion Types
// ============================================================================

/**
 * Animation duration types
 */
export type DurationValue = Duration

/**
 * Animation easing types
 */
export type EasingValue = Easing

/**
 * Motion intent types
 */
export type MotionIntentValue =
  | "entrance"
  | "exit"
  | "feedback"
  | "attention"
  | "loading"
  | "hover"
  | "focus"
  | "expand"
  | "modal"
  | "toast"

// ============================================================================
// Data Visualization Types
// ============================================================================

/**
 * Chart series color types
 */
export type ChartSeriesColor = CategoricalSeries

/**
 * Chart type types
 */
export type ChartType = "line" | "bar" | "area" | "pie" | "donut" | "scatter" | "heatmap"

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Optional props helper
 */
export type OptionalProps<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Required props helper
 */
export type RequiredProps<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

/**
 * Props with children
 */
export interface WithChildren {
  children?: React.ReactNode
}

/**
 * Props with className
 */
export interface WithClassName {
  className?: string
}

/**
 * Props with style
 */
export interface WithStyle {
  style?: React.CSSProperties
}

/**
 * Common component props
 */
export interface CommonProps extends WithChildren, WithClassName, WithStyle {}

/**
 * Props with test ID
 */
export interface WithTestId {
  "data-testid"?: string
}

/**
 * Props with accessibility label
 */
export interface WithA11y {
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
}

/**
 * Polymorphic component props
 */
export type PolymorphicProps<E extends React.ElementType, P = object> = P &
  Omit<React.ComponentPropsWithoutRef<E>, keyof P> & {
    as?: E
  }

/**
 * Extract the ref type for a polymorphic component
 */
export type PolymorphicRef<E extends React.ElementType> = React.ComponentPropsWithRef<E>["ref"]

/**
 * Polymorphic component with ref
 */
export type PolymorphicPropsWithRef<E extends React.ElementType, P = object> = PolymorphicProps<
  E,
  P
> & { ref?: PolymorphicRef<E> }
