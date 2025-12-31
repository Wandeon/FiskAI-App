/**
 * FiskAI Design System ESLint Plugin
 *
 * Enforces design token usage, blocks hardcoded colors.
 */

/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable */
const noHardcodedColors = require("./no-hardcoded-colors")

module.exports = {
  rules: {
    "no-hardcoded-colors": noHardcodedColors,
  },
  configs: {
    strict: {
      plugins: ["fisk-design-system"],
      rules: {
        "fisk-design-system/no-hardcoded-colors": "error",
      },
    },
    recommended: {
      plugins: ["fisk-design-system"],
      rules: {
        "fisk-design-system/no-hardcoded-colors": "warn",
      },
    },
  },
}
