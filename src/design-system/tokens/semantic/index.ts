/**
 * Semantic Tokens Index
 *
 * Re-exports all semantic color tokens.
 * These are the primary tokens that components should use.
 */

export { surfaces, surfacesLight, surfacesDark, type SurfaceToken, type Surfaces } from "./surfaces"

export { text, textLight, textDark, type TextToken, type Text } from "./text"

export { borders, bordersLight, bordersDark, type BorderToken, type Borders } from "./borders"

export {
  interactive,
  interactiveLight,
  interactiveDark,
  type InteractiveToken,
  type Interactive,
} from "./interactive"

export {
  statusColors,
  successLight,
  successDark,
  warningLight,
  warningDark,
  dangerLight,
  dangerDark,
  infoLight,
  infoDark,
  type StatusColorBundle,
  type StatusVariant,
  type StatusColors,
} from "./colors"

// Import values for combined object
import { surfacesLight, surfacesDark } from "./surfaces"
import { textLight, textDark } from "./text"
import { bordersLight, bordersDark } from "./borders"
import { interactiveLight, interactiveDark } from "./interactive"
import { statusColors as statusColorsImport } from "./colors"

/**
 * Combined semantic tokens object for convenience
 */
export const semantic = {
  surfaces: {
    light: surfacesLight,
    dark: surfacesDark,
  },
  text: {
    light: textLight,
    dark: textDark,
  },
  borders: {
    light: bordersLight,
    dark: bordersDark,
  },
  interactive: {
    light: interactiveLight,
    dark: interactiveDark,
  },
  statusColors: {
    light: statusColorsImport.light,
    dark: statusColorsImport.dark,
  },
} as const
