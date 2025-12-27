/**
 * Typography Tokens
 *
 * Font families, weights, and text style presets.
 * These tokens ensure consistent typography throughout the application.
 *
 * Font Stacks:
 * - sans: Primary font for body text and UI
 * - heading: Optional distinct heading font (falls back to sans)
 * - mono: Monospace for code and technical content
 *
 * Text Styles:
 * Complete typography presets combining size, weight, line-height, and letter-spacing.
 */

/**
 * Font family stacks
 * Uses CSS variables set by next/font for self-hosted fonts with zero CLS
 */
export const fonts = {
  /** Primary sans-serif font stack (Inter via CSS variable) */
  sans: 'var(--font-inter), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  /** Heading font stack (Inter via CSS variable) */
  heading:
    'var(--font-inter), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  /** Monospace font stack for code (JetBrains Mono via CSS variable) */
  mono: 'var(--font-jetbrains), ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as const

/**
 * Font weight scale
 */
export const fontWeights = {
  /** Thin - rarely used */
  thin: "100",
  /** Extra light */
  extralight: "200",
  /** Light */
  light: "300",
  /** Normal/Regular - body text */
  normal: "400",
  /** Medium - subtle emphasis */
  medium: "500",
  /** Semibold - headings, buttons */
  semibold: "600",
  /** Bold - strong emphasis */
  bold: "700",
  /** Extra bold */
  extrabold: "800",
  /** Black - maximum weight */
  black: "900",
} as const

/**
 * Font size scale
 */
export const fontSizes = {
  /** 10px */
  "2xs": "0.625rem",
  /** 12px */
  xs: "0.75rem",
  /** 14px */
  sm: "0.875rem",
  /** 16px */
  base: "1rem",
  /** 18px */
  lg: "1.125rem",
  /** 20px */
  xl: "1.25rem",
  /** 24px */
  "2xl": "1.5rem",
  /** 30px */
  "3xl": "1.875rem",
  /** 36px */
  "4xl": "2.25rem",
  /** 48px */
  "5xl": "3rem",
  /** 60px */
  "6xl": "3.75rem",
  /** 72px */
  "7xl": "4.5rem",
  /** 96px */
  "8xl": "6rem",
  /** 128px */
  "9xl": "8rem",
} as const

/**
 * Line height scale
 */
export const lineHeights = {
  /** No leading */
  none: "1",
  /** Tight - headings */
  tight: "1.25",
  /** Snug */
  snug: "1.375",
  /** Normal - body text */
  normal: "1.5",
  /** Relaxed */
  relaxed: "1.625",
  /** Loose */
  loose: "2",
} as const

/**
 * Letter spacing scale
 */
export const letterSpacing = {
  /** Tighter */
  tighter: "-0.05em",
  /** Tight */
  tight: "-0.025em",
  /** Normal */
  normal: "0em",
  /** Wide */
  wide: "0.025em",
  /** Wider */
  wider: "0.05em",
  /** Widest */
  widest: "0.1em",
} as const

/**
 * Text style interface
 */
export interface TextStyle {
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
}

/**
 * Pre-composed text styles
 * Ready-to-use typography presets for common use cases
 */
export const textStyles = {
  /** Extra large display - hero sections */
  "display-xl": {
    fontFamily: fonts.heading,
    fontSize: fontSizes["6xl"],
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  },
  /** Large display - page titles */
  "display-lg": {
    fontFamily: fonts.heading,
    fontSize: fontSizes["5xl"],
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  },
  /** Medium display */
  "display-md": {
    fontFamily: fonts.heading,
    fontSize: fontSizes["4xl"],
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  },
  /** Small display */
  "display-sm": {
    fontFamily: fonts.heading,
    fontSize: fontSizes["3xl"],
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacing.normal,
  },
  /** Heading 1 */
  "heading-xl": {
    fontFamily: fonts.heading,
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.snug,
    letterSpacing: letterSpacing.normal,
  },
  /** Heading 2 */
  "heading-lg": {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.snug,
    letterSpacing: letterSpacing.normal,
  },
  /** Heading 3 */
  "heading-md": {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.snug,
    letterSpacing: letterSpacing.normal,
  },
  /** Heading 4 */
  "heading-sm": {
    fontFamily: fonts.heading,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.snug,
    letterSpacing: letterSpacing.normal,
  },
  /** Heading 5 (small caps style) */
  "heading-xs": {
    fontFamily: fonts.heading,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.snug,
    letterSpacing: letterSpacing.wide,
  },
  /** Large body text */
  "body-lg": {
    fontFamily: fonts.sans,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.relaxed,
    letterSpacing: letterSpacing.normal,
  },
  /** Default body text */
  "body-md": {
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Small body text */
  "body-sm": {
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Extra small body text */
  "body-xs": {
    fontFamily: fonts.sans,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Large label text */
  "label-lg": {
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Default label text */
  "label-md": {
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Small label text */
  "label-sm": {
    fontFamily: fonts.sans,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Large code text */
  "code-lg": {
    fontFamily: fonts.mono,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.relaxed,
    letterSpacing: letterSpacing.normal,
  },
  /** Default code text */
  "code-md": {
    fontFamily: fonts.mono,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.relaxed,
    letterSpacing: letterSpacing.normal,
  },
  /** Small code text */
  "code-sm": {
    fontFamily: fonts.mono,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.relaxed,
    letterSpacing: letterSpacing.normal,
  },
} as const satisfies Record<string, TextStyle>

/**
 * Combined typography tokens
 */
export const typography = {
  fonts,
  fontWeights,
  fontSizes,
  lineHeights,
  letterSpacing,
  textStyles,
} as const

export type FontFamily = keyof typeof fonts
export type FontWeight = keyof typeof fontWeights
export type FontSize = keyof typeof fontSizes
export type LineHeight = keyof typeof lineHeights
export type LetterSpacing = keyof typeof letterSpacing
export type TextStyleName = keyof typeof textStyles
export type Typography = typeof typography
