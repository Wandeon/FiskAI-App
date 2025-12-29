/**
 * Motion Tokens
 *
 * Animation duration, easing functions, and motion presets.
 * These tokens ensure consistent, purposeful motion throughout the application.
 *
 * Guidelines:
 * - Use short durations for micro-interactions (hover, focus)
 * - Use medium durations for state changes (expand, collapse)
 * - Use longer durations for major transitions (page, modal)
 * - Respect user's reduced-motion preferences
 */

/**
 * Animation duration scale
 */
export const duration = {
  /** Instant - 0ms */
  instant: "0ms",
  /** Ultra fast - 50ms (micro-interactions) */
  fastest: "50ms",
  /** Very fast - 100ms (hover states) */
  faster: "100ms",
  /** Fast - 150ms (quick feedback) */
  fast: "150ms",
  /** Normal - 200ms (standard transitions) */
  normal: "200ms",
  /** Slow - 300ms (state changes) */
  slow: "300ms",
  /** Slower - 400ms (complex transitions) */
  slower: "400ms",
  /** Slowest - 500ms (major transitions) */
  slowest: "500ms",
  /** Extended - 700ms (elaborate animations) */
  extended: "700ms",
  /** Long - 1000ms (dramatic effects) */
  long: "1000ms",
} as const

/**
 * Easing functions
 * Based on common UX patterns and CSS cubic-bezier values
 */
export const easing = {
  /** Linear - constant speed */
  linear: "linear",
  /** Ease - default browser easing */
  ease: "ease",
  /** Ease in - slow start, fast end */
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
  /** Ease out - fast start, slow end (most common) */
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  /** Ease in-out - slow start and end */
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  /** Emphasized ease in - dramatic entrance */
  emphasizedIn: "cubic-bezier(0.05, 0.7, 0.1, 1)",
  /** Emphasized ease out - dramatic exit */
  emphasizedOut: "cubic-bezier(0.3, 0, 0.8, 0.15)",
  /** Bounce - playful overshoot */
  bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  /** Smooth - natural feeling */
  smooth: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  /** Sharp - quick and precise */
  sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
  /** Spring - elastic feel */
  spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
} as const

/**
 * Motion intent presets
 * Complete motion configurations for specific interaction types
 */
export const motionIntent = {
  /** Entrance animations - elements appearing */
  entrance: {
    duration: duration.normal,
    easing: easing.easeOut,
    delay: "0ms",
  },
  /** Exit animations - elements disappearing */
  exit: {
    duration: duration.fast,
    easing: easing.easeIn,
    delay: "0ms",
  },
  /** Feedback animations - user interaction response */
  feedback: {
    duration: duration.faster,
    easing: easing.easeOut,
    delay: "0ms",
  },
  /** Attention animations - drawing user focus */
  attention: {
    duration: duration.slow,
    easing: easing.easeInOut,
    delay: "0ms",
  },
  /** Loading animations - progress indicators */
  loading: {
    duration: duration.long,
    easing: easing.linear,
    delay: "0ms",
  },
  /** Hover state transitions */
  hover: {
    duration: duration.faster,
    easing: easing.easeOut,
    delay: "0ms",
  },
  /** Focus state transitions */
  focus: {
    duration: duration.fast,
    easing: easing.easeOut,
    delay: "0ms",
  },
  /** Expand/collapse transitions */
  expand: {
    duration: duration.slow,
    easing: easing.easeInOut,
    delay: "0ms",
  },
  /** Modal/dialog transitions */
  modal: {
    duration: duration.slow,
    easing: easing.emphasizedIn,
    delay: "0ms",
  },
  /** Toast notification transitions */
  toast: {
    duration: duration.normal,
    easing: easing.spring,
    delay: "0ms",
  },
} as const

/**
 * Reduced motion configuration
 * Values to use when user prefers reduced motion
 *
 * IMPORTANT: All motion components MUST respect reduced motion preferences.
 *
 * Implementation guidelines:
 * 1. Use Framer Motion's useReducedMotion() hook in React components
 * 2. Set animation props to false/undefined when reduced motion is enabled
 * 3. Use CSS variables (--duration-*) for CSS-based animations
 * 4. Test with prefers-reduced-motion: reduce in DevTools
 *
 * @see Design System Accessibility Guide: src/design-system/ACCESSIBILITY.md
 * @see Example implementations: src/components/motion/Reveal.tsx, src/components/motion/Stagger.tsx
 */
export const reducedMotion = {
  /** Use instant duration for all animations */
  duration: duration.instant,
  /** Use linear easing (no acceleration) */
  easing: easing.linear,
  /** CSS media query for reduced motion preference */
  mediaQuery: "(prefers-reduced-motion: reduce)",
  /** Alternative fast duration if animation is essential (e.g., loading indicators) */
  essentialDuration: duration.faster,
} as const

/**
 * CSS keyframe animation definitions
 * Common animation patterns as CSS keyframe strings
 */
export const keyframes = {
  /** Fade in animation */
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  /** Fade out animation */
  fadeOut: `
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `,
  /** Slide up animation */
  slideUp: `
    @keyframes slideUp {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `,
  /** Slide down animation */
  slideDown: `
    @keyframes slideDown {
      from { transform: translateY(-10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `,
  /** Slide left animation */
  slideLeft: `
    @keyframes slideLeft {
      from { transform: translateX(10px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `,
  /** Slide right animation */
  slideRight: `
    @keyframes slideRight {
      from { transform: translateX(-10px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `,
  /** Scale up animation */
  scaleUp: `
    @keyframes scaleUp {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `,
  /** Scale down animation */
  scaleDown: `
    @keyframes scaleDown {
      from { transform: scale(1.05); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `,
  /** Spin animation (loading) */
  spin: `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
  /** Pulse animation (attention) */
  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `,
  /** Bounce animation */
  bounce: `
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
  `,
  /** Shake animation (error) */
  shake: `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
  `,
} as const

/**
 * Combined motion tokens
 */
export const motion = {
  duration,
  easing,
  intent: motionIntent,
  reducedMotion,
  keyframes,
} as const

export type Duration = keyof typeof duration
export type Easing = keyof typeof easing
export type MotionIntent = keyof typeof motionIntent
export type Keyframe = keyof typeof keyframes
export type Motion = typeof motion
