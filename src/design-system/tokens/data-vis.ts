/**
 * Data Visualization Tokens
 *
 * Color palettes and styling tokens for charts, graphs, and data displays.
 *
 * Guidelines:
 * - Categorical: Use for discrete categories (bar charts, pie charts)
 * - Sequential: Use for continuous data ranges (heatmaps)
 * - Diverging: Use for data with meaningful midpoint (correlation)
 *
 * Important:
 * - Categorical colors intentionally avoid blue and red to prevent
 *   confusion with semantic colors (primary, danger).
 * - Colors are chosen for distinguishability and accessibility.
 */

/**
 * Categorical palette for discrete data series
 * Designed to be visually distinct and colorblind-friendly
 * Avoids blue (primary) and pure red (danger) to prevent semantic confusion
 */
export const categorical = {
  /** Indigo - primary data series */
  series1: "#6366f1",
  /** Violet - secondary data series */
  series2: "#8b5cf6",
  /** Pink - tertiary data series */
  series3: "#ec4899",
  /** Teal - fourth data series */
  series4: "#14b8a6",
  /** Orange - fifth data series */
  series5: "#f97316",
  /** Lime - sixth data series */
  series6: "#84cc16",
  /** Cyan - seventh data series */
  series7: "#06b6d4",
  /** Rose - eighth data series */
  series8: "#f43f5e",
} as const

/**
 * Categorical palette as array for iteration
 */
export const categoricalArray = [
  categorical.series1,
  categorical.series2,
  categorical.series3,
  categorical.series4,
  categorical.series5,
  categorical.series6,
  categorical.series7,
  categorical.series8,
] as const

/**
 * Sequential palette for continuous data
 * Gradient from light to dark for showing magnitude
 */
export const sequential = {
  /** Indigo-based sequential palette */
  indigo: {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
  },
  /** Teal-based sequential palette */
  teal: {
    50: "#f0fdfa",
    100: "#ccfbf1",
    200: "#99f6e4",
    300: "#5eead4",
    400: "#2dd4bf",
    500: "#14b8a6",
    600: "#0d9488",
    700: "#0f766e",
    800: "#115e59",
    900: "#134e4a",
  },
  /** Purple-based sequential palette */
  purple: {
    50: "#faf5ff",
    100: "#f3e8ff",
    200: "#e9d5ff",
    300: "#d8b4fe",
    400: "#c084fc",
    500: "#a855f7",
    600: "#9333ea",
    700: "#7e22ce",
    800: "#6b21a8",
    900: "#581c87",
  },
} as const

/**
 * Diverging palette for data with meaningful midpoint
 * Used for showing positive/negative or above/below average
 */
export const diverging = {
  /** Teal to Rose diverging palette (neutral midpoint) */
  tealRose: {
    negative3: "#0d9488", // Strong teal
    negative2: "#14b8a6",
    negative1: "#5eead4",
    neutral: "#e2e8f0", // Slate 200 - neutral midpoint
    positive1: "#fda4af",
    positive2: "#fb7185",
    positive3: "#f43f5e", // Strong rose
  },
  /** Purple to Orange diverging palette */
  purpleOrange: {
    negative3: "#7e22ce",
    negative2: "#a855f7",
    negative1: "#d8b4fe",
    neutral: "#e2e8f0",
    positive1: "#fdba74",
    positive2: "#fb923c",
    positive3: "#f97316",
  },
} as const

/**
 * Chart element colors for axes, grids, and labels
 */
export const chartElements = {
  light: {
    /** Axis line color */
    axis: "#94a3b8", // slate-300
    /** Grid line color */
    grid: "#e2e8f0", // slate-200
    /** Axis label text color */
    label: "#64748b", // slate-400
    /** Chart title text color */
    title: "#1e293b", // slate-700
    /** Legend text color */
    legend: "#475569", // slate-500
    /** Tooltip background */
    tooltipBg: "#ffffff",
    /** Tooltip text */
    tooltipText: "#1e293b", // slate-700
    /** Tooltip border */
    tooltipBorder: "#e2e8f0", // slate-200
    /** Reference line color */
    reference: "#cbd5e1", // slate-300
    /** Zero line color (for bar charts) */
    zeroLine: "#94a3b8", // slate-300
  },
  dark: {
    /** Axis line color */
    axis: "#64748b", // slate-400
    /** Grid line color */
    grid: "#334155", // slate-600
    /** Axis label text color */
    label: "#94a3b8", // slate-300
    /** Chart title text color */
    title: "#f1f5f9", // slate-100
    /** Legend text color */
    legend: "#cbd5e1", // slate-200
    /** Tooltip background */
    tooltipBg: "#1e293b", // slate-700
    /** Tooltip text */
    tooltipText: "#f1f5f9", // slate-100
    /** Tooltip border */
    tooltipBorder: "#475569", // slate-500
    /** Reference line color */
    reference: "#475569", // slate-500
    /** Zero line color */
    zeroLine: "#64748b", // slate-400
  },
} as const

/**
 * Opacity values for data visualization overlays
 */
export const dataVisOpacity = {
  /** Area fill under line charts */
  areaFill: "0.1",
  /** Hover state highlight */
  hoverHighlight: "0.15",
  /** Selection highlight */
  selectionHighlight: "0.25",
  /** Inactive/dimmed series */
  inactive: "0.3",
  /** Active series */
  active: "1",
} as const

/**
 * Combined data visualization tokens
 */
export const dataVis = {
  categorical,
  categoricalArray,
  sequential,
  diverging,
  chartElements,
  opacity: dataVisOpacity,
} as const

export type CategoricalSeries = keyof typeof categorical
export type SequentialPalette = keyof typeof sequential
export type DivergingPalette = keyof typeof diverging
export type ChartElement = keyof typeof chartElements.light
export type DataVis = typeof dataVis
